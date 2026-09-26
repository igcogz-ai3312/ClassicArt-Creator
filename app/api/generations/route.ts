import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { assets, characters, generations, projects } from "@/db/schema";
import { mediaBucket } from "@/lib/storage";
import { requireApiUser } from "@/app/api/_lib/auth";
import { validateGenerationRequest } from "@/lib/domain.mjs";
import {
  falIsConfigured,
  getFalGenerationStatus,
  submitFalGeneration,
  validateFalImageDataUrl,
  type FalEnvironment,
} from "@/lib/providers/fal";

const falEnv = env as unknown as FalEnvironment;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: "El contenido enviado no es válido." }, { status: 400 });
  }

  const validation = validateGenerationRequest(body);
  if (!validation.ok || !validation.value) {
    return Response.json({ code: "invalid_request", message: validation.error }, { status: 400 });
  }
  if (validation.value.mode === "voice") {
    return Response.json({
      code: "voice_provider_required",
      message: "La síntesis de voz se activa al configurar ElevenLabs.",
    }, { status: 503 });
  }
  if (!falIsConfigured(validation.value.mode, falEnv)) {
    return Response.json({
      code: "provider_not_configured",
      message: "Configura FAL_KEY en los secretos del proyecto para activar imagen y video.",
      mode: validation.value.mode,
    }, { status: 503 });
  }

  const bodyRecord = asRecord(body);
  const referenceImage = bodyRecord?.referenceImage;
  const projectId = bodyRecord?.projectId;
  if (referenceImage !== undefined && !validateFalImageDataUrl(referenceImage)) {
    return Response.json({
      code: "invalid_reference",
      message: "La referencia debe ser una imagen PNG, JPEG, WebP, GIF o AVIF de menos de 9 MB.",
    }, { status: 400 });
  }
  if (projectId !== undefined && (typeof projectId !== "string" || !/^[a-f0-9-]{36}$/i.test(projectId))) {
    return Response.json({ code: "invalid_project", message: "El proyecto seleccionado no es válido." }, { status: 400 });
  }

  if (!env.DB || !env.MEDIA) {
    return Response.json({ code: "storage_not_configured", message: "Conecta D1 y R2 para guardar las generaciones y sus archivos." }, { status: 503 });
  }
  const db = getDb();
  if (typeof projectId === "string") {
    const [project] = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, auth.userId))).limit(1);
    if (!project) return Response.json({ code: "project_not_found", message: "No tienes acceso a ese proyecto." }, { status: 404 });
  }
  try {
    await db.select({ id: generations.id }).from(generations).limit(1);
    await db.select({ id: assets.id }).from(assets).limit(1);
  } catch {
    return Response.json({ code: "storage_not_ready", message: "Aplica las migraciones del proyecto antes de generar contenido." }, { status: 503 });
  }

  const generationId = crypto.randomUUID();
  try {
    const job = await submitFalGeneration({
      ...validation.value,
      ...(typeof referenceImage === "string" ? { referenceImage } : {}),
    }, falEnv);
    await db.insert(generations).values({
      id: generationId,
      ownerUserId: auth.userId,
      ...(typeof projectId === "string" ? { projectId } : {}),
      mode: validation.value.mode,
      prompt: validation.value.prompt,
      provider: job.provider,
      providerModel: job.model,
      providerJobId: job.requestId,
      status: "queued",
    });
    return Response.json({ generationId, status: "queued" }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_REQUEST_FAILED";
    return providerFailure(code);
  }
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!env.DB || !env.MEDIA) {
    return Response.json({ code: "storage_not_configured", message: "Conecta D1 y R2 para consultar generaciones." }, { status: 503 });
  }

  const generationId = new URL(request.url).searchParams.get("generationId");
  if (!generationId || !/^[a-f0-9-]{36}$/i.test(generationId)) {
    return Response.json({ code: "invalid_generation", message: "El identificador de generación no es válido." }, { status: 400 });
  }
  const db = getDb();
  const [generation] = await db.select().from(generations)
    .where(and(eq(generations.id, generationId), eq(generations.ownerUserId, auth.userId)))
    .limit(1);
  if (!generation) return Response.json({ code: "generation_not_found", message: "No se encontró esta generación." }, { status: 404 });

  if (generation.status === "succeeded" && generation.resultAssetId) {
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, generation.resultAssetId), eq(assets.ownerUserId, auth.userId)))
      .limit(1);
    if (!asset) return Response.json({ code: "asset_not_found", message: "No se encontró el archivo guardado." }, { status: 404 });
    return Response.json({
      status: "succeeded",
      generationId,
      mediaUrl: `/api/media/${asset.id}`,
      mediaType: asset.kind,
    });
  }
  if (generation.status === "failed") {
    return Response.json({ status: "failed", generationId, error: "El proveedor no pudo completar la generación." });
  }
  if (!generation.providerModel || !generation.providerJobId) {
    return Response.json({ status: generation.status, generationId });
  }

  try {
    const status = await getFalGenerationStatus(generation.providerModel, generation.providerJobId, falEnv);
    if (status.status === "queued" || status.status === "processing") {
      if (status.status !== generation.status) {
        await db.update(generations).set({ status: status.status, updatedAt: new Date().toISOString() })
          .where(and(eq(generations.id, generationId), eq(generations.ownerUserId, auth.userId)));
      }
      return Response.json({ ...status, generationId });
    }
    if (status.status === "failed") {
      await db.update(generations).set({ status: "failed", errorCode: "provider_failed", updatedAt: new Date().toISOString() })
        .where(eq(generations.id, generationId));
      return Response.json({ ...status, generationId });
    }

    if (status.mediaType !== "image" && status.mediaType !== "video") {
      throw new Error("PROVIDER_INVALID_RESPONSE");
    }
    const stored = await persistFalMedia(status.mediaUrl, status.mediaType, auth.userId);
    let characterId: string | null = null;
    if (generation.mode === "character") {
      characterId = crypto.randomUUID();
      await db.insert(characters).values({
        id: characterId,
        ...(generation.projectId ? { projectId: generation.projectId } : {}),
        ownerUserId: auth.userId,
        name: generation.prompt.slice(0, 64).trim() || "Personaje nuevo",
        description: generation.prompt,
      });
    }
    const assetId = crypto.randomUUID();
    const objectKey = `media/${assetId}`;
    await mediaBucket({ MEDIA: env.MEDIA }).put(objectKey, stored.stream, {
      httpMetadata: { contentType: stored.contentType },
    });
    await db.insert(assets).values({
      id: assetId,
      ownerUserId: auth.userId,
      ...(generation.projectId ? { projectId: generation.projectId } : {}),
      characterId,
      kind: status.mediaType,
      objectKey,
      contentType: stored.contentType,
      fileName: stored.fileName,
    });
    await db.update(generations).set({
      status: "succeeded",
      resultAssetId: assetId,
      characterId,
      updatedAt: new Date().toISOString(),
    }).where(and(eq(generations.id, generationId), eq(generations.ownerUserId, auth.userId)));
    if (characterId) {
      await db.update(characters).set({ referenceAssetId: assetId }).where(eq(characters.id, characterId));
    }
    return Response.json({
      status: "succeeded",
      generationId,
      mediaUrl: `/api/media/${assetId}`,
      mediaType: status.mediaType,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "MEDIA_STORAGE_FAILED";
    if (code === "MEDIA_TOO_LARGE" || code === "MEDIA_TYPE_NOT_SUPPORTED" || code === "MEDIA_FETCH_FAILED") {
      await db.update(generations).set({ status: "failed", errorCode: code, updatedAt: new Date().toISOString() })
        .where(and(eq(generations.id, generationId), eq(generations.ownerUserId, auth.userId)));
      return Response.json({ status: "failed", generationId, error: storageMessage(code) });
    }
    return providerFailure(code);
  }
}

async function persistFalMedia(url: string | undefined, kind: "image" | "video" | undefined, userId: string) {
  if (!url || !kind) throw new Error("PROVIDER_INVALID_RESPONSE");
  let response: Response;
  try {
    response = await fetch(url, { redirect: "error" });
  } catch {
    throw new Error("MEDIA_FETCH_FAILED");
  }
  if (!response.ok || !response.body) throw new Error("MEDIA_FETCH_FAILED");
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const isImage = kind === "image" && ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(contentType);
  const isVideo = kind === "video" && ["video/mp4", "video/webm", "video/quicktime"].includes(contentType);
  if (!isImage && !isVideo) throw new Error("MEDIA_TYPE_NOT_SUPPORTED");
  const maxBytes = kind === "video" ? 80 * 1024 * 1024 : 20 * 1024 * 1024;
  const sizeHeader = Number(response.headers.get("content-length"));
  if (Number.isFinite(sizeHeader) && sizeHeader > maxBytes) throw new Error("MEDIA_TOO_LARGE");
  return {
    stream: limitStream(response.body, maxBytes),
    contentType,
    fileName: `${kind}-${userId.slice(0, 8)}-${Date.now()}.${contentType.split("/")[1] ?? (kind === "video" ? "mp4" : "png")}`,
  };
}

function limitStream(source: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = source.getReader();
  let total = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const part = await reader.read();
      if (part.done) return controller.close();
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        controller.error(new Error("MEDIA_TOO_LARGE"));
        return;
      }
      controller.enqueue(part.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function storageMessage(code: string) {
  if (code === "MEDIA_TOO_LARGE") return "El archivo generado supera el límite de almacenamiento del proyecto.";
  if (code === "MEDIA_TYPE_NOT_SUPPORTED") return "El proveedor devolvió un formato de archivo que el proyecto no admite.";
  return "No se pudo descargar el archivo del proveedor.";
}

function providerFailure(code: string) {
  const known: Record<string, { status: number; message: string }> = {
    PROVIDER_NOT_CONFIGURED: { status: 503, message: "Configura la clave del proveedor para activar esta función." },
    PROVIDER_AUTH_FAILED: { status: 502, message: "El proveedor rechazó la clave configurada. Revisa el secreto del proyecto." },
    PROVIDER_RATE_LIMITED: { status: 429, message: "El proveedor está ocupado. Espera un momento y vuelve a intentarlo." },
    PROVIDER_REQUEST_FAILED: { status: 502, message: "El proveedor no pudo aceptar la solicitud." },
    PROVIDER_INVALID_RESPONSE: { status: 502, message: "El proveedor devolvió una respuesta que no pudimos procesar." },
    INVALID_MODEL: { status: 500, message: "El modelo configurado no es válido." },
    INVALID_REQUEST_ID: { status: 400, message: "El identificador de generación no es válido." },
  };
  const failure = known[code] ?? { status: 502, message: "No se pudo completar la generación." };
  return Response.json({ code, message: failure.message }, { status: failure.status });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
