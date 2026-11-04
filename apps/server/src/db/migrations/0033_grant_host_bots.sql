-- the owner role passes every check anyway, the row is there so the roles screen shows it.
-- a fresh database has no roles yet when migrations run, the seed grants it there
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission`, `created_at`) SELECT `id`, 'HOST_BOTS', unixepoch() * 1000 FROM `roles` WHERE `id` = 1;
