ALTER TABLE `market_scan_signals` ADD `confidence_tier` text NOT NULL DEFAULT 'low';
--> statement-breakpoint
ALTER TABLE `market_scan_signals` ADD `dimensions_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `market_scan_signals` ADD `research_required_json` text NOT NULL DEFAULT '[]';
