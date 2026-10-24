CREATE TABLE `dossier_caches` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `trading_day` text NOT NULL,
  `payload_json` text NOT NULL,
  `generated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_caches_symbol_day_unique` ON `dossier_caches` (`symbol`, `trading_day`);
--> statement-breakpoint
CREATE INDEX `dossier_caches_generated_idx` ON `dossier_caches` (`generated_at`);
