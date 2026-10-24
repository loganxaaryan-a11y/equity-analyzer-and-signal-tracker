# Finding-to-evidence map

| Requested closure | Implementation | Regression / output evidence | Result |
|---|---|---|---|
| Declared label availability controls maturity and purge | `research/src/harness.ts` (`buildObservations`, versioned chronology fields) | KO August 24 / September 9 test in `research/src/harness.test.ts`; closure observations JSON | Closed offline |
| Fixed-lag mismatch fails explicitly | `validateBarSequence` availability-lag check | `availability_lag_mismatch:*:expected_30m` regression | Closed offline |
| Delayed publication fails at fold and holdout boundaries | Split-boundary guard in `buildObservations` | Synthetic validation_1 and pre-holdout fixtures; real holdout not opened | Closed offline |
| Exact baseline window; no survivor compression | `baselineEligibility` and exact scheduled 200-bar lookup | Delayed required SMA input regression; independent abstention/eligibility regression | Closed offline |
| Freshness recalculated at every read | `server/src/freshness.ts::currentFreshness`; dashboard calls it with read time | 14:00 fresh / 19:00 stale regression | Closed offline |
| Separate provider, receipt/fetch, and success clocks | `currentFreshness`, refresh-state success writes | unchanged success, old provider content, future/missing timestamp tests | Closed offline |
| OHLCV reaches primary display without mutating analysis | freshness response exposes OHLCV; `client/src/App.tsx` current mark/chart/volume overlay | Server typecheck; audited UI after build; market refresh isolation copy and action response | Closed offline/UI; production cycles separately scoped |
| Status events reject stale/pre-issuance/incompatible quotes | `signalObservationEligibility`; append path uses it | pre-issuance, stale, incompatible regressions | Closed offline |
| Real refresh worker is injectable and bounded | exported `refreshOneSymbol` + `MarketRefreshDependencies`; one 429 retry; in-flight map | source contract plus existing action/database integration suite; scheduler records | Offline path closed; controlled deployed outage/recovery pending |
| Shared statistical evaluator | `evaluateDatePanel` called by market summaries and synthetic controls | pipeline positive and fixed negative controls | Closed offline |
| Fold/pooled interval alignment and tail disclosure | complete-block population inside shared evaluator | report fields `pointEstimateRows`, `excludedTailRows`, `availableFullBlocks` | Closed offline |
| Longer-history readiness only | `closure-validate` emits readiness and freeze candidate | `phase2a1-longer-history-readiness.json`; `performanceExecuted:false` | Prepared; performance correctly blocked |
| Timing proposal review only | versioned timing protocol JSON | explicit pools, seeds, unmatched/reuse rules, union-window components, 20-component gate; `executed:false` | Prepared; not executed |
| Prior outputs, issued history, holdout, and no-promotion decision preserved | additive closure-v2 filenames and precondition hash checks | change-account JSON, freeze JSON, original output hashes, four null selections | Preserved |

## Evidence limits

- The deterministic suite verifies offline contracts. Scheduler run records prove the action was dispatched successfully; they do not establish a controlled production outage/recovery or every persisted row.
- The existing authorized input contains only 1,418 bars and an equity validation grid of 24 scheduled sessions. No new market performance is claimed.
- Synthetic controls are isolated diagnostics and are never counted as market evidence.
- No browser claim is made beyond the builder audit captured after the final build.
