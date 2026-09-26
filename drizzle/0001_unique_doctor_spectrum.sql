PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_voice_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`owner_user_id` text,
	`display_name` text NOT NULL,
	`provider` text NOT NULL,
	`provider_voice_id` text NOT NULL,
	`consent_status` text DEFAULT 'attested' NOT NULL,
	`consent_confirmed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_voice_profiles` (
	`id`, `project_id`, `owner_user_id`, `display_name`, `provider`, `provider_voice_id`,
	`consent_status`, `consent_confirmed_at`, `created_at`
)
SELECT
	`id`, `project_id`, NULL, `display_name`, `provider`, `provider_voice_id`,
	CASE WHEN `consent_status` = 'pending' THEN 'verification_pending' ELSE 'attested' END,
	`created_at`, `created_at`
FROM `voice_profiles`;
--> statement-breakpoint
DROP TABLE `voice_profiles`;
--> statement-breakpoint
ALTER TABLE `__new_voice_profiles` RENAME TO `voice_profiles`;
--> statement-breakpoint
CREATE INDEX `idx_voice_profiles_project_id` ON `voice_profiles` (`project_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
