# Equity discovery timeout diagnosis — 2026-10-14

**Scope:** `equity-theory-discovery` cron → `space_action` →
`equity-analyzer-and-signal-tracker.runAutomatedScan {universe:"sp100"}`.
15 consecutive failures, 2026-10-07 → 2026-10-13, every one
`space worker request timed out after 120000ms`. Last success 2026-10-06 03:25:51 EDT.

**Evidence basis (labeled):**
- SCHEDULER RECORDS (hard): `cron.runs` for `equity-theory-discovery`, 14 runs
  shown — every run `started_at_utc → finished_at_utc` = 121–123s, identical
  error text. The records carry NO per-stage timing; the space worker
  invocation itself is what times out.
- SOURCE CODE (hard): `~/workspace/ts-spaces/equity-analyzer-and-signal-tracker/server/src/actions.ts`
  — the full `runAutomatedMarketScan` path was read line by line (lines
  2116–2343, plus `pacedYahooFetch` 260–280, `yahooFullHistory` 309–327,
  `velocityScreen` 1746–1771, `marketNews` 1043–1071, `analyze` 623–872).
- VM MEASUREMENT (this VM, not the space worker — labeled where used):
  timed Yahoo Finance probes replicating the scan's exact request shapes.
- NOT AVAILABLE: per-stage timing on the deployed worker (the deployed
  artifact DB is not readable from this workspace; scheduler records log only
  the worker timeout). The stage split below is therefore code structure +
  VM measurement, not worker-observed timings. Stated plainly per the
  verification bar.

## 1. Where the 120 seconds go — stage by stage

`runAutomatedMarketScan(ctx, "sp100")` executes these stages in order:

| # | Stage | Code | Time character |
|---|-------|------|----------------|
| 1 | Universe load | `loadScanUniverse` — 2 parallel Wikipedia fetches | ~1–3s |
| 2 | Velocity screen | `velocityScreen` — 3 sequential Yahoo spark chunks (50/50/1) through the global paced queue | ~3–6s (fail-fast; see note) |
| 3 | SPY benchmark | `analyze(ctx,"SPY",…)` — one full-history fetch | ~2–5s |
| 4 | **Per-symbol full scoring** | `mapWithConcurrency(scanProfiles, 14, analyze…)` — ~101 symbols, each `analyze()` → `yahooForRequest` → `yahooFullHistory` → `yahooSeries(symbol,"max")` | **~116–316s — exceeds the 120s limit by itself** |
| 5 | Issuance validation | `signalIssuanceDecision` per row — pure compute | <1s |
| 6 | Discovery news | `marketNews(ctx,"discovery",null)` — `sharedNewsCache` (15-min TTL); on miss: `ctx.tool.web_search` + `ctx.inference.complete` | 0s cached / ~15–45s on miss |
| 7 | Sector synthesis | `ctx.inference.complete(...)` — one sequential LLM call | ~10–30s |
| 8 | DB persistence | inserts — cheap | ~1s |
| 9 | Tracker settlement | `scoreTrackedSignals` — DB read only | <1s |
| 10 | Market brief | `writeMarketDayBriefCache` → `buildMarketDayBrief` | ~5–30s |

### The smoking gun (stage 4), in three code facts

**Fact A — every Yahoo request is globally serialized.**
`pacedYahooFetch` (actions.ts:260–280) funnels ALL Yahoo traffic through one
process-wide promise queue (`yahooGlobalQueue`) AND enforces ≥650ms between
requests (`Math.max(0, 650 - (Date.now() - lastYahooRequestAt))`). The scan's
`mapWithConcurrency(…, 14, …)` parallelizes the *wrapper*, but the 101
network fetches underneath are strictly sequential: each fetch waits for the
previous one to complete plus the 650ms gap. Concurrency 14 buys nothing for
the network phase.

**Fact B — every symbol fetches its entire "max" history.**
`yahooFullHistory` calls `yahooSeries(normalized, "max", lane)` — full history
from `period1=0` (actions.ts:278–279, 318). VM-measured: ~1 MB per symbol
(AAPL 1275 KB, ABT 1274 KB, AMAT 1175 KB), mean fetch time **2.48s** over 8
sampled symbols. The scan's factors consume at most ~260 sessions and its
completeness gate requires 252 — the other ~95% of each payload is never read.

**Fact C — the cache gate guarantees a full refetch after every failure.**
`yahooFullHistory` reuses the DB cache only when `cached.fetchedOn === today`
(actions.ts:313). The last successful scan was 2026-10-06, so every run since
2026-10-07 has found a fully-stale cache and attempted all ~101 refetches.

### The arithmetic

- VM-measured mean "max" fetch: 2.48s → 101 fetches × 2.48s = **251s of fetch
  time**, plus 101 × 0.65s = 66s of pacing gaps → **~316s for stage 4 alone**.
- Even at an optimistic 0.5s per fetch on the worker (much faster than this
  VM): 101 × (0.5 + 0.65) = **116s** — the entire 120s budget consumed by
  stage 4, leaving zero room for the two LLM calls (stages 6–7), news, or the
  market brief (stage 10). The margin is zero-to-negative under any plausible
  timing.

### The death spiral

Failure → `historicalCaches` never refreshes (`fetchedOn` stays 2026-10-06) →
next run's cache gate misses on all 101 symbols → next run must refetch
everything → times out again. Each failure makes the next run's workload
*maximal*. This is why 15 consecutive runs failed identically: the workload
never shrinks.

### Secondary findings

- `velocityScreen` chunks 50 symbols per spark request; Yahoo's v7 spark
  endpoint 400-rejects 50-symbol requests (VM-measured, 2 attempts). The scan
  swallows this (`catch { continue }`) → velocity map stays empty → T2
  qualifier set is empty. Not a timeout cause (~3s fail-fast), but the T2
  tier is silently dead.
- Stages 6, 7, 10 (web_search + two inference calls) are the next-largest
  consumers after stage 4 and would break the budget even if stage 4 were
  fixed in isolation. Any repair must bound or defer them too.

## 2. What was NOT established

- **The first-failure trigger (2026-10-07).** The "max"-range fetch and the
  pacing queue predate the failure streak (both present in the 2026-10-09
  review source export). The scan succeeded for weeks with the same code
  shape, so the 2026-10-07 tip-over is likely Yahoo-side (slower responses /
  throttling — 429s trigger 800ms + 1600ms backoffs inside `pacedYahooFetch`)
  or a marginally-slower day crossing a thin budget. Not verified from here.
- **Worker-observed per-stage timings.** Not obtainable from this workspace
  (see evidence basis). The split above is structural + VM-measured.

## 3. Repair direction (implemented in this directory)

The deployed action cannot be edited from here (artifact builder owns it).
The workspace batch lane repair therefore:

1. **Splits the 101-symbol universe into resumable batches** — per-symbol
   progress persisted after every symbol (atomic writes); a timeout can never
   lose completed symbols. Final consolidation accounts every symbol as
   scored / failed / skipped with reasons.
2. **Fetches `2y` instead of `max`** — 504 sessions > the 252 the
   completeness gate requires; every factor consumes ≤260 sessions, so factor
   inputs are identical and scores are unchanged. ~20× smaller payloads.
   This is a data-fetch optimization, NOT a weight/formula change (weights
   6/8/8/20/8/20/20, factor formulas, gates, and the issuance decision are
   ported verbatim — see `scan/gates.py` header for source line refs).
3. **No global 650ms pacing** in the sandbox scanner (separate client;
   bounded concurrency 6 with 429 backoff instead).
4. **Defers the LLM/news/brief stages** out of the scan path — discovery
   emits scored candidates + factor ledgers; synthesis stays a separate,
   non-blocking step.
5. **Sizes batches from measured per-symbol timing** so each batch completes
   in seconds, not minutes.

Batch sizing evidence: with 2y fetches the mean per-symbol cost on this VM
is ~2–4s at concurrency 6 → a 13-symbol batch ≈ 7–9s. Even under 5× adverse
conditions a batch stays far under any 120s-class limit. Per-symbol timings
are recorded in every batch run record (`state/runs/`) so the sizing stays
evidence-based.
