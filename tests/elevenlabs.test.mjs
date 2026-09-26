import test from "node:test";
import assert from "node:assert/strict";
import {
  cloneVoice,
  listVoices,
  synthesizeSpeech,
  validateVoiceId,
  validateVoiceName,
  validateVoiceSample,
} from "../lib/providers/elevenlabs.ts";

const env = { ELEVENLABS_API_KEY: "test-secret", ELEVENLABS_DEFAULT_VOICE_ID: "voice_123" };

test("validates voice names, ids, and accepted sample audio", () => {
  assert.equal(validateVoiceName("  Mi voz  "), true);
  assert.equal(validateVoiceName("a".repeat(65)), false);
  assert.equal(validateVoiceId("voice_123"), true);
  assert.equal(validateVoiceId("../../private"), false);
  assert.equal(validateVoiceSample(new File(["sample"], "voice.wav", { type: "audio/wav" })), true);
  assert.equal(validateVoiceSample(new File(["sample"], "voice.txt", { type: "text/plain" })), false);
});

test("creates a voice with multipart upload and server-side authentication", async () => {
  let sent;
  const sample = new File(["audio-data"], "mi voz.wav", { type: "audio/wav" });
  const voice = await cloneVoice({ name: "Mi voz", sample }, env, async (url, init) => {
    sent = { url, init };
    return Response.json({ voice_id: "voice_456", requires_verification: true });
  });
  assert.deepEqual(voice, { voiceId: "voice_456", requiresVerification: true });
  assert.equal(sent.url, "https://api.elevenlabs.io/v1/voices/add");
  assert.equal(sent.init.headers["xi-api-key"], "test-secret");
  assert.equal(sent.init.body.get("name"), "Mi voz");
  assert.equal(sent.init.body.getAll("files[]").length, 1);
});

test("lists only well-formed provider voice records", async () => {
  const voices = await listVoices(env, async () => Response.json({
    voices: [
      { voice_id: "voice_123", name: "Narración", category: "premade" },
      { voice_id: "../bad", name: "Mala" },
      { name: "Sin ID" },
    ],
  }));
  assert.deepEqual(voices, [{ voiceId: "voice_123", name: "Narración", category: "premade" }]);
});

test("generates multilingual speech using the selected voice and keeps the key private", async () => {
  let sent;
  const audio = new Uint8Array([73, 68, 51]);
  const result = await synthesizeSpeech({ text: "Hola desde ClassicArt", voiceId: "voice_456" }, env, async (url, init) => {
    sent = { url, init };
    return new Response(audio, { headers: { "content-type": "audio/mpeg" } });
  });
  assert.equal(sent.url, "https://api.elevenlabs.io/v1/text-to-speech/voice_456?output_format=mp3_44100_128");
  assert.equal(sent.init.headers["xi-api-key"], "test-secret");
  assert.deepEqual(JSON.parse(sent.init.body), { text: "Hola desde ClassicArt", model_id: "eleven_multilingual_v2" });
  assert.equal(result.contentType, "audio/mpeg");
  assert.deepEqual(new Uint8Array(await new Response(result.body).arrayBuffer()), audio);
});

test("refuses speech text that is empty or too long", async () => {
  await assert.rejects(() => synthesizeSpeech({ text: "  " }, env, async () => Response.json({})), /INVALID_SPEECH_TEXT/);
  await assert.rejects(() => synthesizeSpeech({ text: "x".repeat(5001) }, env, async () => Response.json({})), /INVALID_SPEECH_TEXT/);
});
