ALTER TABLE `market_scan_runs` ADD COLUMN `completed_at` integer;
--> statement-breakpoint
ALTER TABLE `scan_batch_runs` ADD COLUMN `completed_at` integer;
--> statement-breakpoint
ALTER TABLE `scan_batch_runs` ADD COLUMN `data_through_session` text;
