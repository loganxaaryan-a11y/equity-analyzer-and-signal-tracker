CREATE TABLE `company_profiles` (
	`symbol` text PRIMARY KEY NOT NULL,
	`name` text,
	`sector` text,
	`industry` text,
	`description` text,
	`description_source_title` text,
	`description_source_url` text,
	`fetched_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
