ALTER TABLE `tracked_signals` ADD `entry_state` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `fill_rule_version` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `cost_scenario` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `fill_window_sessions` integer;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `fill_price` real;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `fill_session_date` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `fill_source` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `fill_recorded_at` integer;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `expiry_reason` text;
--> statement-breakpoint
CREATE INDEX `tracked_signals_fill_rule_idx` ON `tracked_signals` (`fill_rule_version`, `entry_state`);
