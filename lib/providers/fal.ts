import type { CreationMode } from "./contracts";

const QUEUE_ORIGIN = "https://queue.fal.run";
const MODEL_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9./_-]{0,127}$/;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{3,128}$/;

export type FalEnvironment = {
  FAL_KEY?: string;
  FAL_IMAGE_MODEL?: string;
  FAL_IMAGE_EDIT_MODEL?: string;
  FAL_VIDEO_MODEL?: string;
  FAL_VIDEO_IMAGE_MODEL?: string;
  FAL_LIPSYNC_MODEL?: string;
};

export type FalFetch = typeof fetch;

export type FalJobStatus = {
  status: "queued" | "processing" | "succeeded" | "failed";
  requestId: string;
  queuePosition?: number;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  error?: string;
};

export function falIsConfigured(mode: CreationMode, env: FalEnvironment): boolean {
  if (!env.FAL_KEY?.trim()) return false;
  if (mode === "image" || mode === "character") return true;
  return mode === "video";
}

export function validateFalModel(model: string): string {
  if (!MODEL_ID_PATTERN.test(model)) throw new Error("INVALID_MODEL");
  return model;
}

export function modelForMode(mode: CreationMode, env: FalEnvironment, hasReference = false): string {
  if (mode === "image" || mode === "character") {
    return validateFalModel(hasReference
      ? env.FAL_IMAGE_EDIT_MODEL?.trim() || "fal-ai/nano-banana-2/edit"
      : env.FAL_IMAGE_MODEL?.trim() || "fal-ai/nano-banana-2");
  }
  if (mode === "video") {
    if (hasReference) {
      return validateFalModel(env.FAL_VIDEO_IMAGE_MODEL?.trim() || "bytedance/seedance-2.0/fast/image-to-video");
    }
    return validateFalModel(env.FAL_VIDEO_MODEL?.trim() || "bytedance/seedance-2.0/fast/text-to-video");
  }
  throw new Error("MODE_NOT_SUPPORTED");
}

export function lipSyncModel(env: FalEnvironment): string {
  return validateFalModel(env.FAL_LIPSYNC_MODEL?.trim() || "fal-ai/sync-lipsync/v2");
}

export function validateFalImageDataUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 12_000_000) return false;
  return /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function validateFalLipSyncDataUrl(value: unknown, mediaType: "video" | "audio"): value is string {
  if (typeof value !== "string" || value.length > (mediaType === "video" ? 24_000_000 : 12_000_000)) return false;
  const mime = mediaType === "video" ? "video\\/(?:mp4|webm|quicktime)" : "audio\\/(?:mpeg|mp3|wav|x-wav|mp4|m4a|webm|ogg|flac)";
  return new RegExp(`^data:${mime};base64,[A-Za-z0-9+/]+={0,2}$`).test(value);
}

export async function submitFalGeneration(
  input: { mode: CreationMode; prompt: string; referenceImage?: string },
  env: FalEnvironment,
  fetcher: FalFetch = fetch,
) {
  if (!env.FAL_KEY?.trim()) throw new Error("PROVIDER_NOT_CONFIGURED");
  if (input.mode === "voice") throw new Error("MODE_NOT_SUPPORTED");

  const model = modelForMode(input.mode, env, Boolean(input.referenceImage));
  const modelInput: Record<string, unknown> = { prompt: input.prompt };
  if (input.referenceImage && (input.mode === "image" || input.mode === "character")) {
    modelInput.image_urls = [input.referenceImage];
  }
  if (input.mode === "video") {
    if (input.referenceImage) modelInput.image_url = input.referenceImage;
    modelInput.duration = "5";
    modelInput.resolution = "720p";
    modelInput.aspect_ratio = "9:16";
    modelInput.generate_audio = true;
  }

  const response = await fetcher(`${QUEUE_ORIGIN}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(modelInput),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  if (typeof payload.request_id !== "string" || !REQUEST_ID_PATTERN.test(payload.request_id)) {
    throw new Error("PROVIDER_INVALID_RESPONSE");
  }
  return { provider: "fal", model, requestId: payload.request_id as string, status: "queued" as const };
}

export async function submitFalLipSync(
  input: { videoDataUrl: string; audioDataUrl: string },
  env: FalEnvironment,
  fetcher: FalFetch = fetch,
) {
  if (!env.FAL_KEY?.trim()) throw new Error("PROVIDER_NOT_CONFIGURED");
  if (!validateFalLipSyncDataUrl(input.videoDataUrl, "video")) throw new Error("INVALID_VIDEO_REFERENCE");
  if (!validateFalLipSyncDataUrl(input.audioDataUrl, "audio")) throw new Error("INVALID_AUDIO_REFERENCE");
  const model = lipSyncModel(env);
  const response = await fetcher(`${QUEUE_ORIGIN}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ video_url: input.videoDataUrl, audio_url: input.audioDataUrl, sync_mode: "cut_off" }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  if (typeof payload.request_id !== "string" || !REQUEST_ID_PATTERN.test(payload.request_id)) {
    throw new Error("PROVIDER_INVALID_RESPONSE");
  }
  return { provider: "fal", model, requestId: payload.request_id, status: "queued" as const };
}

export async function getFalGenerationStatus(
  model: string,
  requestId: string,
  env: FalEnvironment,
  fetcher: FalFetch = fetch,
): Promise<FalJobStatus> {
  if (!env.FAL_KEY?.trim()) throw new Error("PROVIDER_NOT_CONFIGURED");
  const safeModel = validateFalModel(model);
  if (!REQUEST_ID_PATTERN.test(requestId)) throw new Error("INVALID_REQUEST_ID");
  const path = `${QUEUE_ORIGIN}/${safeModel}/requests/${encodeURIComponent(requestId)}`;
  const statusResponse = await fetcher(`${path}/status`, {
    headers: { Authorization: `Key ${env.FAL_KEY}` },
  });
  const statusPayload = await readJson(statusResponse);
  if (!statusResponse.ok) throw providerError(statusResponse.status, statusPayload);

  const status = statusPayload.status;
  if (status === "IN_QUEUE") {
    return {
      status: "queued",
      requestId,
      ...(Number.isInteger(statusPayload.queue_position) ? { queuePosition: statusPayload.queue_position as number } : {}),
    };
  }
  if (status === "IN_PROGRESS") return { status: "processing", requestId };
  if (status !== "COMPLETED") throw new Error("PROVIDER_INVALID_RESPONSE");
  if (statusPayload.error) {
    return { status: "failed", requestId, error: safeProviderMessage(statusPayload.error) };
  }

  const resultResponse = await fetcher(path, {
    headers: { Authorization: `Key ${env.FAL_KEY}` },
  });
  const resultPayload = await readJson(resultResponse);
  if (!resultResponse.ok) throw providerError(resultResponse.status, resultPayload);

  const image = Array.isArray(resultPayload.images)
    ? resultPayload.images.find(isRecord)
    : undefined;
  const imageUrl = image && typeof image.url === "string" ? image.url : undefined;
  const videoUrl = isRecord(resultPayload.video) && typeof resultPayload.video.url === "string"
    ? resultPayload.video.url
    : undefined;
  const mediaUrl = videoUrl ?? imageUrl;
  if (typeof mediaUrl !== "string" || !isSafeMediaUrl(mediaUrl)) {
    return { status: "failed", requestId, error: "El proveedor terminó sin devolver un archivo compatible." };
  }
  return { status: "succeeded", requestId, mediaUrl, mediaType: videoUrl ? "video" : "image" };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function providerError(status: number, payload: Record<string, unknown>): Error {
  if (status === 401 || status === 403) return new Error("PROVIDER_AUTH_FAILED");
  if (status === 429) return new Error("PROVIDER_RATE_LIMITED");
  return new Error(typeof payload.detail === "string" ? safeProviderMessage(payload.detail) : "PROVIDER_REQUEST_FAILED");
}

function safeProviderMessage(value: unknown): string {
  if (typeof value !== "string") return "La generación no se pudo completar.";
  return value.replace(/[\r\n\t]/g, " ").slice(0, 240);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media") || url.hostname === "storage.googleapis.com");
  } catch {
    return false;
  }
}
