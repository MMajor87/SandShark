CREATE TABLE `bots` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` integer,
	`token_updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bots_created_by_idx` ON `bots` (`created_by`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_bot` integer DEFAULT false NOT NULL;