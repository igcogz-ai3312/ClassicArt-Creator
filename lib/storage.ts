export interface ObjectBucket {
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<unknown | null>;
  delete(key: string): Promise<void>;
}

export function mediaBucket(env: { MEDIA?: ObjectBucket }): ObjectBucket {
  if (!env.MEDIA) throw new Error("R2_MEDIA_BINDING_UNAVAILABLE");
  return env.MEDIA;
}
