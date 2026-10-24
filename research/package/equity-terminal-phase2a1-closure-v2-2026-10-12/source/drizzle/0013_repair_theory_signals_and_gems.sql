ALTER TABLE `tracked_signals` ADD `bar_timestamp` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `bar_state` text NOT NULL DEFAULT 'closed';
--> statement-breakpoint
CREATE INDEX `tracked_signals_symbol_idx` ON `tracked_signals` (`symbol`);
--> statement-breakpoint
ALTER TABLE `theory_discovery_runs` ADD `originating_scan_run_id` integer REFERENCES `market_scan_runs`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `machine_theories` ADD `originating_scan_run_id` integer REFERENCES `market_scan_runs`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `engine_hits` ADD `kind` text NOT NULL DEFAULT 'hit';
--> statement-breakpoint
ALTER TABLE `engine_hits` ADD `symbol` text;
--> statement-breakpoint
ALTER TABLE `engine_hits` ADD `anomaly` text;
--> statement-breakpoint
ALTER TABLE `engine_hits` ADD `tags_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `engine_hits` ADD `evidence_strength` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `theory_layer_run_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer REFERENCES `theory_discovery_runs`(`id`) ON DELETE CASCADE,
  `layer_name` text NOT NULL,
  `agree_count` integer NOT NULL,
  `disagree_count` integer NOT NULL,
  `mixed_count` integer NOT NULL,
  `unavailable_count` integer NOT NULL,
  `fail_rate` real NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `theory_layer_run_logs_run_idx` ON `theory_layer_run_logs` (`run_id`);