CREATE TABLE `market_scan_symbol_diagnostics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer NOT NULL,
  `symbol` text NOT NULL,
  `stage` text NOT NULL,
  `outcome` text NOT NULL,
  `reason_code` text NOT NULL,
  `reason` text NOT NULL,
  `provider_status` integer,
  `resolved_symbol` text,
  `source_url` text,
  `provider_event_at` text,
  `attempted_at` integer NOT NULL,
  `completed_at` integer,
  FOREIGN KEY (`run_id`) REFERENCES `market_scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_scan_symbol_diagnostics_run_symbol_unique` ON `market_scan_symbol_diagnostics` (`run_id`,`symbol`);
--> statement-breakpoint
CREATE INDEX `market_scan_symbol_diagnostics_run_outcome_idx` ON `market_scan_symbol_diagnostics` (`run_id`,`outcome`);
--> statement-breakpoint
CREATE TABLE `market_refresh_rotation` (
  `lane` text PRIMARY KEY NOT NULL,
  `cursor` integer NOT NULL DEFAULT 0,
  `universe_hash` text NOT NULL,
  `last_batch_json` text NOT NULL DEFAULT '[]',
  `updated_at` integer NOT NULL
);