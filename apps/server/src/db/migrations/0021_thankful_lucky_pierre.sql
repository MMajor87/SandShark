CREATE TABLE `soundboard_sounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`file_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `soundboard_sounds_user_idx` ON `soundboard_sounds` (`user_id`);--> statement-breakpoint
CREATE INDEX `soundboard_sounds_file_idx` ON `soundboard_sounds` (`file_id`);