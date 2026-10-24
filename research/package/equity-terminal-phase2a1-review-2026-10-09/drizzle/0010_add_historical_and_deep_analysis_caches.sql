CREATE TABLE `historical_caches` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `currency` text,
  `series_json` text NOT NULL,
  `source_url` text NOT NULL,
  `fetched_on` text NOT NULL,
  `fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `historical_caches_symbol_unique` ON `historical_caches` (`symbol`);
--> statement-breakpoint
CREATE TABLE `deep_analysis_caches` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `currency` text,
  `payload_json` text NOT NULL,
  `source_url` text NOT NULL,
  `fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deep_analysis_caches_symbol_unique` ON `deep_analysis_caches` (`symbol`);