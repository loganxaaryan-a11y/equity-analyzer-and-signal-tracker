CREATE TABLE `discovery_lane_runs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `lane_version` text NOT NULL,
  `status` text NOT NULL,
  `universe_broad_count` integer NOT NULL,
  `universe_smallcap_count` integer NOT NULL,
  `screened_count` integer NOT NULL,
  `t2_count` integer NOT NULL,
  `t3_count` integer NOT NULL,
  `unverified_count` integer NOT NULL DEFAULT 0,
  `excluded_count` integer NOT NULL,
  `yahoo_requests` integer NOT NULL,
  `v8_verifications` integer NOT NULL DEFAULT 0,
  `alpha_vantage_calls` integer NOT NULL DEFAULT 0,
  `note` text NOT NULL,
  `started_at` integer NOT NULL,
  `completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `discovery_lane_rows` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer NOT NULL,
  `symbol` text NOT NULL,
  `instrument_name` text NOT NULL,
  `sector` text NOT NULL DEFAULT 'Unclassified',
  `segment` text NOT NULL,
  `tier` text NOT NULL,
  `tracking_mode` text NOT NULL,
  `categories_json` text NOT NULL DEFAULT '[]',
  `price` real,
  `dollar_volume_20d` real,
  `prev_close_return_pct` real,
  `intraday_return_pct` real,
  `rel_volume` real,
  `return_z` real,
  `exchange` text,
  `instrument_type` text,
  `data_source` text NOT NULL DEFAULT 'Yahoo Finance (keyless)',
  `observed_at` integer,
  `reason` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `discovery_lane_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `discovery_lane_liquidity` (
  `symbol` text PRIMARY KEY NOT NULL,
  `avg_dollar_volume_20d` real,
  `avg_volume_20d` real,
  `bars` integer NOT NULL DEFAULT 0,
  `computed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovery_lane_rows_run_symbol_unique` ON `discovery_lane_rows` (`run_id`, `symbol`);
--> statement-breakpoint
CREATE INDEX `discovery_lane_rows_run_tier_idx` ON `discovery_lane_rows` (`run_id`, `tier`);
