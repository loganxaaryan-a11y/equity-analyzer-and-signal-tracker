# Track A — market-data freshness audit

## Scope

This change adds an isolated append-only market-data lane. It does not change strategy weights, research splits, holdout access, trading execution, issued decisions, signal snapshots, entries, stops, targets, or accepted evaluation evidence.

## Inventory before this change

| Surface | Source | Previous cadence/cache | Coupling / stale risk |
|---|---|---|---|
| Dossier price + adjusted daily OHLCV | Yahoo Finance chart | On dossier request; daily dossier cache | Expensive dossier reuse could leave the displayed mark tied to the analysis cadence. |
| Market home | Persisted broad-scan brief | Prepared from the latest completed scan | No independent quote refresh. |
| Open signal current mark | Daily interim snapshot | Daily postmortem | Current marks could remain old between postmortems. |
| Technical factor ledger | Yahoo-adjusted completed daily bars | Frozen with each decision or daily dossier | Correctly decision-time, but previously visually mixed with the current mark. |
| Finnhub / Alpha Vantage / SEC / news inputs | Stored per-source snapshots | On-demand/provider-specific | Each already has its own timestamp; a market refresh must not alter it. |
| Automated smart scan | Yahoo + research sources | Explicit scan action / managed job | Expensive; must remain independent of market polling. |

Provider entitlements and deployment constraints: Yahoo is used as a public delayed/aggregated chart feed with no paid quota or real-time entitlement. The artifact uses bounded polling, not WebSockets, because the server action host is request-driven and does not promise a durable streaming connection. The source is paced globally at 650 ms and backs off twice on HTTP 429. A 429 or outage is retained as an error state with the last successful observation preserved.

## New lanes

1. `market_data`: one batched Yahoo chart request per active symbol. It persists a quote observation, a forming candle when present, and the latest completed candle. Default schedule target: every 15 minutes.
2. `expensive_analysis`: unchanged on-demand/daily dossier and scan caches. It is never called by `refreshMarketData`.
3. `signal_monitoring`: runs only after an observation is persisted. It appends idempotent status events. A quote barrier observation remains `observed_only`; the existing path evaluator owns authoritative settlement.

`tracked_signals`, `signal_input_snapshots`, issued levels, and evaluation rows are not updated by the refresh action. A market refresh creates no recommendation. Any later recommendation still goes through `recordSignal`, which assigns a decision-time issuance identity and separate immutable snapshot.

## Cache, versioning and stale rules

- Provider event time and server receipt time are separate columns.
- A successful HTTP response containing an old provider event remains stale; receipt time does not freshen it.
- Same symbol/kind/event with changed OHLCV produces a new correction version linked to the prior observation.
- Exact repeats reuse the existing content hash.
- Forming bars and their partial volume are shown separately and are never fed into completed-bar decision inputs or compared with a completed full-session volume reference.
- Equity labels explicitly say public delayed/aggregated and use `market_closed` outside the modeled 09:30–16:00 New York session. This is not an exchange-calendar claim; holiday/early-close settlement remains owned by the existing XNYS evaluator.

## Request budget

One request per symbol per 15-minute run; 96 runs/day. The dashboard computes the exact active count, capped at 20.

| Active symbols | Requests/run | Requests/day | Requests/30 days |
|---:|---:|---:|---:|
| 4 diagnostic symbols | 4 | 384 | 11,520 |
| 10 active symbols | 10 | 960 | 28,800 |
| 20 hard cap | 20 | 1,920 | 57,600 |

Yahoo does not publish a contractual quota for this public endpoint. These are terminal budgets, not provider guarantees. The global pacer and two bounded 429 retries remain active. There is no per-user client polling loop: a scheduled action refreshes the shared server cache; client views read that cache and invoke a manual refresh only on explicit user action.

## Integration coverage

`server/src/freshness.test.ts` protects: throttled-analysis independence, stale-content classification, forming→closed transition, outage state, deterministic dedup identity, fresh quote with stale factor, immutable signal levels, observed-only barrier status, status idempotency material, and delayed/market-closed equity labeling.

Production limitations remain open: persistence atomicity is not proven by a production rollback incident; provider outage recovery is covered by code and simulated tests until two live recovery cycles are observed; there is no production incident log in this package. Research holdouts were neither read nor modified.
