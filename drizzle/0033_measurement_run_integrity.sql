ALTER TABLE `measurement_runs` ADD `lease_token` text;
--> statement-breakpoint
ALTER TABLE `measurement_runs` ADD `lease_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `measurement_runs` ADD `lease_version` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `measurement_run_batches` ADD `revision_identity_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `measurement_run_batches` ADD `history_hash_before` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `measurement_run_batches` ADD `history_hash_after` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `measurement_run_batches` ADD `cursor_commit` text NOT NULL DEFAULT 'committed';
