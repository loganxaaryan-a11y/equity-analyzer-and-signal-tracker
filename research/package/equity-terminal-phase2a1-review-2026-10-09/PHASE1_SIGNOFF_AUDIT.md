# Final Phase 1 engineering signoff patch — equity terminal

Date: 2026-10-09

## Scope and identifiers

- Strategy: `equity-factor-agreement`
- Strategy version: `3.1.0-measurement-closure`
- Parameter hash: `atr2-target1.5R-weights-6-8-8-20-8-20-20`
- Evaluator: `equity-eval-3.2.0`
- Build/source identity: `phase1-final-signoff-2026-10-09`
- Issued-event schema guard: migration `0029_unique_issued_event_per_signal.sql`
- Platform upgrade v25: inspected and not applicable; this artifact has no inline blob-backed PDF renderer.
- No weights, indicators, decision thresholds, or Phase 2 strategy logic changed.

## Findings → production repair → acceptance evidence

| Review finding | Production repair | Executable evidence |
|---|---|---|
| `recordSignal` validated a draft candidate, then reconstructed and persisted a different candidate | `recordSignal` now loads one exact Yahoo evidence window, calls shared `reconstructAndValidateEquityCandidate`, applies `evaluateEquityIssuanceGate` to the final direction/score/stop/targets, and only then writes the bundle | `final_signoff.integration.test.ts`: expert LONG→SHORT counterexample rejects before DB access; draft-stop mutation cannot change the rejection; mirrored SHORT→LONG fixture stores one internally consistent bundle |
| Replay could bypass production controls by marking calculated factors GOOD | Shared `computeEquityDecisionFromRawInputs` applies coherent-OHLC, 200-bar coverage, `availableAt <= decisionAt`, >80% anomaly, and >5-day freshness gates. Non-GOOD factors contribute zero and reconstruction fails closed | Freshness/anomaly fixture returns `partial`; existing replay mutation tests still pass |
| Gate, dossier, snapshot, event, and stored levels could disagree | `recordSignal` returns the accepted immutable candidate. `analyze` uses that accepted candidate for factor model, score, thesis, failure, and levels. The snapshot and issued event are built from the same object | Mirrored accepted fixture asserts stored signal levels, raw snapshot levels, gate evidence, and issued-event levels equal the accepted candidate |
| Fault/concurrency evidence did not exercise production persistence | `recordSignal` exposes dependency seams only around evidence loading/suppression; tests call the real production function and its real three-operation `ctx.db.batch` bundle. Database constraints enforce one issuance identity and one issued event per signal | Fault injection at each write boundary proves rollback and retry; independently interleaved identical and competing requests return exactly one complete accepted bundle |
| Actual daily job provider-failure and read-model transitions were untested | The production daily evaluator accepts test adapters for fresh/cached history and clock; the public daily action calls that same function. Tracker now reads frozen issuance ATR rather than fetching a new series. Real tracker and scorecard handlers select accepted revisions | Daily-action integration fixtures prove: fresh evidence adds linked trade/direction revisions; identical retry adds none; actual tracker and scorecard select them; adequate cache after provider failure resolves only the eligible direction forecast; missing cache remains unverified |
| Duplicate issued events could survive concurrent retry | Partial unique index `signal_events_one_issued_per_signal` plus conflict-safe issued-event insert | Migration `0029`; interleaved production-function fixture returns one signal, one snapshot, one issued event |

## Reproduced defect: old path vs repaired path

### Blocker 1 — candidate mismatch

**Old path (source/reviewer reproduction):** initial LONG with stop 99.23 passed; reconstruction changed it to SHORT score −16 with stop 107.97; the SHORT was persisted while the stored gate still represented the LONG. The actual short-regime gate rejected that final SHORT.

**Repaired path:** the same synthetic 230-session evidence is reconstructed first. Its final SHORT is evaluated by the short-regime gate, rejected, logged as a suppressed final candidate, and no issuance persistence method is reached. Changing the draft stop has no effect because draft levels are not authoritative.

### Missing daily production-path evidence

**Old evidence state:** Phase 1.2 had source wiring but no executable provider-failure fixture and no current-cohort revision flowing through the actual tracker/scorecard handlers.

**Repaired evidence:** three integration tests call the production daily evaluator used by `Actions.runDailySignalPostmortem` and the actual `getSignalTracker` / `getScorecard` handlers. A research-reference setup stays `UNVERIFIED`; its separately eligible direction forecast resolves; immediate retry adds zero revisions; provider failure is surfaced even with adequate cache; inadequate cache cannot manufacture a result.

## Exact checks

Captured command output is in `PHASE1_SIGNOFF_TEST_RESULTS.txt`.

```text
$ bun test
34 pass, 0 fail, 128 expect() calls

$ bun run typecheck
server and client strict TypeScript checks

$ web_artifacts.build
managed platform build (recorded by the artifact build result)
```

### Results separated by layer

- **Module:** 20 measurement tests pass (time cutoff, session coverage, returns/costs, XNYS DST/early close, append-only selection, replay controls).
- **Replay/cohort integration:** 5 tests pass (raw-input reconstruction, saved-output mismatch, post-decision input exclusion, exact mixed-cohort filter).
- **Persistence/action/read-model:** 9 tests pass (3 candidate consistency, 2 atomicity/concurrency, 1 freshness/anomaly control, 3 daily action/provider/read-model).
- **Client/build:** strict client and server typechecks plus managed build; no UI redesign was required because the client consumes the corrected action responses.
- **Operational:** pending items are listed below; no offline result is mislabeled as production evidence.

## Sanitized representative export

`PHASE1_SIGNOFF_SANITIZED_FIXTURE_EXPORT.json` links the synthetic final-candidate gate decision, atomic issuance bundle, daily evaluation revisions, accepted tracker/scorecard result, and provider-failure variants. It is explicitly test-only and contains no production row or user data.

## Implemented

- Final equity candidate reconstruction before gate validation.
- Shared production/replay calculation with coverage, freshness, and anomaly controls.
- One immutable accepted candidate across dossier, snapshot, stored signal, gate, and issued event.
- Atomic production issuance acceptance tests with write-boundary failures and interleaved retries.
- Daily evaluator injection seams used by the production action, not a second grading algorithm.
- Current-cohort revision flow through actual tracker and scorecard action handlers.
- Honest fresh-provider failure behavior for adequate and inadequate cached evidence.
- Frozen issuance ATR in tracker risk display.

## Tested offline

- 34 tests / 128 assertions in Bun across the three production suites.
- Fault injection at each of the three issuance write boundaries.
- Interleaved identical and competing issuance requests.
- Daily first run, identical retry, cached-provider fallback, and no-cache failure.
- Existing 25 Phase 1.1/1.2 tests preserved.

## Operational verification pending

- No genuine post-edit issuance was created or claimed.
- Two scheduled production cycles were not observed.
- Unavailable production incident logs remain unavailable.
- Runtime profitability, predictive accuracy, live reliability, and strategy edge were not tested or claimed.
- Blocker 2 (crypto ATR live/replay input identity) belongs to the separate crypto terminal and is not changed or claimed fixed by this equity artifact patch.

## Signoff boundary

The equity engineering acceptance checks requested in the final prompt are implemented and pass offline. Operational production evidence remains a separate pending gate. Strategy Phase 2 is not included in this patch.
