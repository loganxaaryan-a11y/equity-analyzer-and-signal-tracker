CREATE TABLE `scan_batch_runs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `universe` text NOT NULL,
  `run_id` integer NOT NULL,
  `symbol_list_json` text NOT NULL,
  `processed_count` integer NOT NULL DEFAULT 0,
  `stage` text NOT NULL DEFAULT 'open',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `market_scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scan_batch_runs_universe_stage_idx` ON `scan_batch_runs` (`universe`, `stage`);
--> statement-breakpoint
CREATE UNIQUE INDEX `scan_batch_runs_run_id_unique` ON `scan_batch_runs` (`run_id`);
--> statement-breakpoint
CREATE TABLE `scan_batch_symbol_results` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `batch_run_id` integer NOT NULL,
  `symbol` text NOT NULL,
  `gate_json` text NOT NULL,
  `issuance_json` text NOT NULL,
  `rank_score` real NOT NULL,
  `completed_at` integer NOT NULL,
  FOREIGN KEY (`batch_run_id`) REFERENCES `scan_batch_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scan_batch_symbol_results_batch_symbol_unique` ON `scan_batch_symbol_results` (`batch_run_id`, `symbol`);
--> statement-breakpoint
CREATE INDEX `scan_batch_symbol_results_batch_completed_idx` ON `scan_batch_symbol_results` (`batch_run_id`, `completed_at`);