ALTER TABLE `machine_theories` ADD `expected_direction` text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE `machine_theories` ADD `invalidation_creation_price` real;
--> statement-breakpoint
ALTER TABLE `machine_theories` ADD `source_integrity` text NOT NULL DEFAULT 'single_source';
--> statement-breakpoint
ALTER TABLE `machine_theories` ADD `independent_source_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `machine_theories` ADD `integrity_note` text NOT NULL DEFAULT 'Pending integrity audit';
--> statement-breakpoint
ALTER TABLE `machine_theories` ADD `integrity_audited_at` integer;
