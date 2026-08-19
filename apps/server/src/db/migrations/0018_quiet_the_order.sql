CREATE TABLE `calendar_event_invitees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer,
	`role_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `calendar_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_event_invitees_user_idx` ON `calendar_event_invitees` (`user_id`);--> statement-breakpoint
CREATE INDEX `calendar_event_invitees_role_idx` ON `calendar_event_invitees` (`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_event_invitees_user_unique_idx` ON `calendar_event_invitees` (`event_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_event_invitees_role_unique_idx` ON `calendar_event_invitees` (`event_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`creator_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_events_starts_at_idx` ON `calendar_events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `calendar_events_creator_idx` ON `calendar_events` (`creator_id`);