ALTER TABLE `market_scan_runs` ADD `exclusions_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE TABLE `bls_monthly_cache` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `cache_month` text NOT NULL,
  `payload_json` text NOT NULL,
  `retrieved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bls_monthly_cache_month_unique` ON `bls_monthly_cache` (`cache_month`);