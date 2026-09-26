import test from "node:test";
import assert from "node:assert/strict";
import {
  getFalGenerationStatus,
  lipSyncModel,
  modelForMode,
  submitFalLipSync,
  submitFalGeneration,
  validateFalLipSyncDataUrl,
  validateFalImageDataUrl,
  validateFalModel,
} from "../lib/providers/fal.ts";

const env = { FAL_KEY: "test-secret" };

test("selects known image, edit, and video endpoints", () => {
  assert.equal(modelForMode("image", env), "fal-ai/nano-banana-2");
  assert.equal(modelForMode("character", env, true), "fal-ai/nano-banana-2/edit");
  assert.equal(modelForMode("video", env), "bytedance/seedance-2.0/fast/text-to-video");
  assert.equal(modelForMode("video", env, true), "bytedance/seedance-2.0/fast/image-to-video");
  assert.throws(() => modelForMode("voice", env), /MODE_NOT_SUPPORTED/);
});

test("animates a supplied image using the image-to-video model", async () => {
  let sent;
  await submitFalGeneration({
    mode: "video",
    prompt: "La cámara se acerca lentamente",
    referenceImage: "data:image/png;base64,AAAA",
  }, env, async (url, init) => {
    sent = { url, init };
    return Response.json({ request_id: "video_123" });
  });
  assert.equal(sent.url, "https://queue.fal.run/bytedance/seedance-2.0/fast/image-to-video");
  assert.equal(JSON.parse(sent.init.body).image_url, "data:image/png;base64,AAAA");
});

test("rejects untrusted endpoint names and oversized reference data", () => {
  assert.throws(() => validateFalModel("../secret"), /INVALID_MODEL/);
  assert.equal(validateFalImageDataUrl("data:image/png;base64,AAAA"), true);
  assert.equal(validateFalImageDataUrl("https://attacker.example/image.png"), false);
  assert.equal(validateFalImageDataUrl(`data:image/png;base64,${"A".repeat(12_000_001)}`), false);
});

test("submits an image edit without exposing the server key in the response", async () => {
  let sent;
  const fetcher = async (url, init) => {
    sent = { url, init };
    return Response.json({ request_id: "request_123" });
  };
  const job = await submitFalGeneration({
    mode: "image",
    prompt: "Conserva la pose y cambia el fondo por un jardín",
    referenceImage: "data:image/png;base64,AAAA",
  }, env, fetcher);

  assert.equal(job.status, "queued");
  assert.equal(job.model, "fal-ai/nano-banana-2/edit");
  assert.equal(job.requestId, "request_123");
  assert.equal(sent.url, "https://queue.fal.run/fal-ai/nano-banana-2/edit");
  assert.equal(sent.init.headers.Authorization, "Key test-secret");
  assert.deepEqual(JSON.parse(sent.init.body).image_urls, ["data:image/png;base64,AAAA"]);
  assert.equal(JSON.stringify(job).includes("test-secret"), false);
});

test("retrieves a completed image result after queue status changes", async () => {
  const replies = [
    Response.json({ status: "COMPLETED" }),
    Response.json({ images: [{ url: "https://v3b.fal.media/files/result.png" }] }),
  ];
  const result = await getFalGenerationStatus(
    "fal-ai/nano-banana-2",
    "request_123",
    env,
    async () => replies.shift(),
  );
  assert.deepEqual(result, {
    status: "succeeded",
    requestId: "request_123",
    mediaUrl: "https://v3b.fal.media/files/result.png",
    mediaType: "image",
  });
});

test("does not return a media URL outside fal's trusted result hosts", async () => {
  const replies = [
    Response.json({ status: "COMPLETED" }),
    Response.json({ video: { url: "https://attacker.example/result.mp4" } }),
  ];
  const result = await getFalGenerationStatus(
    "bytedance/seedance-2.0/fast/text-to-video",
    "request_123",
    env,
    async () => replies.shift(),
  );
  assert.equal(result.status, "failed");
  assert.match(result.error, /sin devolver un archivo/);
});

test("submits a consented lip-sync request to the private fal queue", async () => {
  let sent;
  const job = await submitFalLipSync({
    videoDataUrl: "data:video/mp4;base64,AAAA",
    audioDataUrl: "data:audio/mpeg;base64,BBBB",
  }, env, async (url, init) => {
    sent = { url, init };
    return Response.json({ request_id: "sync_123" });
  });
  assert.equal(job.model, "fal-ai/sync-lipsync/v2");
  assert.equal(lipSyncModel(env), job.model);
  assert.equal(sent.url, "https://queue.fal.run/fal-ai/sync-lipsync/v2");
  assert.equal(sent.init.headers.Authorization, "Key test-secret");
  assert.deepEqual(JSON.parse(sent.init.body), {
    video_url: "data:video/mp4;base64,AAAA",
    audio_url: "data:audio/mpeg;base64,BBBB",
    sync_mode: "cut_off",
  });
});

test("accepts only bounded base64 video and audio references", () => {
  assert.equal(validateFalLipSyncDataUrl("data:video/mp4;base64,AAAA", "video"), true);
  assert.equal(validateFalLipSyncDataUrl("data:audio/mpeg;base64,AAAA", "audio"), true);
  assert.equal(validateFalLipSyncDataUrl("data:text/html;base64,AAAA", "audio"), false);
  assert.equal(validateFalLipSyncDataUrl("https://example.com/video.mp4", "video"), false);
});
