# Equity terminal Phase 2A.1 closure v2

Prepared 12 October 2026 from the existing completed checkout. This is a bounded chronology, baseline, freshness/display, evaluator, and readiness closure. It does not redesign a strategy, tune weights or indicators, relax a gate, open the holdout, or promote a candidate.

## Straight result

- The repaired research command reproduces 5,672 observations from the frozen 1,418-bar train/validation input.
- All four selection cells remain empty. The existing no-promotion decision is unchanged.
- The real holdout remains locked and unopened.
- The five-session equity trend still has 35 accepted mature issued events, but the repaired complete-block population contains 0 rows because the pooled equity grid has only 24 scheduled validation sessions and the registered block length is 30. No interval is available.
- Both 30-session equity products still have 0 accepted mature outcomes after purging.
- The synthetic pipeline positive passes through real feature, entry, and label construction. Fixed negative seeds produce 0/12 false qualifications. These are diagnostics, not market evidence.
- Longer-history strategy performance was not run. The readiness report blocks performance until a longer input, a full-period validated calendar, and one consistent corporate-action adjustment/revision policy are frozen.
- Timing performance was not run. `phase2a1-timing-protocol-review-v2.json` is review-only.

## What changed

1. Label maturity and fold eligibility use each endpoint bar's declared `availableAt`. A bar violating the registered fixed latency is rejected explicitly.
2. Feature date, actual decision time, split assignment, and selection time are explicit under `feature-date-partition-declared-availability-v2`.
3. Every SMA baseline uses its exact scheduled 200-bar lookback and checks each input at the decision cutoff. It never borrows an older survivor.
4. Candidate abstention and baseline eligibility are separate fields and filters.
5. The production and synthetic paths share `evaluateDatePanel`; interval grids are fold-specific or pooled-specific, and point means use the same complete-block population as the interval. Excluded tails and block coverage are reported.
6. Freshness is recalculated at read time from separate provider-event and last-success clocks. Future or missing provider timestamps fail closed. Unchanged successful fetches still update fetch health.
7. The cheap-feed OHLCV fields feed the current mark, chart overlay, and volume labels while analysis marks and issued levels remain immutable.
8. Barrier observations require eligible signal state, compatible venue/price basis, fresh content, and provider event time at or after issuance/entry cutoff. They remain non-authoritative.
9. The refresh worker accepts an injected provider, deterministic clock, and retry delay; 429s retry once, concurrent same-symbol triggers share one in-flight task, and refreshes do not call expensive analysis or mutate decision rows.

## What did not change

- Frozen original reports under `research/output/` retain their original bytes and names.
- Original input, registry, holdout boundaries, selection rules, strategy weights, indicators, issued history, and legacy scoreboard separation remain unchanged.
- No candidate qualifies.
- The current input's longer-history insufficiency remains; this package does not substitute synthetic data for market evidence.

## Reproduce

Runtime used: Bun 1.4.2 on Linux, TypeScript configurations in `client/`, `server/`, and `research/`.

```bash
bun install --frozen-lockfile
bun research/src/command.ts closure-validate
bun test server/src/measurement.test.ts server/src/phase1_2.integration.test.ts server/src/final_signoff.integration.test.ts server/src/freshness.test.ts research/src/harness.test.ts
bun x tsc --noEmit -p client/tsconfig.json
bun x tsc --noEmit -p server/tsconfig.json
bun x tsc --noEmit -p research/tsconfig.json
```

Observed local result: 156 passed, 0 failed across 10 files. The count includes the preserved prior package's duplicate executable tests discovered by Bun. All three typechecks exited 0. `closure-validate` exited 0 with 5,672 observations, positive synthetic diagnostic PASS, 0/12 negative false qualifications, and `holdout opened: false`.

## Scheduler and operational evidence

`equity-market-data-refresh` is configured, owned by this artifact, enabled, and scheduled every 15 minutes. The scheduler recorded ten consecutive successful direct action dispatches from 00:12:32 through 02:27:32 EDT on 12 October 2026. Those records prove dispatch completion only; they do not prove a controlled outage/recovery or inspect each resulting database write. A post-repair controlled production outage/recovery remains pending and is not represented by fixtures.

## Package map

- `source/` — client, server, research engine/CLI/tests, schema/migrations, package manifests, lockfile, configs.
- `inputs/` — frozen train/validation bars and trial registry. No real reserved holdout rows are added.
- `outputs/` — versioned closure-v2 report, observations, controls, readiness, timing review, and original preserved reports.
- `evidence/` — test/typecheck logs, scheduler evidence, finding map, and SHA-256 manifest.

See `FINDING-TO-EVIDENCE.md` and `MANIFEST.sha256`.
