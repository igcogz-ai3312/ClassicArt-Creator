export type ElevenLabsEnvironment = {
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_DEFAULT_VOICE_ID?: string;
};

export type ElevenLabsFetch = typeof fetch;

const ELEVENLABS_ORIGIN = "https://api.elevenlabs.io/v1";
const VOICE_ID_PATTERN = /^[a-zA-Z0-9_-]{3,80}$/;
const VOICE_NAME_PATTERN = /^[\p{L}\p{N} ._'()-]{1,64}$/u;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
]);

export function validateVoiceName(value: unknown): value is string {
  return typeof value === "string" && VOICE_NAME_PATTERN.test(value.trim());
}

export function validateVoiceSample(file: File | null): file is File {
  return Boolean(
    file &&
      ALLOWED_AUDIO_TYPES.has(file.type.toLowerCase()) &&
      file.size > 0 &&
      file.size <= 25 * 1024 * 1024,
  );
}

export function validateVoiceId(value: unknown): value is string {
  return typeof value === "string" && VOICE_ID_PATTERN.test(value);
}

export function elevenLabsIsConfigured(env: ElevenLabsEnvironment): boolean {
  return Boolean(env.ELEVENLABS_API_KEY?.trim() && env.ELEVENLABS_DEFAULT_VOICE_ID?.trim());
}

export async function cloneVoice(
  input: { name: string; sample: File },
  env: ElevenLabsEnvironment,
  fetcher: ElevenLabsFetch = fetch,
) {
  const key = env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("PROVIDER_NOT_CONFIGURED");
  if (!validateVoiceName(input.name)) throw new Error("INVALID_VOICE_NAME");
  if (!validateVoiceSample(input.sample)) throw new Error("INVALID_VOICE_SAMPLE");

  const form = new FormData();
  form.set("name", input.name.trim());
  form.append("files[]", input.sample, safeFileName(input.sample.name));
  const response = await fetcher(`${ELEVENLABS_ORIGIN}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status);
  if (typeof payload.voice_id !== "string" || !validateVoiceId(payload.voice_id)) {
    throw new Error("PROVIDER_INVALID_RESPONSE");
  }
  return {
    voiceId: payload.voice_id,
    requiresVerification: payload.requires_verification === true,
  };
}

export async function listVoices(
  env: ElevenLabsEnvironment,
  fetcher: ElevenLabsFetch = fetch,
) {
  const key = env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("PROVIDER_NOT_CONFIGURED");
  const response = await fetcher(`${ELEVENLABS_ORIGIN}/voices`, {
    headers: { "xi-api-key": key },
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status);
  const voices = Array.isArray(payload.voices) ? payload.voices : [];
  return voices.flatMap((voice: unknown) => {
    if (!isRecord(voice) || typeof voice.voice_id !== "string" || !validateVoiceId(voice.voice_id)) return [];
    return [{
      voiceId: voice.voice_id,
      name: typeof voice.name === "string" ? voice.name.slice(0, 64) : "Voz sin nombre",
      category: typeof voice.category === "string" ? voice.category.slice(0, 32) : "custom",
    }];
  });
}

export async function synthesizeSpeech(
  input: { text: string; voiceId?: string },
  env: ElevenLabsEnvironment,
  fetcher: ElevenLabsFetch = fetch,
) {
  const key = env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("PROVIDER_NOT_CONFIGURED");
  const voiceId = input.voiceId || env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (!validateVoiceId(voiceId)) throw new Error("INVALID_VOICE_ID");
  if (!input.text.trim() || input.text.length > 5000) throw new Error("INVALID_SPEECH_TEXT");

  const response = await fetcher(`${ELEVENLABS_ORIGIN}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.text.trim(), model_id: "eleven_multilingual_v2" }),
  });
  if (!response.ok) throw providerError(response.status);
  return {
    body: response.body,
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function providerError(status: number): Error {
  if (status === 401 || status === 403) return new Error("PROVIDER_AUTH_FAILED");
  if (status === 422) return new Error("PROVIDER_REJECTED_INPUT");
  if (status === 429) return new Error("PROVIDER_RATE_LIMITED");
  return new Error("PROVIDER_REQUEST_FAILED");
}

function safeFileName(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-96);
  return normalized || "voice-sample";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
