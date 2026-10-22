INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 3, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — AAPL long, score 50, signalDate 2026-10-01. target1 340.38500915527345 touched first on 2026-10-08; entry 328.9100036621094, inv 321.26; close return 3.6667%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 3)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 5, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — NVDA long, score 85, signalDate 2026-10-01. target1 240.15501678466796 touched first on 2026-10-06; entry 230.2100067138672, inv 223.58; close return -1.6898%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 5)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 6, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — TSLA short, score -5, signalDate 2026-10-01. invalidation 368.89 touched first on 2026-10-02; entry 355.70001220703125, t1 335.91503051757815; close return -6.2778%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 6)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 8, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — CL=F long, score 50, signalDate 2026-10-01. invalidation 87.12 touched first on 2026-10-06; entry 93.2699966430664, t1 102.494991607666; close return -1.2973%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 8)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 9, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — SI=F short, score -80, signalDate 2026-10-01. target1 58.07250343322754 touched first on 2026-10-14; entry 61.185001373291016, inv 63.26; close return 7.0687%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 9)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 10, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — IWM short, score -40, signalDate 2026-10-01. invalidation 283.47 touched first on 2026-10-02; entry 279.010009765625, t1 272.32002441406246; close return 0.3978%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 10)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 12, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — HD short, score -95, signalDate 2026-10-01. invalidation 290.82 touched first on 2026-10-08; entry 282.4599914550781, t1 269.9199786376953; close return -2.8889%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 12)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 13, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — AMGN long, score 10, signalDate 2026-10-01. target1 426.9649725341797 touched first on 2026-10-14; entry 407.2699890136719, inv 394.14; close return 4.6259%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 13)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 15, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — AMD long, score 85, signalDate 2026-10-01. invalidation 586 touched first on 2026-10-13; entry 615.72998046875, t1 660.324951171875; close return -1.6566%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 15)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 16, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — CRM long, score 50, signalDate 2026-09-30. target1 246.38501831054685 touched first on 2026-10-15; entry 229.57000732421875, inv 218.36; close return 7.4792%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 16)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 17, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — AAPL long, score 75, signalDate 2026-09-30. target1 346.62497253417973 touched first on 2026-10-13; entry 333.0199890136719, inv 323.95; close return 2.4773%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 17)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 18, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — TECHM.NS short, score -40, signalDate 2026-10-01. target1 1462.065 touched first on 2026-10-12; entry 1533, inv 1580.29; close return -0.6849%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 18)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 19, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — RELIANCE.NS short, score -95, signalDate 2026-10-01. invalidation 1192.8 touched first on 2026-10-05; entry 1167.699951171875, t1 1130.0498779296877; close return 0.0856%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 19)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 20, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — JIOFIN.NS short, score -85, signalDate 2026-10-01. invalidation 218.28 touched first on 2026-10-06; entry 212.5, t1 203.83; close return -2.4941%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 20)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 21, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — ADANIENT.NS short, score -50, signalDate 2026-10-01. target1 2654.065122070313 touched first on 2026-10-08; entry 2816.800048828125, inv 2925.29; close return 4.3241%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 21)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 22, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — PLTR long, score 85, signalDate 2026-09-30. target1 198.93000762939457 touched first on 2026-10-08; entry 187.0500030517578, inv 179.13; close return 11.7348%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 22)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 23, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — SPY long, score 25, signalDate 2026-09-30. target1 775.1700122070313 touched first on 2026-10-05; entry 762.6300048828125, inv 754.27; close return 2.0285%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 23)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 24, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — SUI short, score -85, signalDate 2026-10-01. invalidation 112.91 touched first on 2026-10-06; entry 110, t1 105.635; close return -4.0545%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 24)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 25, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — NVDA long, score 85, signalDate 2026-09-30. target1 239.57001220703125 touched first on 2026-10-05; entry 228.3800048828125, inv 220.92; close return -4.8822%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 25)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 26, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — COST short, score -50, signalDate 2026-10-01. invalidation 934.9 touched first on 2026-10-06; entry 914.9400024414062, t1 885.0000061035157; close return -4.8637%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 26)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 27, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — 6411.TWO long, score 5, signalDate 2026-10-02. invalidation 76.32 touched first on 2026-10-13; entry 78.4000015258789, t1 81.52000381469728; close return -1.9133%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 27)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 28, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — AMZN short, score -50, signalDate 2026-10-01. invalidation 255.3 touched first on 2026-10-06; entry 248.22999572753903, t1 237.62498931884764; close return -4.5522%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 28)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 29, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — INTC long, score 85, signalDate 2026-10-01. invalidation 112.41 touched first on 2026-10-06; entry 120, t1 131.385; close return -15.5417%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 29)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 30, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — TCS.NS short, score -85, signalDate 2026-10-01. invalidation 2146.63 touched first on 2026-10-09; entry 2075, t1 1967.555; close return -9.3639%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 30)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 32, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — SI=F short, score -80, signalDate 2026-10-02. target1 58.46999542236328 touched first on 2026-10-14; entry 61.16999816894531, inv 62.97; close return 7.0459%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 32)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 33, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — PTIR long, score 85, signalDate 2026-10-01. target1 24.20500190734863 touched first on 2026-10-08; entry 21.700000762939453, inv 20.03; close return 20.2765%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 33)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 34, 'HIT', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): HIT — PLTR long, score 85, signalDate 2026-10-01. target1 201.76998321533205 touched first on 2026-10-08; entry 190.0399932861328, inv 182.22; close return 9.9769%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 34)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 35, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — MDT short, score -75, signalDate 2026-10-01. invalidation 89.09 touched first on 2026-10-09; entry 86.44000244140625, t1 82.46500610351562; close return -6.3512%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 35)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 36, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — BSE.NS short, score -85, signalDate 2026-10-01. invalidation 3178.89 touched first on 2026-10-05; entry 3046, t1 2846.665; close return -10.8142%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 36)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 37, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — CL short, score -85, signalDate 2026-10-01. invalidation 86.42 touched first on 2026-10-06; entry 84.52999877929688, t1 81.69499694824219; close return -6.4474%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 37)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 39, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — COPA short, score -50, signalDate 2026-10-01. invalidation 53.43 touched first on 2026-10-06; entry 51.76800155639648, t1 49.275003890991215; close return -1.4159%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 39)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 41, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — 0221.KL long, score 10, signalDate 2026-10-02. invalidation 0.08 touched first on 2026-10-12; entry 0.08500000089406967, t1 0.09250000223517418; close return -5.8824%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 41)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 42, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — CL=F long, score 50, signalDate 2026-10-02. invalidation 87.22 touched first on 2026-10-06; entry 92.69000244140624, t1 100.89500610351564; close return -0.6797%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 42)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 43, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — VEDL.NS short, score -95, signalDate 2026-10-01. invalidation 260.94 touched first on 2026-10-06; entry 252.0500030517578, t1 238.7150076293945; close return -1.6862%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 43)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 44, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — HG=F short, score -15, signalDate 2026-10-01. invalidation 6.61 touched first on 2026-10-06; entry 6.48199987411499, t1 6.289999685287475; close return -4.2888%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 44)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 45, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — PEP short, score -75, signalDate 2026-10-01. invalidation 128.61 touched first on 2026-10-08; entry 125.5999984741211, t1 121.08499618530271; close return -0.8599%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 45)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 47, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — WMT short, score -85, signalDate 2026-10-01. invalidation 107.06 touched first on 2026-10-06; entry 104.26000213623048, t1 100.06000534057615; close return -8.4596%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 47)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 48, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — MDLZ short, score -85, signalDate 2026-10-01. invalidation 59.27 touched first on 2026-10-06; entry 57.7599983215332, t1 55.49499580383301; close return -6.9772%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 48)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 50, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — EMR long, score 56, signalDate 2026-10-02. invalidation 156.65 touched first on 2026-10-08; entry 161.61, t1 169.05; close return 0.526%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 50)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 51, 'MISS', '2026-10-16', 'Retrospective review 2026-10-16 (first-touch Yahoo daily bars): MISS — BTC-USD long, score 73, signalDate 2026-10-05. invalidation 83519.63 touched first on 2026-10-07; entry 86241.38, t1 90324.005; close return -3.1461%. Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 51)
ON CONFLICT (`signal_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `scorecard_verdicts` (`signal_id`, `verdict`, `graded_date`, `evidence`, `created_at`, `updated_at`)
SELECT 230, 'HIT', '2026-10-18', 'Retrospective review 2026-10-18: WMT +5.81% — ''the one clean win''. Signal details brief-sourced; UNVERIFIED from saved action reads (tracker pages only reach id 52). Legacy review record — retrospective, not machine evaluation.', 1760918400000, 1760918400000
WHERE EXISTS (SELECT 1 FROM `tracked_signals` WHERE `id` = 230)
ON CONFLICT (`signal_id`) DO NOTHING;
