ALTER TABLE `market_scan_runs` ADD COLUMN `computed_at` integer;
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD COLUMN `data_through_session` text;
--> statement-breakpoint
CREATE TABLE `scan_run_state` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `universe` text NOT NULL,
  `trigger` text NOT NULL DEFAULT 'manual',
  `status` text NOT NULL,
  `started_at` integer NOT NULL,
  `heartbeat_at` integer NOT NULL,
  `deadline_at` integer NOT NULL,
  `completed_at` integer,
  `market_scan_run_id` integer,
  `note` text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX `scan_run_state_status_idx` ON `scan_run_state` (`status`,`started_at`);
