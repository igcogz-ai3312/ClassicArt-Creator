import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { voiceProfiles } from "@/db/schema";
import { requireApiUser } from "@/app/api/_lib/auth";
import { validateVoiceCloneRequest } from "@/lib/domain.mjs";
import {
  cloneVoice,
  validateVoiceName,
  validateVoiceSample,
  type ElevenLabsEnvironment,
} from "@/lib/providers/elevenlabs";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ code: "invalid_form", message: "El formulario de voz no es válido." }, { status: 400 });
  }

  const consentConfirmed = form.get("consentConfirmed") === "true";
  const consent = validateVoiceCloneRequest({ consentConfirmed });
  if (!consent.ok) {
    return Response.json({ code: "consent_required", message: consent.error }, { status: 400 });
  }

  const name = form.get("name");
  const sample = form.get("sample");
  if (!validateVoiceName(name)) {
    return Response.json({ code: "invalid_voice_name", message: "Elige un nombre de hasta 64 caracteres." }, { status: 400 });
  }
  if (!(sample instanceof File) || !validateVoiceSample(sample)) {
    return Response.json({ code: "invalid_voice_sample", message: "Sube un archivo de audio compatible de hasta 25 MB." }, { status: 400 });
  }

  try {
    if (!env.DB) {
      return Response.json({ code: "storage_not_configured", message: "Conecta la base de datos antes de guardar voces." }, { status: 503 });
    }
    const db = getDb();
    try {
      await db.select({ id: voiceProfiles.id }).from(voiceProfiles).limit(1);
    } catch {
      return Response.json({ code: "storage_not_ready", message: "Aplica la migración de datos del proyecto antes de clonar voces." }, { status: 503 });
    }
    const voice = await cloneVoice({ name, sample }, env as unknown as ElevenLabsEnvironment);
    await db.insert(voiceProfiles).values({
      id: crypto.randomUUID(),
      ownerUserId: auth.userId,
      displayName: name.trim(),
      provider: "elevenlabs",
      providerVoiceId: voice.voiceId,
      consentStatus: voice.requiresVerification ? "verification_pending" : "attested",
      consentConfirmedAt: new Date().toISOString(),
    });
    return Response.json({ ...voice, name: name.trim(), consentAttested: true }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_REQUEST_FAILED";
    const failures: Record<string, { status: number; message: string }> = {
      PROVIDER_NOT_CONFIGURED: { status: 503, message: "Configura ELEVENLABS_API_KEY para activar la clonación de voz." },
      PROVIDER_AUTH_FAILED: { status: 502, message: "ElevenLabs rechazó la clave configurada." },
      PROVIDER_RATE_LIMITED: { status: 429, message: "ElevenLabs está ocupado. Intenta más tarde." },
      PROVIDER_REJECTED_INPUT: { status: 422, message: "ElevenLabs rechazó la muestra de audio." },
      PROVIDER_INVALID_RESPONSE: { status: 502, message: "ElevenLabs no devolvió un identificador de voz válido." },
    };
    const failure = failures[code] ?? { status: 502, message: "No se pudo crear la voz." };
    return Response.json({ code, message: failure.message }, { status: failure.status });
  }
}
