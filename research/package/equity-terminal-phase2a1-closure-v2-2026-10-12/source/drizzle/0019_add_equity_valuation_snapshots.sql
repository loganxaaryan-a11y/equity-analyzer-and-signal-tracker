CREATE TABLE `equity_valuation_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `yahoo_payload_json` text DEFAULT '{}' NOT NULL,
  `yahoo_source_url` text,
  `yahoo_fetched_at` integer,
  `keyed_as_of` text,
  `keyed_payload_json` text,
  `keyed_sources_json` text DEFAULT '[]' NOT NULL,
  `task_id` text,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equity_valuation_snapshots_symbol_unique` ON `equity_valuation_snapshots` (`symbol`);
--> statement-breakpoint
CREATE INDEX `equity_valuation_snapshots_updated_idx` ON `equity_valuation_snapshots` (`updated_at`);