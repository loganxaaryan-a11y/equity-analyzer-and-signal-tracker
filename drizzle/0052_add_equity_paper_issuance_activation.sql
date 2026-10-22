CREATE TABLE `equity_paper_issuance_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`halted` integer DEFAULT false NOT NULL,
	`halt_reason` text,
	`halted_at` integer,
	`lease_token` text,
	`lease_expires_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `equity_paper_issuance_passes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`captured_day` text NOT NULL,
	`batch_run_id` integer,
	`batch_id` integer,
	`reconcile_ok` integer NOT NULL,
	`halted` integer NOT NULL,
	`halt_reason` text,
	`halt_cleared` integer DEFAULT false NOT NULL,
	`created_json` text DEFAULT '[]' NOT NULL,
	`skipped_capacity_json` text DEFAULT '[]' NOT NULL,
	`skipped_duplicates_json` text DEFAULT '[]' NOT NULL,
	`declined_json` text DEFAULT '[]' NOT NULL,
	`cohort_filled` integer DEFAULT 0 NOT NULL,
	`cohort_pending` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equity_paper_issuance_passes_day_idx` ON `equity_paper_issuance_passes` (`captured_day`);
