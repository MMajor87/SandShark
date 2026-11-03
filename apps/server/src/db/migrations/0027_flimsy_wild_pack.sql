CREATE TABLE `bot_ephemeral_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interaction_id` integer NOT NULL,
	`content` text NOT NULL,
	`loading` integer NOT NULL,
	`original` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`interaction_id`) REFERENCES `bot_interactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bot_ephemeral_messages_interaction_idx` ON `bot_ephemeral_messages` (`interaction_id`);--> statement-breakpoint
CREATE TABLE `bot_interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bot_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`command_name` text NOT NULL,
	`token_hash` text NOT NULL,
	`responded` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bot_interactions_token_hash_idx` ON `bot_interactions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `bot_interactions_created_idx` ON `bot_interactions` (`created_at`);--> statement-breakpoint
ALTER TABLE `messages` ADD `interaction_id` integer REFERENCES bot_interactions(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `messages` ADD `interaction_user_id` integer REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `messages` ADD `interaction_command_name` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `loading` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `messages_interaction_idx` ON `messages` (`interaction_id`);