ALTER TABLE `bot_ephemeral_messages` ADD `components` text;--> statement-breakpoint
ALTER TABLE `bot_interactions` ADD `message_id` integer REFERENCES messages(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `bot_interactions` ADD `ephemeral_message_id` integer REFERENCES bot_ephemeral_messages(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `messages` ADD `components` text;