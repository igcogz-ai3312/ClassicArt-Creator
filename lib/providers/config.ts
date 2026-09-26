import type { CreationMode } from "./contracts";

export type ProviderEnvironment = {
  FAL_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_DEFAULT_VOICE_ID?: string;
};

const requiredEnvironment: Record<CreationMode, readonly (keyof ProviderEnvironment)[]> = {
  image: ["FAL_KEY"],
  character: ["FAL_KEY"],
  video: ["FAL_KEY"],
  voice: ["ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID"],
};

export function providerIsConfigured(mode: CreationMode, env: ProviderEnvironment): boolean {
  return requiredEnvironment[mode].every((key) => Boolean(env[key]?.trim()));
}
