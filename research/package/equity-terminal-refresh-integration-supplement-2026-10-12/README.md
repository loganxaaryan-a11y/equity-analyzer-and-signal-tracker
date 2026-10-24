# Equity terminal refresh integration supplement

Prepared 12 October 2026 to close the remaining offline refresh-path integration gap from the Phase 2A.1 closure package.

## Scope

The suite exercises the real refresh action core, worker, persistence schema, and freshness read model against an isolated in-memory SQLite database migrated from the artifact's 30 Drizzle migrations. Provider responses, retry delay, and all clocks are injected and deterministic. Fixtures are synthetic; the suite makes no live network call.

It covers successful refresh, unchanged provider payload, outage, one 429 retry followed by recovery, concurrent same-symbol triggers, and stale/pre-issuance barrier observations. Every case asserts observable database or read-model state.

## Implementation

- `source/server/src/market_refresh.integration.test.ts` — six deterministic end-to-end integration cases.
- `source/server/src/actions.ts` — production action logic is exposed through `runMarketDataRefresh(ctx, args, dependencies)`; the published action delegates to the same function with production defaults. The injected clock now owns run timestamps as well as worker timestamps.
- `source/package.json` — the suite is in the regression command; archived package copies are excluded from test discovery so only the current source tree is counted.

## Result

- Current-source regression: **89 passed, 0 failed, 251 assertions across 6 files**.
- Client, server, and research TypeScript checks: **all exited 0**.
- `closure-validate`: **5,672 observations, 0 selections; positive synthetic diagnostic PASS; 0/12 negative false qualifications; holdout opened: false**.
- The four selection cells and no-promotion decision are unchanged.

The controlled deployed outage/recovery evidence remains pending. Synthetic integration fixtures are not represented as production evidence.

See `FINDING-TO-EVIDENCE.md`, `evidence/TEST_RESULTS.txt`, and `MANIFEST.sha256`.
