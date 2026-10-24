CREATE TABLE `theories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `statement` text NOT NULL,
  `horizon` text NOT NULL,
  `linked_tickers_json` text NOT NULL,
  `snapshot_prices_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `theory_predictions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `theory_id` integer NOT NULL,
  `ticker` text NOT NULL,
  `direction` text NOT NULL,
  `target_level` real,
  `due_date` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`theory_id`) REFERENCES `theories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `theory_ripples` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `theory_id` integer NOT NULL,
  `from_label` text NOT NULL,
  `to_label` text NOT NULL,
  `because` text NOT NULL,
  FOREIGN KEY (`theory_id`) REFERENCES `theories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `theory_evidence` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `theory_id` integer NOT NULL,
  `stance` text NOT NULL,
  `title` text NOT NULL,
  `source` text NOT NULL,
  `source_url` text NOT NULL,
  `published_at` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`theory_id`) REFERENCES `theories`(`id`) ON UPDATE no action ON DELETE cascade
);