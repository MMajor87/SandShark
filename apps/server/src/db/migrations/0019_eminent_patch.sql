DELETE FROM messages WHERE parent_message_id IS NOT NULL AND parent_message_id NOT IN (SELECT id FROM messages);--> statement-breakpoint
UPDATE messages SET reply_to_message_id = NULL WHERE reply_to_message_id IS NOT NULL AND reply_to_message_id NOT IN (SELECT id FROM messages);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text,
	`user_id` integer,
	`plugin_id` text,
	`channel_id` integer NOT NULL,
	`parent_message_id` integer,
	`reply_to_message_id` integer,
	`editable` integer DEFAULT true,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`pinned` integer DEFAULT false,
	`pinned_at` integer,
	`pinned_by` integer,
	`edited_at` integer,
	`edited_by` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pinned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "content", "user_id", "plugin_id", "channel_id", "parent_message_id", "reply_to_message_id", "editable", "metadata", "created_at", "updated_at", "pinned", "pinned_at", "pinned_by", "edited_at", "edited_by") SELECT "id", "content", "user_id", "plugin_id", "channel_id", "parent_message_id", "reply_to_message_id", "editable", "metadata", "created_at", "updated_at", "pinned", "pinned_at", "pinned_by", "edited_at", "edited_by" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `messages_user_idx` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `messages_channel_idx` ON `messages` (`channel_id`);--> statement-breakpoint
CREATE INDEX `messages_created_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `messages_channel_created_idx` ON `messages` (`channel_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_parent_idx` ON `messages` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `messages_reply_to_idx` ON `messages` (`reply_to_message_id`);
--> statement-breakpoint
CREATE INDEX `messages_channel_parent_created_idx` ON `messages` (`channel_id`,`parent_message_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_single_row_idx` ON `settings` ((1));
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`type` text NOT NULL,
	`details` text,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_activity_log`("id", "user_id", "type", "details", "ip", "created_at") SELECT "id", "user_id", "type", "details", "ip", "created_at" FROM `activity_log`;--> statement-breakpoint
DROP TABLE `activity_log`;--> statement-breakpoint
ALTER TABLE `__new_activity_log` RENAME TO `activity_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `activity_log_user_idx` ON `activity_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_log_type_idx` ON `activity_log` (`type`);--> statement-breakpoint
CREATE INDEX `activity_log_created_idx` ON `activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `activity_log_user_created_idx` ON `activity_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_log_type_created_idx` ON `activity_log` (`type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `messages_parent_channel_id_idx` ON `messages` (`parent_message_id`,`channel_id`,`id`);
--> statement-breakpoint
ALTER TABLE `users` ADD `token_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DROP INDEX `activity_log_user_idx`;--> statement-breakpoint
DROP INDEX `activity_log_type_idx`;--> statement-breakpoint
DROP INDEX `channel_read_states_user_idx`;--> statement-breakpoint
DROP INDEX `channel_role_permissions_channel_idx`;--> statement-breakpoint
DROP INDEX `channel_role_permissions_allow_idx`;--> statement-breakpoint
DROP INDEX `channel_user_permissions_channel_idx`;--> statement-breakpoint
DROP INDEX `channel_user_permissions_allow_idx`;--> statement-breakpoint
DROP INDEX `channels_category_idx`;--> statement-breakpoint
DROP INDEX `invites_uses_idx`;--> statement-breakpoint
DROP INDEX `logins_user_idx`;--> statement-breakpoint
DROP INDEX `reaction_msg_idx`;--> statement-breakpoint
DROP INDEX `messages_channel_idx`;--> statement-breakpoint
DROP INDEX `role_permissions_role_idx`;--> statement-breakpoint
DROP INDEX `roles_is_default_idx`;--> statement-breakpoint
DROP INDEX `roles_is_persistent_idx`;--> statement-breakpoint
DROP INDEX `user_roles_user_idx`;--> statement-breakpoint
DROP INDEX `users_banned_idx`;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_channel_read_states` (
	`user_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`last_read_message_id` integer,
	`last_read_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `channel_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_channel_read_states`("user_id", "channel_id", "last_read_message_id", "last_read_at") SELECT "user_id", "channel_id", "last_read_message_id", "last_read_at" FROM `channel_read_states`;--> statement-breakpoint
DROP TABLE `channel_read_states`;--> statement-breakpoint
ALTER TABLE `__new_channel_read_states` RENAME TO `channel_read_states`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `channel_read_states_channel_idx` ON `channel_read_states` (`channel_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text,
	`user_id` integer,
	`plugin_id` text,
	`channel_id` integer NOT NULL,
	`parent_message_id` integer,
	`reply_to_message_id` integer,
	`editable` integer DEFAULT true,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`pinned` integer DEFAULT false,
	`pinned_at` integer,
	`pinned_by` integer,
	`edited_at` integer,
	`edited_by` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pinned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "content", "user_id", "plugin_id", "channel_id", "parent_message_id", "reply_to_message_id", "editable", "metadata", "created_at", "updated_at", "pinned", "pinned_at", "pinned_by", "edited_at", "edited_by") SELECT "id", "content", "user_id", "plugin_id", "channel_id", "parent_message_id", "reply_to_message_id", "editable", "metadata", "created_at", "updated_at", "pinned", "pinned_at", "pinned_by", "edited_at", "edited_by" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `messages_user_idx` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `messages_created_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `messages_channel_created_idx` ON `messages` (`channel_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_channel_parent_created_idx` ON `messages` (`channel_id`,`parent_message_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_parent_idx` ON `messages` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `messages_reply_to_idx` ON `messages` (`reply_to_message_id`);--> statement-breakpoint
CREATE INDEX `messages_parent_channel_id_idx` ON `messages` (`parent_message_id`,`channel_id`,`id`);
--> statement-breakpoint
ALTER TABLE `users` ADD `oidc_sub` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_oidc_sub_unique` ON `users` (`oidc_sub`);
--> statement-breakpoint
ALTER TABLE `users` ADD `password_set` integer DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE `oidc_handoffs` (
	`code` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`state` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oidc_handoffs_expires_idx` ON `oidc_handoffs` (`expires_at`);--> statement-breakpoint
CREATE TABLE `oidc_transactions` (
	`state` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`code_verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oidc_transactions_expires_idx` ON `oidc_transactions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `oidc_issuer` text;
--> statement-breakpoint
ALTER TABLE `plugin_data` ADD `version` text;
--> statement-breakpoint
CREATE TABLE `plugin_capabilities` (
	`plugin_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`mode` text DEFAULT 'public' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `type`, `name`)
);
--> statement-breakpoint
CREATE TABLE `plugin_capability_roles` (
	`plugin_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`role_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `type`, `name`, `role_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plugin_capability_roles_role_idx` ON `plugin_capability_roles` (`role_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`original_name` text NOT NULL,
	`md5` text NOT NULL,
	`user_id` integer,
	`plugin_id` text,
	`size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`extension` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_files`("id", "name", "original_name", "md5", "user_id", "size", "mime_type", "extension", "created_at", "updated_at") SELECT "id", "name", "original_name", "md5", "user_id", "size", "mime_type", "extension", "created_at", "updated_at" FROM `files`;--> statement-breakpoint
DROP TABLE `files`;--> statement-breakpoint
ALTER TABLE `__new_files` RENAME TO `files`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `files_name_unique` ON `files` (`name`);--> statement-breakpoint
CREATE INDEX `files_user_idx` ON `files` (`user_id`);--> statement-breakpoint
CREATE INDEX `files_md5_idx` ON `files` (`md5`);--> statement-breakpoint
CREATE INDEX `files_created_idx` ON `files` (`created_at`);--> statement-breakpoint
CREATE INDEX `files_name_idx` ON `files` (`name`);
--> statement-breakpoint
CREATE TABLE `plugin_user_data` (
	`plugin_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plugin_user_data_user_idx` ON `plugin_user_data` (`user_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message_reactions` (
	`message_id` integer NOT NULL,
	`user_id` integer,
	`plugin_id` text,
	`emoji` text NOT NULL,
	`file_id` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`, `emoji`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_message_reactions`("message_id", "user_id", "emoji", "file_id", "created_at") SELECT "message_id", "user_id", "emoji", "file_id", "created_at" FROM `message_reactions`;--> statement-breakpoint
DROP TABLE `message_reactions`;--> statement-breakpoint
ALTER TABLE `__new_message_reactions` RENAME TO `message_reactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `reaction_msg_emoji_plugin_unique_idx` ON `message_reactions` (`message_id`,`emoji`,`plugin_id`);--> statement-breakpoint
CREATE INDEX `reaction_emoji_idx` ON `message_reactions` (`emoji`);--> statement-breakpoint
CREATE INDEX `reaction_user_idx` ON `message_reactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `reaction_msg_emoji_idx` ON `message_reactions` (`message_id`,`emoji`);