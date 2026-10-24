# Equity Terminal Phase 1.1 — Measurement Closure

Review date: 2026-10-09 UTC  
Strategy: `equity-factor-agreement`  
Strategy version: `3.1.0-measurement-closure`  
Parameter hash: `atr2-target1.5R-weights-6-8-8-20-8-20-20`  
Build identifier: `phase1.1-2026-10-09`  
Evaluator: `equity-eval-3.1.0`

## Findings to fixes

| Review finding | Production path | Closure | Test/evidence |
|---|---|---|---|
| Pre-issuance bars settled setups | `reconcileSignalHistory` → `evaluateEquityTradeSetup` | Actual `entryAt`/`issuedAt`, not `signalDate`, defines the first eligible session | `pre-issuance target cannot settle…` |
| Missing OHLC allowed a later hit | same | Finite OHLC and every expected XNYS session are required; gaps return `UNVERIFIED` | `missing OHLC…`, first/middle/tail fixtures |
| Future/expiry-straddling evidence | `evaluateEquityTradeSetup` | Bars after evaluation cutoff are excluded; bars crossing entry/expiry are unresolved without finer evidence | future/expiry/double-touch fixtures |
| Incorrect time exit | same | Exact declared final-session close required; no stale proxy | exact-time-exit fixture |
| Opening gaps unordered with later extremes | same | Adverse opening gap is applied first | opening-gap fixture |
| Research reference called a trade fill | `recordSignal`, evaluator | Research references remain explicit `UNVERIFIED`; only supported XNYS paper setups may issue | research-reference fixture; runtime regrade 50/50 unverified |
| Levels differed across display and grading | `recordSignal`, tracker, evaluator | One persisted frozen-levels object is used; tracker does not derive another target | frozen META target fixture |
| Historical decisions could be rewritten | `recordSignal` | Same issuance identity returns existing row; changed input creates amendment event, not mutation | DB unique issuance key + action path |
| Issuance race/partial writes | `recordSignal` | Snapshot, signal and issued/amendment event are a single DB batch; stable nullable identity column preserves legacy duplicates while enforcing new issuance uniqueness | schema/migration/build; live concurrency fault injection not available |
| Outcome revisions overwrote evidence | `reconcileSignalHistory` | Append-only revisions with evidence identity, predecessor and acceptance state; identical retry inserts none | accepted-revision fixture; runtime second reconcile inserted 0 |
| Legacy read paths still drove UI | `readLiveTrackerState`, `getSignalTracker`, `getScorecard`, client tracker/scorecard copy | Accepted revision table is authoritative; no `return14d ?? return5d ?? return30d` fallback | runtime action outputs show issued 50, resolved 0, unverified 50 |
| Gross values stored as net | evaluator/revisions/read model | Gross and modeled-net fields are separate; unknown costs stay null/unknown | cost fixture; runtime scorecard reports no net expectancy |
| Snapshots could not replay | `recordSignal`, `replaySignalSnapshot` | New issued XNYS setups persist the raw closed-bar window, metadata and canonical parameters; replay excludes later inputs | deterministic replay fixture; no genuine new issuance in sandbox |
| Sample sufficiency implied edge | `assessDirectionalEvidence` | Sufficiency and economic qualification are separate; edge validation stays false | poor-expectancy fixture (24 observations, −1.0211 mean) |
| Legacy 5/14/30 writer and horizon mixing | `scoreTrackedSignals`, tracker, scorecard | Writer frozen as compatibility no-op; accepted product/horizon revisions are selected separately | source + runtime tracker/scorecard |

## Exact checks run

```text
bun test server/src/measurement.test.ts
17 pass
0 fail
48 expect() calls
Ran 17 tests across 1 file.

bun x tsc --noEmit -p server/tsconfig.json
exit 0

bun x tsc --noEmit -p client/tsconfig.json
exit 0
```

The artifact build succeeded after migration. The first migration attempt correctly failed because legacy rows shared the new composite identity; the migration was changed to add a nullable canonical `issuance_identity` and place the unique boundary on that value. Existing rows remain untouched and new Phase 1.1 issuances must populate the key.

## Runtime evidence (isolated builder database)

- First `reconcileSignalHistory`: reviewed 50 legacy signals, inserted 100 product-specific revisions; 50 trade setups and 50 direction forecasts were `UNVERIFIED` because legacy rows lacked a complete immutable entry/calendar contract. One preserved old `MISS` became `UNVERIFIED`; 49 had no old verdict.
- Identical second reconcile: inserted 0 revisions.
- `getSignalTracker`: returned `issued=50`, `resolved=0`, `open=0`, `ambiguous=0`, `unverified=50`; META retained target 809.38 from its issued row and was not re-derived.
- `getScorecard`: resolved denominator 0; no hit rate or net expectancy; unverified 50; agreement explicitly not probability.
- `verifySignalIssuanceControls`: two live-provider born-dead fixtures were suppressed before tracker insertion. This exercised suppression, not a genuine issuance.

## Implemented / tested offline / verified in runtime / blocked

### Implemented
- Versioned XNYS calendar/session evaluator with DST, weekend, holiday and early-close handling.
- Strict first-touch and fixed-horizon products with coverage checks, exact cutoff enforcement, opening-gap handling, and linear long/short return math.
- Immutable issuance identity, atomic batch writes, raw snapshots, amendment events and deterministic offline replay for new supported XNYS setups.
- Append-only evaluation revisions and authoritative tracker/scorecard read model.
- Honest research-only treatment for legacy and unsupported rows.

### Tested offline
- 17 production-module tests, 48 assertions, all passing.
- Server and client strict TypeScript checks, both exit 0.

### Verified in runtime
- Migration and application build.
- Actual reconcile action, idempotent retry, tracker read action and scorecard read action against the isolated builder database.
- Versioned unresolved denominators reach the action/UI contract.

### Blocked / pending
- No genuine post-Phase-1.1 XNYS issuance occurred in the sandbox, so raw-snapshot replay is proven offline but not demonstrated on a real newly issued row.
- Concurrent-request uniqueness and injected failure rollback are enforced structurally by the database identity key and atomic batch, but were not load/fault-tested in runtime.
- Two successful scheduled recovery cycles were not available in this edit session.
- Production incident root causes (missing verdicts, scheduler failure, deployed/source mismatch) require production logs/backups not present here.
- A full real old-versus-new row export can now be requested through `exportMeasurementClosure`, but this session's sandbox contained only unreconstructable legacy rows, so the honest result is all 50 unverified rather than a corrected hit rate.
- This closure demonstrates measurement behavior, not predictive edge or profitability.

## Changed files

- `server/src/measurement.ts`
- `server/src/measurement.test.ts`
- `server/src/schema.ts`
- `server/src/actions.ts`
- `drizzle/0028_phase1_1_measurement_closure.sql`
- `client/src/App.tsx`
- `PHASE1_1_AUDIT.md`
