CREATE TABLE `eq2_shadow_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`run_id` integer,
	`batch_run_id` integer,
	`evaluation_path` text NOT NULL,
	`factors_json` text NOT NULL,
	`s20` integer NOT NULL,
	`s50` integer NOT NULL,
	`s200` integer NOT NULL,
	`rsi_score` integer NOT NULL,
	`macd_score` integer NOT NULL,
	`volume_score` integer NOT NULL,
	`trend_score` integer NOT NULL,
	`total_weight` real NOT NULL,
	`production_weighted_sum` real NOT NULL,
	`production_raw_score` integer NOT NULL,
	`redundancy_adjustment` integer NOT NULL,
	`production_signal_score` integer NOT NULL,
	`t_value` integer NOT NULL,
	`a_value` integer NOT NULL,
	`c_value` real NOT NULL,
	`triple_contribution` real NOT NULL,
	`shadow_raw_score` real NOT NULL,
	`shadow_total` integer NOT NULL,
	`production_disposition` text NOT NULL,
	`shadow_disposition` text NOT NULL,
	`divergent` integer NOT NULL,
	`divergence_reason` text NOT NULL,
	`scan_gate_direction` text,
	`scan_issuance_allowed` integer,
	`evaluator_version` text NOT NULL,
	`strategy_version` text NOT NULL,
	`parameter_hash` text NOT NULL,
	`source_as_of` text,
	`session_date` text,
	`evaluated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `eq2_shadow_assessments_created_idx` ON `eq2_shadow_assessments` (`created_at`);
--> statement-breakpoint
CREATE INDEX `eq2_shadow_assessments_run_idx` ON `eq2_shadow_assessments` (`run_id`);
--> statement-breakpoint
CREATE INDEX `eq2_shadow_assessments_symbol_idx` ON `eq2_shadow_assessments` (`symbol`);
