CREATE TABLE `machine_theories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `theory_key` text NOT NULL UNIQUE,
  `title` text NOT NULL,
  `thesis` text NOT NULL,
  `domain` text NOT NULL,
  `horizon` text NOT NULL,
  `status` text NOT NULL,
  `confidence_tier` text NOT NULL,
  `directional_pick` text NOT NULL,
  `primary_symbol` text NOT NULL,
  `rival_symbol` text,
  `causal_chain_json` text NOT NULL,
  `sector_outlook_json` text NOT NULL,
  `layers_json` text NOT NULL,
  `sources_json` text NOT NULL,
  `countercase` text NOT NULL,
  `invalidation_text` text NOT NULL,
  `invalidation_symbol` text,
  `invalidation_operator` text,
  `invalidation_level` real,
  `found_at` integer NOT NULL,
  `checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `theory_discovery_runs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `status` text NOT NULL,
  `note` text NOT NULL,
  `source_count` integer NOT NULL,
  `candidate_count` integer NOT NULL,
  `surfaced_count` integer NOT NULL,
  `started_at` integer NOT NULL,
  `finished_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `theory_source_cache` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `url` text NOT NULL UNIQUE,
  `title` text NOT NULL,
  `source` text NOT NULL,
  `snippet` text NOT NULL,
  `published_at` text,
  `retrieved_at` integer NOT NULL
);
