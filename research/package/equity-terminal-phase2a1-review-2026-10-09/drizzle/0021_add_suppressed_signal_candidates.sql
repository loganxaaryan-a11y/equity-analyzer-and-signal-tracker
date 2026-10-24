CREATE TABLE `suppressed_signal_candidates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `instrument_name` text NOT NULL,
  `setup_type` text NOT NULL,
  `direction` text NOT NULL,
  `agreement_score` integer NOT NULL,
  `entry_price` real NOT NULL,
  `invalidation_level` real NOT NULL,
  `signal_date` text NOT NULL,
  `signal_day_low` real,
  `signal_day_high` real,
  `reason` text NOT NULL,
  `origin` text NOT NULL,
  `source_as_of` text NOT NULL,
  `source_url` text NOT NULL,
  `context_json` text DEFAULT '{}' NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppressed_signal_candidates_unique` ON `suppressed_signal_candidates` (`symbol`,`signal_date`,`reason`,`origin`);
--> statement-breakpoint
CREATE INDEX `suppressed_signal_candidates_date_idx` ON `suppressed_signal_candidates` (`signal_date`);