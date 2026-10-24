ALTER TABLE `theory_discovery_runs` ADD `withheld_floor_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `theory_discovery_runs` ADD `contested_count` integer NOT NULL DEFAULT 0;
