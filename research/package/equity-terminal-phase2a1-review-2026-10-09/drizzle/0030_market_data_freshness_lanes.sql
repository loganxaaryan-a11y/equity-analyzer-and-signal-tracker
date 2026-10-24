CREATE TABLE `market_refresh_runs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `lane` text NOT NULL,
  `trigger` text NOT NULL,
  `status` text NOT NULL,
  `requested_count` integer NOT NULL,
  `refreshed_count` integer DEFAULT 0 NOT NULL,
  `stale_count` integer DEFAULT 0 NOT NULL,
  `error_count` integer DEFAULT 0 NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `started_at` integer NOT NULL,
  `finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `market_refresh_runs_lane_idx` ON `market_refresh_runs` (`lane`,`started_at`);
--> statement-breakpoint
CREATE TABLE `market_observations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer,
  `symbol` text NOT NULL,
  `market_kind` text NOT NULL,
  `observation_kind` text NOT NULL,
  `venue` text NOT NULL,
  `quote_currency` text,
  `source` text NOT NULL,
  `source_url` text NOT NULL,
  `event_at` text NOT NULL,
  `received_at` integer NOT NULL,
  `candle_state` text NOT NULL,
  `price` real,
  `open` real,
  `high` real,
  `low` real,
  `close` real,
  `volume` real,
  `correction_version` integer DEFAULT 1 NOT NULL,
  `prior_observation_id` integer,
  `content_hash` text NOT NULL,
  `raw_trace_json` text NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `market_refresh_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_observations_content_hash_unique` ON `market_observations` (`content_hash`);
--> statement-breakpoint
CREATE INDEX `market_observations_symbol_kind_event_idx` ON `market_observations` (`symbol`,`observation_kind`,`event_at`);
--> statement-breakpoint
CREATE INDEX `market_observations_received_idx` ON `market_observations` (`received_at`);
--> statement-breakpoint
CREATE TABLE `market_refresh_state` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `observation_kind` text NOT NULL,
  `latest_observation_id` integer,
  `status` text NOT NULL,
  `last_attempt_at` integer NOT NULL,
  `last_success_at` integer,
  `error` text,
  `next_retry_at` integer,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`latest_observation_id`) REFERENCES `market_observations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_refresh_state_symbol_kind_unique` ON `market_refresh_state` (`symbol`,`observation_kind`);
--> statement-breakpoint
CREATE TABLE `signal_status_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `signal_id` integer NOT NULL,
  `observation_id` integer NOT NULL,
  `status` text NOT NULL,
  `settlement` text NOT NULL,
  `observed_at` integer NOT NULL,
  `support_json` text NOT NULL,
  `dedup_key` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`signal_id`) REFERENCES `tracked_signals`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`observation_id`) REFERENCES `market_observations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_status_events_dedup_key_unique` ON `signal_status_events` (`dedup_key`);
--> statement-breakpoint
CREATE INDEX `signal_status_events_signal_idx` ON `signal_status_events` (`signal_id`,`observed_at`);
