ALTER TABLE `tracked_signals` ADD `target_1` real;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `target_2` real;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `strategy_id` text NOT NULL DEFAULT 'equity-factor-agreement';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `strategy_version` text NOT NULL DEFAULT 'legacy-pre-phase1';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `parameter_hash` text NOT NULL DEFAULT 'legacy-unversioned';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `build_id` text NOT NULL DEFAULT 'legacy-unversioned';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `decision_at` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `available_at` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `issued_at` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `entry_at` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `expires_at` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `input_snapshot_id` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `bar_start` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `bar_end` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `bar_is_closed` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `price_basis` text NOT NULL DEFAULT 'legacy-adjusted-daily';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `entry_rule` text NOT NULL DEFAULT 'legacy-recorded-entry';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `risk_per_unit` real;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `primary_horizon` integer NOT NULL DEFAULT 30;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `horizon_unit` text NOT NULL DEFAULT 'trading_sessions';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `feature_values_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `gate_results_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `score_definition` text NOT NULL DEFAULT 'legacy factor agreement';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `data_coverage` real NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `validation_status` text NOT NULL DEFAULT 'unverified';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `exchange_calendar` text NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `venue` text NOT NULL DEFAULT 'Yahoo Finance';
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `instrument_type` text NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
UPDATE `tracked_signals` SET `target_1` = CASE WHEN `invalidation_level` IS NULL THEN NULL WHEN `direction` = 'long' THEN `entry_price` + 1.5 * ABS(`entry_price` - `invalidation_level`) ELSE `entry_price` - 1.5 * ABS(`entry_price` - `invalidation_level`) END, `target_2` = CASE WHEN `invalidation_level` IS NULL THEN NULL WHEN `direction` = 'long' THEN `entry_price` + 2.5 * ABS(`entry_price` - `invalidation_level`) ELSE `entry_price` - 2.5 * ABS(`entry_price` - `invalidation_level`) END, `decision_at` = COALESCE(`bar_timestamp`, `signal_date` || 'T21:00:00.000Z'), `available_at` = COALESCE(`bar_timestamp`, `signal_date` || 'T21:00:00.000Z'), `issued_at` = strftime('%Y-%m-%dT%H:%M:%fZ', `created_at` / 1000, 'unixepoch'), `entry_at` = strftime('%Y-%m-%dT%H:%M:%fZ', `created_at` / 1000, 'unixepoch'), `risk_per_unit` = CASE WHEN `invalidation_level` IS NULL THEN NULL ELSE ABS(`entry_price` - `invalidation_level`) END, `feature_values_json` = `factor_breakdown_json`, `bar_end` = COALESCE(`bar_timestamp`, `signal_date` || 'T21:00:00.000Z'), `bar_start` = `signal_date` || 'T13:30:00.000Z';
--> statement-breakpoint
CREATE TABLE `signal_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `signal_id` integer NOT NULL REFERENCES `tracked_signals`(`id`) ON DELETE CASCADE,
  `event_type` text NOT NULL,
  `prior_event_id` integer,
  `reason` text NOT NULL,
  `payload_json` text NOT NULL,
  `content_hash` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_events_hash_unique` ON `signal_events` (`content_hash`);
--> statement-breakpoint
CREATE INDEX `signal_events_signal_idx` ON `signal_events` (`signal_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `strategy_trials` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `strategy_id` text NOT NULL,
  `strategy_version` text NOT NULL,
  `parameter_hash` text NOT NULL,
  `build_id` text NOT NULL,
  `status` text NOT NULL,
  `hypothesis` text NOT NULL,
  `result` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `strategy_trials_version_unique` ON `strategy_trials` (`strategy_id`, `strategy_version`);
--> statement-breakpoint
INSERT OR IGNORE INTO `strategy_trials` (`strategy_id`, `strategy_version`, `parameter_hash`, `build_id`, `status`, `hypothesis`, `result`, `created_at`) VALUES ('equity-factor-agreement', 'legacy-pre-phase1', 'legacy-unversioned', 'source-2fe3f356', 'frozen_baseline', 'Preserve the pre-repair seven-factor live model and 30-session directional replay as a named baseline.', 'Historical rows retained without rewriting; prior scorecard remains separate and provisional.', 1791475200000), ('equity-factor-agreement', '3.0.0-measurement', 'atr2-target1.5R-weights-6-8-8-20-8-20-20', 'phase1-2026-10-08', 'active_measurement', 'Repair signal identity, immutable issuance, stable factor IDs, frozen levels, and separate versioned reconciliation without changing factor weights.', 'Prospective measurement only; predictive value not established.', 1791475200000);
--> statement-breakpoint
CREATE TABLE `signal_evaluations_v2` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `signal_id` integer NOT NULL REFERENCES `tracked_signals`(`id`) ON DELETE CASCADE,
  `evaluation_version` text NOT NULL,
  `product` text NOT NULL,
  `old_verdict` text,
  `new_verdict` text NOT NULL,
  `reason` text NOT NULL,
  `evidence_json` text NOT NULL,
  `net_return_pct` real,
  `net_r` real,
  `evaluated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_evaluations_v2_unique` ON `signal_evaluations_v2` (`signal_id`, `evaluation_version`, `product`);
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD `eligible_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD `scored_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD `watched_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD `issued_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD `suppressed_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD `last_success_at` integer;
--> statement-breakpoint
ALTER TABLE `market_scan_runs` ADD `last_attempt_at` integer;
