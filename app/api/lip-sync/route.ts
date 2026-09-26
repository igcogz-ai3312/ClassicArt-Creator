import { env } from "cloudflare:workers";
import { requireApiUser } from "@/app/api/_lib/auth";
import { getDb } from "@/db";
import { generations, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { submitFalLipSync, type FalEnvironment } from "@/lib/providers/fal";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!env.DB || !env.MEDIA) {
    return Response.json({ code: "storage_not_configured", message: "Conecta D1 y R2 para guardar el video sincronizado." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: "El contenido enviado no es válido." }, { status: 400 });
  }
  if (!isRecord(body) || body.consentConfirmed !== true) {
    return Response.json({ code: "consent_required", message: "Confirma que tienes autorización para usar a la persona y el audio de esta sincronización." }, { status: 400 });
  }
  if (typeof body.videoDataUrl !== "string" || typeof body.audioDataUrl !== "string") {
    return Response.json({ code: "invalid_media", message: "Selecciona un video y genera o selecciona el audio del diálogo." }, { status: 400 });
  }
  const projectId = body.projectId;
  if (projectId !== undefined && (typeof projectId !== "string" || !/^[a-f0-9-]{36}$/i.test(projectId))) {
    return Response.json({ code: "invalid_project", message: "El proyecto seleccionado no es válido." }, { status: 400 });
  }

  try {
    const db = getDb();
    await db.select({ id: generations.id }).from(generations).limit(1);
    if (typeof projectId === "string") {
      const [project] = await db.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, auth.userId))).limit(1);
      if (!project) return Response.json({ code: "project_not_found", message: "No tienes acceso a ese proyecto." }, { status: 404 });
    }
    const job = await submitFalLipSync({
      videoDataUrl: body.videoDataUrl,
      audioDataUrl: body.audioDataUrl,
    }, env as unknown as FalEnvironment);
    const generationId = crypto.randomUUID();
    await db.insert(generations).values({
      id: generationId,
      ownerUserId: auth.userId,
      ...(typeof projectId === "string" ? { projectId } : {}),
      mode: "video",
      prompt: typeof body.text === "string" ? `Sincronización: ${body.text.trim().slice(0, 900)}` : "Sincronización de labios",
      provider: job.provider,
      providerModel: job.model,
      providerJobId: job.requestId,
      status: "queued",
    });
    return Response.json({ generationId, status: "queued" }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_REQUEST_FAILED";
    const failures: Record<string, { status: number; message: string }> = {
      PROVIDER_NOT_CONFIGURED: { status: 503, message: "Configura FAL_KEY para activar la sincronización de labios." },
      PROVIDER_AUTH_FAILED: { status: 502, message: "Fal rechazó la clave configurada." },
      PROVIDER_RATE_LIMITED: { status: 429, message: "Fal está ocupado. Intenta más tarde." },
      INVALID_VIDEO_REFERENCE: { status: 400, message: "El video debe ser MP4, WebM o QuickTime y pesar menos de 18 MB." },
      INVALID_AUDIO_REFERENCE: { status: 400, message: "El audio debe estar en un formato compatible y pesar menos de 9 MB." },
      PROVIDER_INVALID_RESPONSE: { status: 502, message: "Fal no devolvió un identificador de seguimiento válido." },
    };
    const failure = failures[code] ?? { status: 502, message: "No se pudo iniciar la sincronización." };
    return Response.json({ code, message: failure.message }, { status: failure.status });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
