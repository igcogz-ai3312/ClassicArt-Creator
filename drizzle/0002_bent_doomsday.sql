ALTER TABLE `assets` ADD `owner_user_id` text;--> statement-breakpoint
CREATE INDEX `idx_assets_owner_created` ON `assets` (`owner_user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `characters` ADD `owner_user_id` text;--> statement-breakpoint
CREATE INDEX `idx_characters_owner_id` ON `characters` (`owner_user_id`);--> statement-breakpoint
ALTER TABLE `generations` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `generations` ADD `provider_model` text;--> statement-breakpoint
ALTER TABLE `generations` ADD `provider_job_id` text;--> statement-breakpoint
CREATE INDEX `idx_generations_owner_created` ON `generations` (`owner_user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `projects` ADD `owner_user_id` text;--> statement-breakpoint
CREATE INDEX `idx_projects_owner_id` ON `projects` (`owner_user_id`);