-- roles that could send voice reactions can play sounds, and roles that managed emojis manage the soundboard
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission`, `created_at`) SELECT `role_id`, 'USE_SOUNDBOARD', unixepoch() * 1000 FROM `role_permissions` WHERE `permission` = 'SEND_VOICE_REACTION';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission`, `created_at`) SELECT `role_id`, 'MANAGE_SOUNDBOARD', unixepoch() * 1000 FROM `role_permissions` WHERE `permission` = 'MANAGE_EMOJIS';
