CREATE TABLE `engine_hits` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `hit_key` text NOT NULL,
  `hit_at` text NOT NULL,
  `test_case_label` text NOT NULL,
  `thesis` text NOT NULL,
  `trigger_event` text NOT NULL,
  `engine_score` integer NOT NULL,
  `confidence_tier` text NOT NULL,
  `tape_state` text NOT NULL,
  `twist` text NOT NULL,
  `evidence_json` text NOT NULL,
  `ripple_chain_json` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `engine_hits_hit_key_unique` ON `engine_hits` (`hit_key`);
