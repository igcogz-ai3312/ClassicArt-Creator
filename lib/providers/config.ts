import type { CreationMode } from "./contracts";

export type ProviderEnvironment = {
  IMAGE_PROVIDER_API_KEY?: string;
  IMAGE_PROVIDER_BASE_URL?: string;
  VIDEO_PROVIDER_API_KEY?: string;
  VIDEO_PROVIDER_BASE_URL?: string;
  VOICE_PROVIDER_API_KEY?: string;
  VOICE_PROVIDER_BASE_URL?: string;
};

const requiredEnvironment: Record<CreationMode, readonly (keyof ProviderEnvironment)[]> = {
  image: ["IMAGE_PROVIDER_API_KEY", "IMAGE_PROVIDER_BASE_URL"],
  character: ["IMAGE_PROVIDER_API_KEY", "IMAGE_PROVIDER_BASE_URL"],
  video: ["VIDEO_PROVIDER_API_KEY", "VIDEO_PROVIDER_BASE_URL"],
  voice: ["VOICE_PROVIDER_API_KEY", "VOICE_PROVIDER_BASE_URL"],
};

export function providerIsConfigured(mode: CreationMode, env: ProviderEnvironment): boolean {
  return requiredEnvironment[mode].every((key) => Boolean(env[key]?.trim()));
}
