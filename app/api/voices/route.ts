import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { voiceProfiles } from "@/db/schema";
import { requireApiUser } from "@/app/api/_lib/auth";
import { listVoices, type ElevenLabsEnvironment } from "@/lib/providers/elevenlabs";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    const voices = await listVoices(env as unknown as ElevenLabsEnvironment);
    const defaultVoiceId = typeof env.ELEVENLABS_DEFAULT_VOICE_ID === "string" ? env.ELEVENLABS_DEFAULT_VOICE_ID : "";
    const ownedProfiles = env.DB
      ? await getDb().select({ voiceId: voiceProfiles.providerVoiceId, name: voiceProfiles.displayName }).from(voiceProfiles).where(eq(voiceProfiles.ownerUserId, auth.userId))
      : [];
    const allowed = new Map<string, string>(ownedProfiles.map((voice) => [voice.voiceId, voice.name]));
    if (defaultVoiceId) allowed.set(defaultVoiceId, "Voz predeterminada");
    const visibleVoices = voices
      .filter((voice) => allowed.has(voice.voiceId))
      .map((voice) => ({ ...voice, name: allowed.get(voice.voiceId) ?? voice.name }));
    return Response.json({ voices: visibleVoices }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_REQUEST_FAILED";
    const failures: Record<string, { status: number; message: string }> = {
      PROVIDER_NOT_CONFIGURED: { status: 503, message: "Configura ELEVENLABS_API_KEY para cargar tus voces." },
      PROVIDER_AUTH_FAILED: { status: 502, message: "ElevenLabs rechazó la clave configurada." },
      PROVIDER_RATE_LIMITED: { status: 429, message: "ElevenLabs está ocupado. Intenta más tarde." },
    };
    const failure = failures[code] ?? { status: 502, message: "No se pudieron cargar las voces." };
    return Response.json({ code, message: failure.message }, { status: failure.status });
  }
}
