CREATE TABLE `bot_commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bot_id` integer NOT NULL,
	`guild_scoped` integer NOT NULL,
	`type` integer NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`options` text NOT NULL,
	`default_member_permissions` text,
	`nsfw` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bot_commands_bot_scope_type_name_idx` ON `bot_commands` (`bot_id`,`guild_scoped`,`type`,`name`);