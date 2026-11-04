CREATE TABLE `hosted_bots` (
	`bot_id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`env` text DEFAULT '{}' NOT NULL,
	`token_env_names` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hosted_bots_enabled_idx` ON `hosted_bots` (`enabled`);--> statement-breakpoint
ALTER TABLE `settings` ADD `enable_bot_hosting` integer DEFAULT false NOT NULL;