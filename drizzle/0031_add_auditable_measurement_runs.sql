CREATE TABLE `measurement_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `terminal` text NOT NULL,
  `cohort_key` text NOT NULL,
  `evaluator_version` text NOT NULL,
  `source_commit` text NOT NULL,
  `status` text NOT NULL,
  `started_at` integer NOT NULL,
  `completed_at` integer,
  `updated_at` integer NOT NULL,
  `cutoff_at` text NOT NULL,
  `cursor` integer NOT NULL DEFAULT 0,
  `total_in_scope` integer NOT NULL,
  `retrieved` integer NOT NULL DEFAULT 0,
  `eligible_due` integer NOT NULL DEFAULT 0,
  `evaluated` integer NOT NULL DEFAULT 0,
  `pending` integer NOT NULL DEFAULT 0,
  `ambiguous` integer NOT NULL DEFAULT 0,
  `unverified` integer NOT NULL DEFAULT 0,
  `excluded` integer NOT NULL DEFAULT 0,
  `failed` integer NOT NULL DEFAULT 0,
  `revisions_inserted` integer NOT NULL DEFAULT 0,
  `membership_json` text NOT NULL,
  `failed_ids_json` text NOT NULL DEFAULT '[]',
  `definitions_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `measurement_runs_status_started_idx` ON `measurement_runs` (`status`,`started_at`);
