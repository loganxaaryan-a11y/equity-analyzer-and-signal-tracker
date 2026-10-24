# Phase 1.2 integration closure audit — equity terminal

Date: 2026-10-09

## Scope and identifiers

- Strategy: `equity-factor-agreement`
- Strategy version: `3.1.0-measurement-closure`
- Parameter hash: `atr2-target1.5R-weights-6-8-8-20-8-20-20`
- Evaluator: `equity-eval-3.2.0`
- Build/source identity: `phase1.2-2026-10-09`
- Product cohort: 30 trading sessions; Yahoo adjusted OHLC research reference; research-only reference entry; execution costs unknown.
- No weights, indicators, decision thresholds, or Phase 2 strategy work were added.

## Findings → production fix → evidence

| Review item | Production path | Evidence |
|---|---|---|
| Daily job called a no-op | `runDailySignalPostmortem` → `computeDailySignalSnapshots` → `reconcileSignalHistory` | Builder-sandbox real action run completed on 50 copied rows; first run after stable evidence-identity correction wrote 100 evaluation rows, identical retry wrote 0. |
| Daily evidence fetch was too slow | `reconcileSignalHistory` refreshes each unique symbol once, concurrently, and shares that evidence across signal rows | Initial real action probe exceeded 120s; corrected build completed within the action timeout. |
| Idempotency depended on volatile provider URL | `appendEvaluationRevision` hashes input snapshot id, expected/observed sessions, and evaluator result—not Yahoo's changing request URL | Consecutive current-build action results: `settlementUpdatedRows: 100`, then `0`; `settlementFilledHorizons: 100`, then `0`. |
| Replay returned stored outputs | `computeEquityDecisionFromRawInputs` recomputes SMA 20/50/200, Wilder RSI-14, MACD 12–26, ATR-14, volume z, ATR-adjusted trend, weighted agreement, direction, score, and levels. `deterministicReplaySnapshot` compares reconstructed values to saved targets. | `phase1_2.integration.test.ts`: untouched input matches; relevant raw change and saved-output change create field mismatches; post-decision input has no effect. |
| Unavailable forecast evidence consumed | `evaluateEquityDirectionForecast` checks `availableAt <= evaluatedAt` | Module fixture passes with `OPEN / evidence_not_yet_available`. |
| Entry inside session skipped unobserved path | `evaluateEquityTradeSetup` returns `UNVERIFIED / entry_session_path_unobserved` | Module fixture passes. |
| Calendar extrapolated beyond validated years | XNYS adapter fails closed outside 2025–2027 | Module fixture passes. |
| Metrics mixed evaluation populations | Active cohort key includes strategy id/version, parameter hash, product, horizon/unit, evaluator, price convention, entry rule, and cost identity; reads filter through `isActiveCohortSignal` and `acceptedEvaluationRevisionsForCohort` | Mixed-cohort integration fixture admits only the exact key. Sandbox tracker/export exposes the cohort descriptor and honest zero denominators for the current cohort; legacy rows remain visible separately. |
| Headline mixed legacy cards with current-cohort zero count | Home now labels preserved cards as `LEGACY SIGNAL LEDGER`; postmortem is labeled `PHASE 1.2 COHORT POST-MORTEM` | Current source and final audit capture. |
| Replay action overstated legacy rows | `replaySignalSnapshot` reports reconstruction availability/status plus field mismatches; rows without reconstructable snapshots are unavailable | Source/typecheck coverage. |
| Platform v25 PDF.js upgrade | Not applicable: client has no iframe/embed/object displaying a blob-backed PDF | Client grep returned no matches; client and server typechecks pass. |

## Exact checks and actual results

Full captured output: `PHASE1_2_TEST_RESULTS.txt`.

```text
$ bun test server/src/measurement.test.ts
20 pass, 0 fail, 57 expect() calls

$ bun test server/src/phase1_2.integration.test.ts
5 pass, 0 fail, 13 expect() calls

$ bun x tsc --noEmit -p server/tsconfig.json
exit: 0

$ bun x tsc --noEmit -p client/tsconfig.json
exit: 0
```

A later combined rerun after the runtime idempotency correction returned 25 pass, 0 fail, 70 assertions. The managed web-artifact build also succeeded.

### Existing acceptance suite

The equity module suite now has 20 passing tests (the previous 17 plus the two Phase 1.2 time-contract fixtures and calendar fail-closed coverage). This builder did not rerun the crypto project's 17 tests because this artifact is the equity terminal; no claim is made about a fresh crypto run in this report.

## Daily-action runtime integration result

The actual published action handler was invoked against the isolated builder copy of the artifact database, not production:

1. The first pre-optimization action call timed out at 120 seconds. This exposed repeated sequential provider refreshes.
2. Evidence refresh was deduplicated by symbol and parallelized. The next build's action completed with `ok: true`, 50 snapshots, and no action errors.
3. A volatile source URL was then found in the evidence hash because an identical retry wrote the same outcomes again. The identity was corrected to stable evaluation evidence.
4. On the current build, the first run after that correction returned `settlementUpdatedRows: 100` and `settlementFilledHorizons: 100`; the immediately repeated run returned `settlementUpdatedRows: 0` and `settlementFilledHorizons: 0` with 50 pending legacy rows. This is the direct retry/idempotency check.

The active Phase 1.2 cohort reports zero issued rows in the copied runtime data. The 50 cards are legacy rows and are deliberately excluded, so the tracker/scorecard/export denominators of zero are honest rather than a failed evaluation. No genuine Phase 1.2 issuance occurred during this edit.

## Sanitized representative export

`PHASE1_2_SANITIZED_FIXTURE_EXPORT.json` contains a clearly labeled synthetic 230-bar replay fixture, its issuance identity, raw snapshot bounds, reconstructed factors/decision/levels, and why no persisted revision/tracker row is claimed. The action probes above used copied real artifact rows, but are not production writes and are not represented as genuine issuance.

## Implemented

- Scheduled daily evaluator wiring and stable idempotent revision identity.
- Actual deterministic raw-input replay used by live issuance and replay.
- Forecast availability, entry-session uncertainty, and validated-calendar guards.
- Exact active-cohort filtering and cohort descriptors on tracker, scorecard, and export.
- Clear UI separation between legacy signal cards and Phase 1.2 cohort metrics.

## Tested offline

- 20 production-module behavior tests.
- 5 Phase 1.2 integration-oriented tests covering deterministic reconstruction and mixed-cohort selection.
- Server/client strict TypeScript checks.

## Verified in builder runtime

- Managed build succeeded.
- The real daily postmortem action completed after the fetch optimization.
- An immediate identical retry created no new evaluation revisions or horizon fills.
- Real tracker, scorecard, and export actions returned the declared `equity-eval-3.2.0` cohort and zero current-cohort denominators while preserving legacy cards.
- Desktop/mobile audit delivered with no console errors, broken assets, unreachable controls, or horizontal overflow.

## Not closed / operationally pending

- No genuine post-edit issuance exists, so production issuance, replay, and atomicity were not demonstrated on a new live row.
- Equity issuance still uses the existing database batch and unique issuance identity, but this pass did **not** add the expert-requested isolated-database concurrent-issuance/fault-injection test. Atomic rollback/concurrency remains source-level, not acceptance-test proven.
- The daily action's failed-provider branch is implemented with cached fallback and failure accounting, but this pass did **not** inject a provider failure through the real action handler. That acceptance case remains unproven.
- The runtime copied data contains no active Phase 1.2 cohort rows; therefore revision-to-tracker transition was not demonstrated for a current-cohort signal. The pure accepted-revision selection test and action response contracts pass, but end-to-end current-cohort settlement remains operationally pending.
- Two production scheduled cycles were not observed. The two direct action invocations prove immediate retry idempotency in the builder sandbox, not scheduler reliability.
- Profitability, predictive accuracy, and edge were not tested or claimed.

## Audit correction

The source changes close the principal equity integration defects, but this report does **not** label Phase 1.2 fully closed because three explicitly requested acceptance checks remain absent: issuance fault/concurrency injection, real-action failed-fetch injection, and a current-cohort revision flowing through the tracker. The artifact is buildable and its implemented paths pass the available checks; independent review should treat those three items as pending rather than inferred from source.
