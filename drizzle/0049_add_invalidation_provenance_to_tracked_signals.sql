ALTER TABLE `tracked_signals` ADD `room_to_breathe_atr` real;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `tight_invalidation` integer;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `invalidation_grade` text;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `provenance_incomplete` integer;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `provenance_reference_entry_price` real;
--> statement-breakpoint
ALTER TABLE `tracked_signals` ADD `provenance_source_as_of` text;
