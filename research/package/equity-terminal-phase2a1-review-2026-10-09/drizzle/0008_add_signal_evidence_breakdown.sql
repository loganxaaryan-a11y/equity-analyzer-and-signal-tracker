ALTER TABLE `market_scan_signals` ADD `factor_breakdown_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `market_scan_signals` ADD `invalidation_level` real;
--> statement-breakpoint
ALTER TABLE `market_scan_signals` ADD `source_url` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `factor_breakdown_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `invalidation_level` real;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `source_as_of` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `source_url` text;
