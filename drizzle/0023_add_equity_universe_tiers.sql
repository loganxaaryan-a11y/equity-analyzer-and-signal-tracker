CREATE TABLE `market_scan_universe_rows` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer NOT NULL,
  `symbol` text NOT NULL,
  `instrument_name` text NOT NULL,
  `sector` text NOT NULL,
  `universe_tier` text NOT NULL,
  `tracking_mode` text NOT NULL,
  `velocity_5d` real,
  `tier_reason` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `market_scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_scan_universe_rows_run_symbol_unique` ON `market_scan_universe_rows` (`run_id`,`symbol`);
--> statement-breakpoint
CREATE INDEX `market_scan_universe_rows_run_tier_idx` ON `market_scan_universe_rows` (`run_id`,`universe_tier`);