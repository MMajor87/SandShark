CREATE TABLE `plugin_storage` (
	`plugin_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `thread_followers` (
	`user_id` integer NOT NULL,
	`parent_message_id` integer NOT NULL,
	`last_read_message_id` integer,
	`has_unread_mention` integer DEFAULT false NOT NULL,
	`last_reply_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `parent_message_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_followers_parent_idx` ON `thread_followers` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `thread_followers_user_last_reply_idx` ON `thread_followers` (`user_id`,`last_reply_at`,`parent_message_id`);--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `user_one_closed_at` integer;--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `user_two_closed_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `plugin_components` text;--> statement-breakpoint
CREATE INDEX `messages_parent_created_idx` ON `messages` (`parent_message_id`,`created_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission`, `created_at`) SELECT `role_id`, 'SEND_VOICE_REACTION', unixepoch() FROM `role_permissions` WHERE `permission` = 'JOIN_VOICE_CHANNELS';
