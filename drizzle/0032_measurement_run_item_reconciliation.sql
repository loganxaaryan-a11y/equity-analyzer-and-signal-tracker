CREATE TABLE `measurement_run_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` text NOT NULL,
  `signal_id` integer NOT NULL,
  `ordinal` integer NOT NULL,
  `symbol` text,
  `retrieved` integer DEFAULT 0 NOT NULL,
  `eligible_due` integer DEFAULT 0 NOT NULL,
  `trade_state` text DEFAULT 'unknown' NOT NULL,
  `grading_state` text DEFAULT 'queued' NOT NULL,
  `evaluation_verdict` text,
  `reason_code` text DEFAULT 'awaiting_batch' NOT NULL,
  `reason` text DEFAULT 'Awaiting a bounded measurement batch.' NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `revisions_inserted` integer DEFAULT 0 NOT NULL,
  `evidence_identity_before` text,
  `evidence_identity_after` text,
  `last_batch_id` text,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `measurement_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_run_items_run_signal_unique` ON `measurement_run_items` (`run_id`,`signal_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_run_items_run_ordinal_unique` ON `measurement_run_items` (`run_id`,`ordinal`);
--> statement-breakpoint
CREATE INDEX `measurement_run_items_run_state_idx` ON `measurement_run_items` (`run_id`,`grading_state`);
--> statement-breakpoint
CREATE TABLE `measurement_run_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `mode` text NOT NULL,
  `before_cursor` integer NOT NULL,
  `after_cursor` integer NOT NULL,
  `requested_ids_json` text NOT NULL,
  `revisions_before` integer NOT NULL,
  `revisions_after` integer NOT NULL,
  `duplicate_evaluations` integer DEFAULT 0 NOT NULL,
  `history_rows_rewritten` integer DEFAULT 0 NOT NULL,
  `started_at` integer NOT NULL,
  `completed_at` integer NOT NULL,
  `note` text NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `measurement_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `measurement_run_batches_run_started_idx` ON `measurement_run_batches` (`run_id`,`started_at`);
