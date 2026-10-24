CREATE TABLE `market_scan_runs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `universe` text NOT NULL,
  `requested_count` integer NOT NULL,
  `scanned_count` integer NOT NULL,
  `available_count` integer NOT NULL,
  `signal_count` integer NOT NULL,
  `news_count` integer NOT NULL,
  `status` text NOT NULL,
  `note` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `market_scan_signals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer NOT NULL,
  `symbol` text NOT NULL,
  `instrument_name` text NOT NULL,
  `sector` text NOT NULL,
  `direction` text NOT NULL,
  `agreement_score` integer NOT NULL,
  `active_flags` integer NOT NULL,
  `return_15d` real,
  `volume_z` real,
  `rank_score` real NOT NULL,
  `why` text NOT NULL,
  `source_as_of` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `market_scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `market_scan_news` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer NOT NULL,
  `title` text NOT NULL,
  `source` text NOT NULL,
  `source_url` text NOT NULL,
  `published_at` text NOT NULL,
  `timestamp_kind` text NOT NULL,
  `why_it_matters` text NOT NULL,
  `ripples_json` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `market_scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sector_impacts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer NOT NULL,
  `sector` text NOT NULL,
  `direction` text NOT NULL,
  `evidence_score` integer NOT NULL,
  `headline` text NOT NULL,
  `reason` text NOT NULL,
  `source_count` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `market_scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
