# Phase 2A.1 corrected validation report

Generated: 2026-10-09T18:16:00Z
Market cohort: `phase2a-ohlcv-v1`
Synthetic controls: `phase2a1-synthetic-controls-v1` (separate file and cohort)

## Decision

The original no-promotion decisions remain unchanged. This correction repairs measurement and reproducibility defects; it does not open the holdout, add a strategy, or claim that no edge exists.

## Corrected pooled candidates

Returns are decimal event returns. Gross is compared with gross; central modeled-net is compared with central modeled-net.

| Trial | Accepted | Mean gross | Mean central net | Gross − SMA | Central net − SMA net | Scheduled-grid blocks |
|---|---:|---:|---:|---:|---:|---|
| equity-5-trend-v1 | 35 | — | — | — | — | 0 × 30; tail 24 |
| equity-5-breakout-v1 | 0 | — | — | — | — | 0 × 30; tail 24 |
| equity-30-trend-v1 | 0 | — | — | — | — | 0 × 30; tail 24 |
| equity-30-breakout-v1 | 0 | — | — | — | — | 0 × 30; tail 24 |
| crypto-5-trend-v1 | 44 | -0.03697724 | -0.03897724 | 0 | 0 | 2 × 30; tail 2 |
| crypto-5-breakout-v1 | 5 | 0.04233189 | 0.04033189 | 0 | 0 | 2 × 30; tail 2 |
| crypto-30-trend-v1 | 0 | — | — | — | — | 2 × 30; tail 2 |
| crypto-30-breakout-v1 | 0 | — | — | — | — | 2 × 30; tail 2 |

## Synthetic instrument controls

- Positive control: 320 events; mean modeled net 0.00652253; lower 90% 0.00652253; qualified **yes**.
- Negative control: 0/12 fixed seeds falsely qualified.
- At least 40 events, positive mean modeled-net return, and a positive lower 90% complete-date-block interval. Direction-balance is not imposed on the control because its purpose is instrument sensitivity, not strategy eligibility. Imposing matched-SMA outperformance would make the positive control impossible whenever SMA is assigned the identical synthetic decisions; that comparator is therefore a sanity equality check, not the control's qualification gate.
- Synthetic controls are emitted only to research/output/phase2a1-synthetic-controls.json and are never appended to market observations, candidate reports, selections, or the legacy scoreboard.

## Holdout lock

- Engine guard: rejects every bar on or after each market's registered holdout boundary before feature or label construction.
- Locked rows (manifest only): 105
- Locked aggregate SHA-256: `0abaedd5728b52a2400ec6d5fbeae4ee81cb7c202c8ac54f63c9f427ef6d2ea1`
- Opened: **no**; performance: absent.

## Limits

- Current-survivor exploratory sample; historical membership and delisted instruments unavailable.
- Current-survivor exploratory sample only; no delisted/inactive membership history.
- Only about one year of daily history was available; 200-bar warm-up leaves short validation windows.
- Equity inputs are unadjusted price OHLCV without a corporate-action feed; results are price returns, not total returns.
- Short borrow, locate, financing and crypto funding were unavailable, so short economics are hypothetical.
- Endpoint-only direction labels allow missing intermediate outcome bars but require the exact scheduled entry and endpoint; feature lookbacks require every scheduled bar.
- The locked holdout was rejected at the engine boundary, not opened, and no Phase 2A candidate was promoted.
