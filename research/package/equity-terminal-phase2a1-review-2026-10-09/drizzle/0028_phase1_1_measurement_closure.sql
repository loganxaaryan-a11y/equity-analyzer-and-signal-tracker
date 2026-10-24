ALTER TABLE `tracked_signals` ADD COLUMN `issuance_identity` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `tracked_signals_issuance_identity_unique` ON `tracked_signals` (`issuance_identity`);
--> statement-breakpoint
CREATE TABLE `signal_input_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `signal_id` integer NOT NULL REFERENCES `tracked_signals`(`id`) ON DELETE CASCADE,
  `available_through` text NOT NULL,
  `raw_inputs_json` text NOT NULL,
  `provider_metadata_json` text NOT NULL,
  `content_hash` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_input_snapshots_content_hash_unique` ON `signal_input_snapshots` (`content_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_input_snapshots_signal_unique` ON `signal_input_snapshots` (`signal_id`);
--> statement-breakpoint
CREATE TABLE `signal_evaluation_revisions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `signal_id` integer NOT NULL REFERENCES `tracked_signals`(`id`) ON DELETE CASCADE,
  `evaluator_version` text NOT NULL,
  `product` text NOT NULL,
  `cohort_key` text NOT NULL,
  `verdict` text NOT NULL,
  `reason_code` text NOT NULL,
  `reason` text NOT NULL,
  `evidence_identity` text NOT NULL,
  `evidence_json` text NOT NULL,
  `predecessor_revision_id` integer,
  `accepted` integer NOT NULL DEFAULT 1,
  `gross_return_pct` real,
  `gross_r` real,
  `modeled_net_return_pct` real,
  `modeled_net_r` real,
  `cost_status` text NOT NULL DEFAULT 'unknown',
  `cost_bps` real,
  `evaluated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_eval_revision_evidence_unique` ON `signal_evaluation_revisions` (`signal_id`, `evaluator_version`, `product`, `evidence_identity`);
--> statement-breakpoint
CREATE INDEX `signal_eval_revision_current_idx` ON `signal_evaluation_revisions` (`signal_id`, `product`, `accepted`, `evaluated_at`);