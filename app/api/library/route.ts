import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { assets, characters, projects, voiceProfiles } from "@/db/schema";
import { requireApiUser } from "@/app/api/_lib/auth";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!env.DB) return Response.json({ code: "storage_not_configured", message: "La biblioteca todavía no está conectada." }, { status: 503 });
  const section = new URL(request.url).searchParams.get("section") ?? "assets";
  const db = getDb();
  try {
    if (section === "characters") {
      const items = await db.select().from(characters)
        .where(eq(characters.ownerUserId, auth.userId)).orderBy(desc(characters.createdAt)).limit(100);
      return Response.json({ items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        createdAt: item.createdAt,
        url: item.referenceAssetId ? `/api/media/${item.referenceAssetId}` : null,
      })) });
    }
    if (section === "voices") {
      const items = await db.select().from(voiceProfiles)
        .where(eq(voiceProfiles.ownerUserId, auth.userId)).orderBy(desc(voiceProfiles.createdAt)).limit(100);
      return Response.json({ items: items.map((item) => ({
        id: item.id,
        name: item.displayName,
        consentStatus: item.consentStatus,
        createdAt: item.createdAt,
      })) });
    }
    if (section === "projects") {
      const items = await db.select().from(projects)
        .where(eq(projects.ownerUserId, auth.userId)).orderBy(desc(projects.updatedAt)).limit(100);
      return Response.json({ items: items.map((item) => ({ id: item.id, name: item.name, createdAt: item.createdAt })) });
    }
    const items = await db.select().from(assets)
      .where(eq(assets.ownerUserId, auth.userId)).orderBy(desc(assets.createdAt)).limit(100);
    return Response.json({ items: items.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      fileName: asset.fileName,
      contentType: asset.contentType,
      createdAt: asset.createdAt,
      url: `/api/media/${asset.id}`,
    })) });
  } catch {
    return Response.json({ code: "library_not_ready", message: "Aplica las migraciones antes de abrir la biblioteca." }, { status: 503 });
  }
}
