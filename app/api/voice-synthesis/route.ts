import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, generations, projects, voiceProfiles } from "@/db/schema";
import { requireApiUser } from "@/app/api/_lib/auth";
import { mediaBucket } from "@/lib/storage";
import {
  synthesizeSpeech,
  type ElevenLabsEnvironment,
} from "@/lib/providers/elevenlabs";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!env.DB || !env.MEDIA) {
    return Response.json({ code: "storage_not_configured", message: "Conecta D1 y R2 para guardar el audio generado." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: "El contenido enviado no es válido." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.text !== "string" || !body.text.trim() || body.text.length > 5000) {
    return Response.json({ code: "invalid_speech_text", message: "Escribe un texto de hasta 5,000 caracteres." }, { status: 400 });
  }
  const projectId = body.projectId;
  if (projectId !== undefined && (typeof projectId !== "string" || !/^[a-f0-9-]{36}$/i.test(projectId))) {
    return Response.json({ code: "invalid_project", message: "El proyecto seleccionado no es válido." }, { status: 400 });
  }
  if (typeof projectId === "string") {
    const [project] = await getDb().select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, auth.userId))).limit(1);
    if (!project) return Response.json({ code: "project_not_found", message: "No tienes acceso a ese proyecto." }, { status: 404 });
  }
  const voiceId = typeof body.voiceId === "string" ? body.voiceId : env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (!voiceId) return Response.json({ code: "voice_required", message: "Selecciona una voz disponible para generar el audio." }, { status: 400 });
  const isDefaultVoice = voiceId === env.ELEVENLABS_DEFAULT_VOICE_ID;
  const [ownedVoice] = !isDefaultVoice && env.DB
    ? await getDb().select({ id: voiceProfiles.id }).from(voiceProfiles)
        .where(and(eq(voiceProfiles.ownerUserId, auth.userId), eq(voiceProfiles.providerVoiceId, voiceId)))
        .limit(1)
    : [];
  if (!isDefaultVoice && !ownedVoice) return Response.json({ code: "voice_not_available", message: "No tienes acceso a esa voz." }, { status: 403 });

  try {
    const result = await synthesizeSpeech({
      text: body.text,
      voiceId,
    }, env as unknown as ElevenLabsEnvironment);
    if (!result.body) throw new Error("PROVIDER_INVALID_RESPONSE");
    const audio = await readLimitedAudio(result.body, 20 * 1024 * 1024);
    const assetId = crypto.randomUUID();
    const generationId = crypto.randomUUID();
    const objectKey = `media/${assetId}`;
    await mediaBucket({ MEDIA: env.MEDIA }).put(objectKey, audio, {
      httpMetadata: { contentType: result.contentType },
    });
    const db = getDb();
    await db.insert(assets).values({
      id: assetId,
      ownerUserId: auth.userId,
      ...(typeof projectId === "string" ? { projectId } : {}),
      kind: "audio",
      objectKey,
      contentType: result.contentType,
      fileName: `voz-${assetId.slice(0, 8)}.mp3`,
    });
    await db.insert(generations).values({
      id: generationId,
      ownerUserId: auth.userId,
      ...(typeof projectId === "string" ? { projectId } : {}),
      mode: "voice",
      prompt: body.text.trim(),
      provider: "elevenlabs",
      providerModel: "eleven_multilingual_v2",
      status: "succeeded",
      resultAssetId: assetId,
    });
    return new Response(audio, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="voz-${assetId.slice(0, 8)}.mp3"`,
        "X-ClassicArt-Asset-Url": `/api/media/${assetId}`,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_REQUEST_FAILED";
    const failure = providerFailure(code);
    return Response.json(failure.body, { status: failure.status });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readLimitedAudio(stream: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("AUDIO_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const audio = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return audio;
}

function providerFailure(code: string) {
  const failures: Record<string, { status: number; message: string }> = {
    AUDIO_TOO_LARGE: { status: 413, message: "El audio supera el límite de 20 MB para guardarlo." },
    PROVIDER_NOT_CONFIGURED: { status: 503, message: "Configura ElevenLabs y una voz predeterminada para sintetizar audio." },
    PROVIDER_AUTH_FAILED: { status: 502, message: "ElevenLabs rechazó la clave configurada. Revisa el secreto del proyecto." },
    PROVIDER_RATE_LIMITED: { status: 429, message: "ElevenLabs está ocupado. Espera un momento y vuelve a intentarlo." },
    INVALID_VOICE_ID: { status: 400, message: "El identificador de voz no es válido." },
    INVALID_SPEECH_TEXT: { status: 400, message: "Escribe un texto de hasta 5,000 caracteres." },
    PROVIDER_REJECTED_INPUT: { status: 422, message: "ElevenLabs rechazó el texto o la voz elegidos." },
  };
  const failure = failures[code] ?? { status: 502, message: "No se pudo generar el audio." };
  return { status: failure.status, body: { code, message: failure.message } };
}
