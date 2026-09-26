import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireApiUser } from "@/app/api/_lib/auth";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!env.DB) return Response.json({ code: "storage_not_configured", message: "La base de proyectos no está conectada." }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_json", message: "El contenido enviado no es válido." }, { status: 400 });
  }
  const name = body && typeof body === "object" && "name" in body && typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) {
    return Response.json({ code: "invalid_project_name", message: "Escribe un nombre de proyecto de hasta 80 caracteres." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  try {
    await getDb().insert(projects).values({ id, ownerUserId: auth.userId, name });
    return Response.json({ id, name }, { status: 201 });
  } catch {
    return Response.json({ code: "project_create_failed", message: "No se pudo guardar el proyecto." }, { status: 503 });
  }
}
