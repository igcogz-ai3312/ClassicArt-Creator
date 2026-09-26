import { validateVoiceCloneRequest } from "@/lib/domain.mjs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: "El contenido enviado no es válido." }, { status: 400 });
  }

  const validation = validateVoiceCloneRequest(body);
  if (!validation.ok) {
    return Response.json({ code: "consent_required", message: validation.error }, { status: 400 });
  }

  return Response.json({
    code: "provider_not_configured",
    message: "Aún falta conectar un proveedor de voz. No se ha procesado ningún audio.",
  }, { status: 503 });
}
