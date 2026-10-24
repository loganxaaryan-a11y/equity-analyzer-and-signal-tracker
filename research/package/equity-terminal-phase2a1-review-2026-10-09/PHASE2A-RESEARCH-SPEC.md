# Phase 2A research specification — frozen before outcomes

Frozen: 2026-10-09T16:23:05Z  
Cohort: `phase2a-ohlcv-v1`  
Status: bounded offline research only; not a live strategy and not evidence about the existing dossier model.

## Products and estimand

Four products are evaluated separately: crypto 5 and 30 elapsed-day direction forecasts; equity 5 and 30 XNYS-session direction forecasts. All use completed daily OHLCV bars. They make no intraday claim. Direction forecasts and existing first-touch trade setups remain separate products and no Phase 2A row can enter the legacy scoreboard.

The outcome is linear directional price return on entry notional: long `(exit-entry)/entry`, short `(entry-exit)/entry`. Zero is flat and excluded from the directional hit-rate numerator and denominator while reported separately. Gross and modeled-net event returns are reported; overlapping events are not combined or annualized as a portfolio.

## Universe and data freeze

The source extract available for this run contains approximately one year of structured daily candles. The frozen research universe is therefore explicitly a current-survivor exploratory sample, not historical whole-market coverage:

- XNYS common stocks: KO, XOM, JPM; USD quote; XNYS calendar.
- Crypto spot labels: BTC and ETH; source-record venue `binance`, quote `USD`, 24/7 UTC calendar. The exact tradable pair identifier was not supplied, so execution feasibility is unknown.
- ETFs and leveraged instruments are not mixed with common stocks. No eligible XNYS ETF or leveraged-instrument history was present in the bounded source extract, so those classes have no Phase 2A outcome rows.
- Delisted/inactive instruments and historical membership are unavailable. Liquidity selection is not applied because a historically reconstructable membership/liquidity universe is unavailable; this is disclosed rather than replaced with a hindsight filter.

Every stored bar retains identity, venue, quote currency, calendar, source, interval, OHLCV, event time, modeled availability time, retrieval time and adjustment basis. Missing bars are never synthesized. Duplicate, malformed and incoherent OHLC rows are excluded as data failures, not abstentions.

Equity OHLCV is source-record unadjusted data. The source extract supplied no adjusted close, splits, dividends, or corporate-action event rows. Equity outcomes are therefore **price returns excluding dividends**, never total returns. No dividend is added. A detected split-like discontinuity without declared adjustment metadata is excluded. Corporate-action behavior is protected by synthetic regression fixtures; the live extract cannot verify historical actions that it does not contain.

Source pages used for the extract:

- KO: https://finnhub.io/?q=%22KO%22
- XOM: https://finnhub.io/?q=%22XOM%22
- JPM: https://finnhub.io/?q=%22JPM%22
- BTC: https://finnhub.io/?q=%22BTC%22
- ETH: https://finnhub.io/?q=%22ETH%22

## Timing and availability

- Equity event time is modeled at the XNYS close; historical provider availability is assumed at session close plus 30 minutes. Decision time equals that availability time. Entry is the first later eligible XNYS session open. Exit is the close of the Hth eligible entry session, counting entry as session one.
- Crypto event time is the end of its UTC daily interval; historical provider availability is assumed at interval end plus five minutes. Because the immediately adjacent UTC open precedes this availability assumption, entry skips to the next eligible 00:00 UTC open. Exit is the terminal close after H complete UTC daily intervals beginning at that entry open.
- Forward prices appear only in labels. A row is mature only after the exit bar's modeled `availableAt`. The observation records feature cutoff, decision time, entry time/price, horizon end and label availability time.

These are schedule-based historical assumptions, not observed provider timestamps. No decision is backdated.

## Frozen hypotheses

Exactly one parameter set is registered for each hypothesis. No alternate weights, thresholds, lookbacks, instruments, or post-outcome variants are permitted in Phase 2A.

### A — trend continuation

Long when the latest eligible close is strictly above SMA-200 and its 20-bar close return is positive. Short when close is strictly below SMA-200 and the 20-bar return is negative. Equality, zero return, or insufficient history abstains.

### B — breakout with volume confirmation

Long when the latest eligible close strictly exceeds the maximum high of the **preceding** 20 bars, is above SMA-200, and latest volume is at least 1.5 times the median volume of those preceding 20 bars. Short uses the preceding-20 minimum low and below-SMA-200 test with the same volume rule. The current bar is excluded from the breakout and volume references. Missing, invalid, or zero reference volume cannot pass.

The live dossier's funding, OI, news, fundamentals and provider factors are not historically reconstructable from this extract. Historical replay of that complex strategy is unsupported; Phase 2A is a new OHLCV-only experiment.

## Splits, purging and locked holdout

Partitions use common market dates, never random rows or per-ticker shuffles.

- Crypto development: available history through 2026-06-30; validation fold 1: 2026-07-01 through 2026-07-31; validation fold 2: 2026-08-01 through 2026-08-31; locked holdout starts 2026-09-01.
- Equity development: available history through 2026-08-14; validation fold 1: 2026-08-17 through 2026-09-04; validation fold 2: 2026-09-08 through 2026-09-18; locked holdout starts 2026-09-21.

Warm-up bars may precede a split boundary, but all features at a decision cutoff use only bars available by then. At each fold boundary, observations whose label availability reaches the later period are purged. Shared selection applies the 30-unit maximum horizon. Every selection input must have a label available by selection time. The ordinary `research:validate` command only reads `train-validation-bars.json`, which physically omits locked rows. It reports holdout date range, count and hash from the manifest; it has no holdout evaluation path.

Actual holdout outcomes have not been examined by the research command. The source acquisition layer necessarily computed row counts and hashes while separating the material; that is disclosed and is not a performance read.

## Baselines, costs and selection

Baselines are always-long, always-short, SMA-200 direction, and cash/no-position. They use the identical instrument, entry, exit, horizon and price basis. Baselines are reported on the full eligible schedule and on each candidate's emitted timestamps.

Frozen round-trip cost assumptions:

- Equity central 10 bps; stressed 30 bps.
- Crypto central 20 bps; stressed 50 bps.

These are explicit modeling assumptions, not observed fees or slippage. Borrow, locate, financing and crypto funding are unavailable; short economics are hypothetical and execution feasibility is unknown.

For each market/horizon, selection maximizes pooled out-of-fold mean modeled-net signed return under the central cost among candidates that have at least 40 matured emitted observations, at least 20 unique decision dates, at least five long and five short decisions, positive mean modeled-net return, and a positive lower 90% time-block interval versus zero. Ties prefer trend continuation as the simpler rule. If no candidate qualifies, selection is `none`.

## Uncertainty and reporting

The report includes counts for eligible decisions, emissions, abstentions, data/feature exclusions, matured, pending and unverified labels; hit/flat and long/short results; mean, median, dispersion, 5th-percentile downside and central/stressed costs; unique assets/dates and overlapping exposure counts; matched baseline differences; and fold sensitivity.

Uncertainty uses a deterministic time-block bootstrap that resamples whole date panels. Block length is 30 market dates, at least the maximum evaluated horizon; 1,000 resamples use frozen seed `22026009`. If fewer than four non-overlapping date blocks are available, no interval is reported and the limitation is explicit. No exact effective sample size is invented.

## Trial discipline and stop rule

`research/config/trial-registry.json` is the complete Phase 2A trial list. Every run records its configuration hash and outcome status. No hidden search is allowed. Phase 2A stops after validation artifacts are created. It does not open the holdout, promote a candidate, change live weights, issue a trade, alter prospective cohorts, or proceed to Phase 2B.
