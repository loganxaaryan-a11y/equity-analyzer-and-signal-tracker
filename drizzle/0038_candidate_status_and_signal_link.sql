ALTER TABLE `market_scan_signals` ADD COLUMN `status` text NOT NULL DEFAULT 'candidate';
--> statement-breakpoint
ALTER TABLE `market_scan_signals` ADD COLUMN `issued_signal_id` integer REFERENCES `tracked_signals`(`id`);
--> statement-breakpoint
CREATE INDEX `market_scan_signals_status_idx` ON `market_scan_signals` (`status`);
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD COLUMN `source_candidate_id` integer REFERENCES `market_scan_signals`(`id`);
--> statement-breakpoint
CREATE INDEX `tracked_signals_source_candidate_idx` ON `tracked_signals` (`source_candidate_id`);
