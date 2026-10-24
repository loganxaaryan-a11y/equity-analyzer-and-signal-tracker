CREATE TABLE `finnhub_news_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `articles_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_news_snapshots_ticker_unique` ON `finnhub_news_snapshots` (`ticker`);
--> statement-breakpoint
CREATE INDEX `finnhub_news_snapshots_as_of_idx` ON `finnhub_news_snapshots` (`as_of`);
--> statement-breakpoint
CREATE TABLE `finnhub_news_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `payload_json` text NOT NULL,
  `captured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_news_history_key` ON `finnhub_news_history` (`ticker`,`as_of`);
--> statement-breakpoint
CREATE INDEX `finnhub_news_history_ticker_idx` ON `finnhub_news_history` (`ticker`);
--> statement-breakpoint
CREATE TABLE `finnhub_insider_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `transactions_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_insider_snapshots_ticker_unique` ON `finnhub_insider_snapshots` (`ticker`);
--> statement-breakpoint
CREATE INDEX `finnhub_insider_snapshots_as_of_idx` ON `finnhub_insider_snapshots` (`as_of`);
--> statement-breakpoint
CREATE TABLE `finnhub_insider_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `payload_json` text NOT NULL,
  `captured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_insider_history_key` ON `finnhub_insider_history` (`ticker`,`as_of`);
--> statement-breakpoint
CREATE INDEX `finnhub_insider_history_ticker_idx` ON `finnhub_insider_history` (`ticker`);
--> statement-breakpoint
CREATE TABLE `finnhub_earnings_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `as_of` text NOT NULL,
  `events_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_earnings_snapshots_symbol_unique` ON `finnhub_earnings_snapshots` (`symbol`);
--> statement-breakpoint
CREATE INDEX `finnhub_earnings_snapshots_as_of_idx` ON `finnhub_earnings_snapshots` (`as_of`);
--> statement-breakpoint
CREATE TABLE `finnhub_earnings_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `symbol` text NOT NULL,
  `as_of` text NOT NULL,
  `payload_json` text NOT NULL,
  `captured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_earnings_history_key` ON `finnhub_earnings_history` (`symbol`,`as_of`);
--> statement-breakpoint
CREATE INDEX `finnhub_earnings_history_symbol_idx` ON `finnhub_earnings_history` (`symbol`);
--> statement-breakpoint
CREATE TABLE `finnhub_filing_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `filings_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_filing_snapshots_ticker_unique` ON `finnhub_filing_snapshots` (`ticker`);
--> statement-breakpoint
CREATE INDEX `finnhub_filing_snapshots_as_of_idx` ON `finnhub_filing_snapshots` (`as_of`);
--> statement-breakpoint
CREATE TABLE `finnhub_filing_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticker` text NOT NULL,
  `as_of` text NOT NULL,
  `payload_json` text NOT NULL,
  `captured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finnhub_filing_history_key` ON `finnhub_filing_history` (`ticker`,`as_of`);
--> statement-breakpoint
CREATE INDEX `finnhub_filing_history_ticker_idx` ON `finnhub_filing_history` (`ticker`);
