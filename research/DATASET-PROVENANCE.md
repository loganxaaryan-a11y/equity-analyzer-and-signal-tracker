# Phase 2A dataset provenance and coverage

## Acquisition and scope

The frozen input is a bounded structured daily-candle extract returned by the runtime's finance search on 2026-10-09. It contains five current instruments: XNYS KO, XOM and JPM common stocks; BTC and ETH crypto spot labels. Exact public source pages are recorded in `dataset-manifest.json`, `DATA-PLAN.md`, and the frozen research specification.

The extract provides roughly one year of daily data. It does **not** satisfy the preferred several-year, multi-regime coverage. It is therefore a current-survivor exploratory sample, not a reconstruction of a historical eligible universe. No ticker was added or removed because of its future return.

| Instrument | Full dates | Full rows | Train/validation rows | Locked rows | Class |
|---|---|---:|---:|---:|---|
| XNYS:KO:USD | 2025-09-26 to 2026-10-07 | 259 | 246 | 13 | common stock |
| XNYS:XOM:USD | 2025-09-26 to 2026-10-07 | 259 | 246 | 13 | common stock |
| XNYS:JPM:USD | 2025-09-26 to 2026-10-07 | 259 | 246 | 13 | common stock |
| binance:BTC:USD | 2025-09-26 to 2026-09-29 | 369 | 340 | 29 | spot label |
| binance:ETH:USD | 2025-09-26 to 2026-10-07 | 377 | 340 | 37 | spot label |

The source label reports venue `binance` and quote `USD`; it does not provide a complete tradable pair identifier. No claim is made about a particular venue order book.

## Integrity and exclusions

The manifest contains SHA-256 hashes for each full source series, included train/validation rows, each locked holdout subset, the aggregate locked material, and the physical input file. In the source extract, duplicate-row and provider-failure counts were zero. The harness rejects duplicate dates, malformed/non-positive OHLC, incoherent highs/lows, reversed availability timestamps, and unresolved split-like discontinuities in unadjusted series. It never inserts flat synthetic bars or zero volume.

Feature warm-up, malformed data, no-signal abstention, pending labels, unverified labels, and purged label overlap are represented separately in the machine-readable observations. Forward bars are used only for entry/exit labels.

## Availability and execution assumptions

Historical provider receipt timestamps were unavailable. Equity completion is modeled at the XNYS close and availability at close plus 30 minutes. Crypto completion is modeled at the end of the UTC daily interval and availability five minutes later. Entry is the first subsequent eligible daily open strictly after modeled decision availability. The immediately adjacent crypto open precedes the assumed availability, so it is skipped.

These are assumptions, not observed latency. They are deliberately persisted per bar and per observation. The initial frozen extract modeled every equity close at 16:00 local; after its first validation output was viewed, that calendar defect was found and corrected so XNYS early closes use the shared validated session bounds. The original freeze is retained as `PHASE2A-FREEZE-v0-invalid.json`; the corrected manifest records the revision. OHLCV and every strategy choice were unchanged, and candidate, baseline and selection reports were identical before and after the correction. This prior exposure is not erased.

## Corporate actions and return basis

The equity extract supplies unadjusted OHLCV only. It has no adjusted close, split events, or dividend events. Equity outcomes are price returns excluding dividends. No dividend is added. The harness fails closed on a split-like discontinuity with unresolved metadata. Synthetic fixtures verify the distinction between coherent unadjusted data and unresolved corporate-action/anomaly paths, but they cannot prove that absent real events were handled by the upstream extract.

## Missing coverage

- No delisted/inactive instruments or historical membership history.
- No historically reconstructable liquidity membership rule.
- No XNYS ETF or leveraged-instrument data in the bounded extract; those classes have no outcome rows and are not mixed with common stocks.
- No borrow, locate, financing, crypto funding, or observed fee/slippage data.
- No historic funding, OI, news, fundamentals, or other live-dossier provider factors.
- Too little post-SMA-200 history for robust 30-unit validation or block uncertainty.

These gaps remain limitations; none was backfilled with present-day readings or invented rows.
