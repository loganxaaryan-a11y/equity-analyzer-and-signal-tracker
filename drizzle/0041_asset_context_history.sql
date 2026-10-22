CREATE TABLE `asset_profiles` (
  `symbol` text PRIMARY KEY NOT NULL,
  `canonical_name` text NOT NULL,
  `instrument_type` text NOT NULL,
  `instrument_detail` text NOT NULL,
  `description` text NOT NULL,
  `revenue_model` text NOT NULL,
  `source_title` text NOT NULL,
  `source_url` text NOT NULL,
  `source_as_of` text,
  `verified_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `asset_context_links` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `record_kind` text NOT NULL,
  `record_id` text NOT NULL,
  `stance` text NOT NULL,
  `evidence_class` text NOT NULL,
  `title` text NOT NULL,
  `summary` text NOT NULL,
  `source_title` text NOT NULL,
  `source_url` text,
  `observed_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_context_links_record_unique` ON `asset_context_links` (`symbol`,`record_kind`,`record_id`,`stance`);
--> statement-breakpoint
CREATE INDEX `asset_context_links_symbol_observed_idx` ON `asset_context_links` (`symbol`,`observed_at`);
--> statement-breakpoint
CREATE TABLE `asset_assessments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `assessment_kind` text NOT NULL,
  `source_record_kind` text,
  `source_record_id` text,
  `explanation_json` text NOT NULL,
  `evidence_json` text NOT NULL,
  `context_snapshot_json` text NOT NULL,
  `assessed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `asset_assessments_symbol_assessed_idx` ON `asset_assessments` (`symbol`,`assessed_at`);
--> statement-breakpoint
CREATE TABLE `asset_assessment_outcomes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `assessment_id` integer NOT NULL,
  `status` text NOT NULL,
  `summary` text NOT NULL,
  `evidence_json` text NOT NULL,
  `observed_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`assessment_id`) REFERENCES `asset_assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_assessment_outcomes_assessment_idx` ON `asset_assessment_outcomes` (`assessment_id`,`observed_at`);
