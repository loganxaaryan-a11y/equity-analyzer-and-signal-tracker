CREATE TABLE `equity_alert_outbox` (
  `dedup_key` text PRIMARY KEY NOT NULL,
  `symbol` text NOT NULL,
  `kind` text NOT NULL,
  `stage` text NOT NULL DEFAULT 'watch_alert',
  `state` text NOT NULL DEFAULT 'queued',
  `channel` text,
  `enqueued_at` integer NOT NULL,
  `delivered_at` integer,
  `error` text,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equity_alert_outbox_state_idx` ON `equity_alert_outbox` (`state`);
