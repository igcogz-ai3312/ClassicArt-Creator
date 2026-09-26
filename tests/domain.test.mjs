import test from "node:test";
import assert from "node:assert/strict";
import { validateGenerationRequest, validateVoiceCloneRequest } from "../lib/domain.mjs";

test("accepts and trims a supported image prompt", () => {
  assert.deepEqual(validateGenerationRequest({ mode: "image", prompt: "  Retrato al atardecer  " }), {
    ok: true,
    value: { mode: "image", prompt: "Retrato al atardecer" },
  });
});

test("accepts every supported creation mode", () => {
  for (const mode of ["image", "video", "character", "voice"]) {
    assert.equal(validateGenerationRequest({ mode, prompt: "Una idea" }).ok, true);
  }
});

test("rejects missing prompt, unsupported mode, and prompts over the limit", () => {
  assert.equal(validateGenerationRequest({ mode: "image", prompt: " " }).ok, false);
  assert.equal(validateGenerationRequest({ mode: "music", prompt: "Idea" }).ok, false);
  assert.equal(validateGenerationRequest({ mode: "voice", prompt: "x".repeat(1001) }).ok, false);
});

test("rejects non-object bodies", () => {
  assert.equal(validateGenerationRequest(null).ok, false);
  assert.equal(validateGenerationRequest("prompt").ok, false);
});

test("requires explicit consent before voice cloning", () => {
  assert.equal(validateVoiceCloneRequest({ consentConfirmed: false }).ok, false);
  assert.equal(validateVoiceCloneRequest({ consentConfirmed: true }).ok, true);
});
