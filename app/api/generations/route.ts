import { validateGenerationRequest } from "@/lib/domain.mjs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: "El contenido enviado no es válido." }, { status: 400 });
  }

  const validation = validateGenerationRequest(body);
  if (!validation.ok || !validation.value) {
    return Response.json({ code: "invalid_request", message: validation.error }, { status: 400 });
  }

  return Response.json({
    code: "provider_not_configured",
    message: "La estructura está lista, pero aún falta conectar un proveedor para generar contenido.",
    mode: validation.value.mode,
  }, { status: 503 });
}
