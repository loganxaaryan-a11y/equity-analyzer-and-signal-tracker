CREATE TABLE `equity_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dedup_key` text NOT NULL,
	`symbol` text NOT NULL,
	`kind` text NOT NULL,
	`stage` text DEFAULT 'watch_alert' NOT NULL,
	`notification_class` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`reason_lines_json` text DEFAULT '[]' NOT NULL,
	`blocker_reason` text,
	`disclosure` text,
	`event_at` integer NOT NULL,
	`stored_at` integer NOT NULL,
	`expires_at` integer,
	`read_at` integer,
	`chat_sent_at` integer,
	`source_ref` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equity_notifications_dedup_key_unique` ON `equity_notifications` (`dedup_key`);
--> statement-breakpoint
CREATE INDEX `equity_notifications_stored_idx` ON `equity_notifications` (`stored_at`);
--> statement-breakpoint
CREATE INDEX `equity_notifications_read_idx` ON `equity_notifications` (`read_at`);
--> statement-breakpoint
CREATE INDEX `equity_notifications_symbol_idx` ON `equity_notifications` (`symbol`);
