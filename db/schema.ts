import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  referenceAssetId: text("reference_asset_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_characters_project_id").on(table.projectId)]);

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  characterId: text("character_id").references(() => characters.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["image", "video", "audio"] }).notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  fileName: text("file_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_assets_project_created").on(table.projectId, table.createdAt),
  index("idx_assets_character_id").on(table.characterId),
]);

export const generations = sqliteTable("generations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  characterId: text("character_id").references(() => characters.id, { onDelete: "set null" }),
  mode: text("mode", { enum: ["image", "video", "character", "voice"] }).notNull(),
  prompt: text("prompt").notNull(),
  provider: text("provider").notNull(),
  status: text("status", { enum: ["queued", "processing", "succeeded", "failed"] }).notNull(),
  resultAssetId: text("result_asset_id").references(() => assets.id, { onDelete: "set null" }),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_generations_project_created").on(table.projectId, table.createdAt)]);

export const voiceProfiles = sqliteTable("voice_profiles", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  provider: text("provider").notNull(),
  providerVoiceId: text("provider_voice_id").notNull(),
  consentStatus: text("consent_status", { enum: ["not_required", "pending", "verified"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_voice_profiles_project_id").on(table.projectId)]);
