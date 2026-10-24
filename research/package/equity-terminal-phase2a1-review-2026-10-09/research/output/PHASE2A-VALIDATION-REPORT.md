# Phase 2A validation report

Generated: 2026-10-09T16:23:05Z
Cohort: `phase2a-ohlcv-v1`

## Decision

No Phase 2A candidate qualifies for holdout review. The frozen holdout remains unopened. This is an underpowered survivor-sample exploration, not evidence of predictive edge.

## Selections

| Market | Horizon | Selected | Reason |
|---|---:|---|---|
| equity | 5 | none | No registered candidate met the frozen sample, coverage, direction-balance, economics, and uncertainty checks. |
| equity | 30 | none | No registered candidate met the frozen sample, coverage, direction-balance, economics, and uncertainty checks. |
| crypto | 5 | none | No registered candidate met the frozen sample, coverage, direction-balance, economics, and uncertainty checks. |
| crypto | 30 | none | No registered candidate met the frozen sample, coverage, direction-balance, economics, and uncertainty checks. |

## Pooled validation candidates

Returns are decimal event returns; 0.01 = 1%. Hit rate excludes flats. Costs are modeled assumptions.

| Trial | Issued / eligible | Accepted matured | L / S | Hit rate | Mean gross | Mean central net | SMA-200 matched | 90% block interval |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| equity-5-trend-v1 | 52 / 72 | 35 | 35 / 0 | 0.28571429 | -0.00738973 | -0.00838973 | -0.00738973 | Only 1 non-overlapping date block(s); 4 required. |
| equity-5-breakout-v1 | 0 / 72 | 0 | 0 / 0 | — | — | — | — | Only 0 non-overlapping date block(s); 4 required. |
| equity-30-trend-v1 | 52 / 72 | 0 | 0 / 0 | — | — | — | — | Only 0 non-overlapping date block(s); 4 required. |
| equity-30-breakout-v1 | 0 / 72 | 0 | 0 / 0 | — | — | — | — | Only 0 non-overlapping date block(s); 4 required. |
| crypto-5-trend-v1 | 59 / 124 | 44 | 12 / 32 | 0.34090909 | -0.03697724 | -0.03897724 | -0.03697724 | Only 1 non-overlapping date block(s); 4 required. |
| crypto-5-breakout-v1 | 5 / 124 | 5 | 5 / 0 | 1 | 0.04233189 | 0.04033189 | 0.04233189 | Only 1 non-overlapping date block(s); 4 required. |
| crypto-30-trend-v1 | 59 / 124 | 0 | 0 / 0 | — | — | — | — | Only 0 non-overlapping date block(s); 4 required. |
| crypto-30-breakout-v1 | 5 / 124 | 0 | 0 / 0 | — | — | — | — | Only 0 non-overlapping date block(s); 4 required. |

## Full eligible-schedule baselines

| Market | Horizon | Matured rows | Mean long gross / central / stressed | Mean short gross / central / stressed | Mean SMA-200 gross / central / stressed | Cash |
|---|---:|---:|---|---|---|---:|
| equity | 5 | 42 | -0.00629874 / -0.00729874 / -0.00929874 | 0.00629874 / 0.00529874 / 0.00329874 | -0.00629874 / -0.00729874 / -0.00929874 | 0 |
| equity | 30 | 0 | — / — / — | — / — / — | — / — / — | 0 |
| crypto | 5 | 96 | 0.03298445 / 0.03098445 / 0.02798445 | -0.03298445 / -0.03498445 / -0.03798445 | -0.02965331 / -0.03165331 / -0.03465331 | 0 |
| crypto | 30 | 0 | — / — / — | — / — / — | — / — / — | 0 |

## Holdout lock

- Opened: **no**
- Locked rows: 105
- Locked aggregate SHA-256: `0abaedd5728b52a2400ec6d5fbeae4ee81cb7c202c8ac54f63c9f427ef6d2ea1`
- Equity range: 2026-09-21 through 2026-10-07
- Crypto range: 2026-09-01 through 2026-10-07
- Performance: deliberately absent.

## Limits

- Current-survivor exploratory sample; historical membership and delisted instruments unavailable.
- Current-survivor exploratory sample only; no delisted/inactive membership history.
- Only about one year of daily history was available; 200-bar warm-up leaves short validation windows.
- Equity inputs are unadjusted price OHLCV without a corporate-action feed; results are price returns, not total returns.
- Short borrow, locate, financing and crypto funding were unavailable, so short economics are hypothetical.
- The locked holdout was not opened and no Phase 2A candidate was promoted.

Per-fold counts and metrics, all train/validation observations, matched baselines, costs, and purge states are in the machine-readable exports. No outcome was merged into the legacy scoreboard.
