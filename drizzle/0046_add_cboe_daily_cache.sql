CREATE TABLE `cboe_daily_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_day` text NOT NULL,
	`payload_json` text NOT NULL,
	`retrieved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cboe_daily_cache_cache_day_unique` ON `cboe_daily_cache` (`cache_day`);
