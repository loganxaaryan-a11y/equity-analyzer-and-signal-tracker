CREATE TABLE `sentiment_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `articles_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sentiment_snapshots_ticker_unique` ON `sentiment_snapshots` (`ticker`);
--> statement-breakpoint
CREATE INDEX `sentiment_snapshots_as_of_idx` ON `sentiment_snapshots` (`as_of`);
--> statement-breakpoint
CREATE TABLE `sentiment_snapshot_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `articles_json` text NOT NULL,
  `captured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sentiment_snapshot_history_ticker_as_of_unique` ON `sentiment_snapshot_history` (`ticker`, `as_of`);
--> statement-breakpoint
CREATE INDEX `sentiment_snapshot_history_ticker_idx` ON `sentiment_snapshot_history` (`ticker`);
--> statement-breakpoint
CREATE TABLE `theory_sentiment_evidence` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `theory_kind` text NOT NULL,
  `theory_id` integer NOT NULL,
  `ticker` text NOT NULL,
  `snapshot_as_of` text NOT NULL,
  `title` text NOT NULL,
  `source_url` text NOT NULL,
  `published_at` text NOT NULL,
  `publisher` text NOT NULL,
  `overall_score` real NOT NULL,
  `overall_label` text NOT NULL,
  `ticker_score` real NOT NULL,
  `ticker_label` text NOT NULL,
  `stance` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `theory_sentiment_evidence_unique` ON `theory_sentiment_evidence` (`theory_kind`, `theory_id`, `ticker`, `snapshot_as_of`, `source_url`);
--> statement-breakpoint
CREATE INDEX `theory_sentiment_evidence_theory_idx` ON `theory_sentiment_evidence` (`theory_kind`, `theory_id`);