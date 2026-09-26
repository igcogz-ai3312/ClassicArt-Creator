import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { requireApiUser } from "@/app/api/_lib/auth";
import { mediaBucket } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!env.DB || !env.MEDIA) {
    return Response.json({ code: "storage_not_configured", message: "El almacenamiento no está conectado." }, { status: 503 });
  }
  const { assetId } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(assetId)) {
    return Response.json({ code: "invalid_asset", message: "El identificador del archivo no es válido." }, { status: 400 });
  }
  const db = getDb();
  const [asset] = await db.select().from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.ownerUserId, auth.userId)))
    .limit(1);
  if (!asset) return Response.json({ code: "asset_not_found", message: "No se encontró este archivo." }, { status: 404 });
  const object = await mediaBucket({ MEDIA: env.MEDIA }).get(asset.objectKey);
  if (!object) return Response.json({ code: "asset_missing", message: "El archivo ya no está disponible." }, { status: 404 });
  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType ?? asset.contentType,
    "Content-Disposition": `inline; filename="${asset.fileName.replace(/[\r\n"\\]/g, "_")}"`,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (object.size !== undefined) headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
