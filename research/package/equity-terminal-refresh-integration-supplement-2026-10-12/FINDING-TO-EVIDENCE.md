# Finding-to-evidence map

All six tests are in `source/server/src/market_refresh.integration.test.ts` and run through `runMarketDataRefresh`, `refreshOneSymbol`, the actual Drizzle schema/migrations, and `buildFreshnessDashboard`.

| Case | Observable assertions | Result |
|---|---|---|
| Success | A second changed payload advances the quote stream's `latestObservationId`; the read model returns provider `eventAt`, receipt `receivedAt`, and `lastSuccessAt` independently with exact provider/fetch ages. | Passed |
| Unchanged response | Zero observations are written, three existing observations are reused, the quote pointer is unchanged, and both `lastAttemptAt` and `lastSuccessAt` advance while the old provider event and receipt clocks remain unchanged. | Passed |
| Provider outage | Result and run row record `error`; quote pointer and `lastSuccessAt` remain unchanged; `lastAttemptAt` advances; the read model reports error health. | Passed |
| 429/retry recovery | The synthetic 429 causes exactly one injected retry-delay call; the second provider response succeeds and persists the expected quote and candle observation set. | Passed |
| Concurrent triggers | Two simultaneous action calls share one provider invocation, produce one deduplicated observation set, and retain two distinct successful refresh-run rows. | Passed |
| Immutable decisions / barrier gating | Stale and pre-issuance quote fixtures append zero signal-status events; raw `SELECT *` snapshots of issued decision rows are JSON-identical before and after both refreshes. | Passed |

## Boundaries

- Provider responses and all timestamps are synthetic and deterministic.
- The isolated database starts empty and is migrated from the production migration directory for each test.
- No live provider, deployed database, real holdout, or frozen report is opened or changed.
- This closes the offline integration-suite gap only. A controlled deployed outage/recovery remains separate and pending.
