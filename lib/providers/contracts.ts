export type CreationMode = "image" | "video" | "character" | "voice";

export type GenerationRequest = {
  mode: CreationMode;
  prompt: string;
  referenceKeys?: string[];
  characterId?: string;
};

export type GenerationResult = {
  providerJobId: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  resultUrl?: string;
};

export interface CreativeProvider {
  readonly name: string;
  supports(mode: CreationMode): boolean;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

export interface MediaStorage {
  put(key: string, file: ReadableStream, contentType: string): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
}
