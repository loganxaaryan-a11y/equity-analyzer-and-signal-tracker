ALTER TABLE `measurement_runs` ADD COLUMN `batch_commit_journal_id` text;
--> statement-breakpoint
CREATE TABLE `measurement_batch_commit_journal` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `lease_token` text NOT NULL,
  `lease_version` integer NOT NULL,
  `mode` text NOT NULL,
  `before_cursor` integer NOT NULL,
  `after_cursor` integer NOT NULL,
  `requested_ids_json` text NOT NULL,
  `revisions_before` integer NOT NULL,
  `revisions_after` integer NOT NULL,
  `duplicate_evaluations` integer NOT NULL DEFAULT 0,
  `history_rows_rewritten` integer NOT NULL DEFAULT 0,
  `revision_identity_json` text NOT NULL DEFAULT '{}',
  `history_hash_before` text NOT NULL DEFAULT '',
  `history_hash_after` text NOT NULL DEFAULT '',
  `started_at` integer NOT NULL,
  `completed_at` integer NOT NULL,
  `note` text NOT NULL,
  `materialized_at` integer,
  FOREIGN KEY (`run_id`) REFERENCES `measurement_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `measurement_batch_journal_run_cursor_idx` ON `measurement_batch_commit_journal` (`run_id`,`after_cursor`);