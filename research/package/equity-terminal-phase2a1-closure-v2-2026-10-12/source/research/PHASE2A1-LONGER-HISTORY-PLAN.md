# Phase 2A.1 longer-history equity data plan

Status: acquisition plan only. No strategy outcomes were computed and the existing holdout boundary remains 2026-09-21.

## Lawful existing access

The terminal already contains a server-side Yahoo Finance chart retriever (`yahooFullHistory`) that requests `range=max`, retains adjusted close plus dividend/split events, applies bounded pacing/backoff, and caches the owned response. The first acquisition attempt should reuse that path for a bounded frozen equity universe; no paid API plan is authorized. If Yahoo returns an error, incomplete adjustment metadata, or a rate-limit response, the acquisition stops and records the provider failure rather than splicing another provider.

The existing Finnhub connection supplies other terminal inputs but is not the frozen OHLCV basis for this proposed extension. It must not be silently mixed into Yahoo price history. No current-watchlist or present-day liquidity value may be represented as historical point-in-time membership.

## Proposed acquisition and normalization

1. Request maximum daily history once per registered instrument through the shared server cache, recording the exact returned source URL, retrieval time, exchange metadata and raw-payload SHA-256.
2. Keep raw unadjusted OHLC, adjusted close, split events and dividend events. Derive a single internally consistent adjusted OHLC series using one documented cumulative adjustment factor. Validate that adjusted high is not below adjusted open/close and adjusted low is not above them.
3. Treat returns as adjusted price returns unless a separately frozen total-return series is constructed. Never add dividends to a series whose adjustment already incorporates distributions.
4. Validate dates against an authoritative XNYS session calendar, including ad-hoc closures. The current embedded 2025–2027 calendar is insufficient for a decade-long study and must not be extrapolated silently.
5. Preserve missing scheduled sessions, duplicate/revision records, provider failures and corporate-action reconciliation as explicit exclusions. Do not create flat bars or zero volume.
6. Freeze normalized files, calendar version, data manifest, executable engine hash and split proposal before computing any performance.

## Proposed bounded period and power gate

Target acquisition window: 2016-01-04 through 2026-08-14, ending before the existing validation and reserved-holdout dates. A standard XNYS calendar calculation suggests 2,664 scheduled sessions in that interval (including the 2018-12-05 ad-hoc closure). This is a planning count, not a claim about provider coverage.

Per instrument, a complete series of 2,664 sessions would permit at most 2,435 exact 30-session endpoint decisions after 200-session feature warm-up and 30-session maturity (`2664 - 200 - 30 + 1`). A five-year fallback beginning 2021-01-04 would offer about 1,410 scheduled sessions and at most 1,181 such decisions. Actual usable counts must be recomputed after missing-session, latency, anomaly, corporate-action and purge exclusions.

Before any performance command runs, emit a readiness table for each instrument with:

- scheduled sessions;
- valid normalized sessions;
- missing/duplicate/revised sessions;
- 200-session warm-up losses;
- exact 5- and 30-session endpoint availability;
- fold-boundary purge losses;
- mature eligible observations by fold;
- unique decision dates and complete 30-date uncertainty blocks.

Every validation fold must contain more than 30 eligible XNYS sessions after its start and must retain mature 30-session labels after boundary purging. A fold that leaves zero mature 30-session outcomes is invalid for that product and is rejected before outcomes are calculated.

## Point-in-time and survivor limitations

A fixed current-symbol list remains a survivor sample even with ten years of candles. Yahoo maximum history does not provide historical index membership, delisted securities, point-in-time liquidity membership, borrow availability or delisting returns by itself. Those limitations remain visible. The extension can improve time coverage for a bounded instrument cohort; it cannot support historical whole-market selection, runner recall, or executable short economics.

Any revised development/validation schedule will be frozen in a new registry. It may use only pre-2026-09-21 material and cannot move, shrink or reclaim the existing reserved holdout. The already viewed 2026 validation outcomes remain exposed and are not a fresh confirmation set.
