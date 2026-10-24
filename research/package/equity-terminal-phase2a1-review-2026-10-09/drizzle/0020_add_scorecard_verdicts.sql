CREATE TABLE `scorecard_verdicts` (
  `signal_id` integer PRIMARY KEY NOT NULL,
  `verdict` text NOT NULL,
  `graded_date` text NOT NULL,
  `evidence` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`signal_id`) REFERENCES `tracked_signals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scorecard_verdicts_verdict_idx` ON `scorecard_verdicts` (`verdict`);
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 6, 'MISS', '2026-10-05', 'Invalidation 368.89 touched first on the 2026-10-02 print at 370.59; target 1 at 335.92 was never approached.', 1791237600000, 1791237600000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 6 AND `symbol` = 'TSLA')
ON CONFLICT (`signal_id`) DO NOTHING;
