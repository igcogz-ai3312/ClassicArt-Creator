export const CREATION_MODES = Object.freeze(["image", "video", "character", "voice"]);

export function validateGenerationRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "El cuerpo debe ser un objeto." };
  }
  if (!CREATION_MODES.includes(value.mode)) {
    return { ok: false, error: "El tipo de creación no es válido." };
  }
  if (typeof value.prompt !== "string") {
    return { ok: false, error: "La descripción debe ser texto." };
  }
  const prompt = value.prompt.trim();
  if (!prompt) return { ok: false, error: "Escribe una descripción para empezar." };
  if (prompt.length > 1000) {
    return { ok: false, error: "La descripción debe tener 1,000 caracteres o menos." };
  }
  return { ok: true, value: { mode: value.mode, prompt } };
}

export function validateVoiceCloneRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "El cuerpo debe ser un objeto." };
  }
  if (value.consentConfirmed !== true) {
    return { ok: false, error: "Confirma que eres titular de la voz o que tienes autorización explícita para clonarla." };
  }
  return { ok: true };
}
