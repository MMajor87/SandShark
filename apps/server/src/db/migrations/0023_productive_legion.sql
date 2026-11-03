CREATE TABLE `calendar_event_responses` (
	`event_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `calendar_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_event_responses_user_idx` ON `calendar_event_responses` (`user_id`);--> statement-breakpoint
CREATE INDEX `calendar_events_ends_at_idx` ON `calendar_events` (`ends_at`);