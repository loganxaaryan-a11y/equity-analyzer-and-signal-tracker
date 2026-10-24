# Proposed timing and power protocol — expert review draft

Status: proposal only. It has not been executed and does not replace the original frozen success criterion.

## Why a second estimand is needed

At a candidate's emitted timestamps, the candidate and matched SMA-200 baseline have the same direction, entry, exit and costs by construction. Their event returns must be equal. This is a useful passing sanity check for estimand alignment, but it cannot measure whether trend or breakout filters selected better dates.

The original no-selection outcome remains. No already viewed validation result is reclassified under this proposal.

## Separate questions

1. **Directional value at emitted timestamps:** compare candidate direction with always-long, always-short and SMA direction on the same asset/date/horizon. Matched candidate/SMA equality is expected when their directions agree.
2. **Timing/filter value:** compare the candidate's selected dates with a predeclared alternative schedule drawn without forward returns from dates that share the asset, fold, prior-information-only SMA direction and a frozen prior volatility/liquidity state.
3. **Portfolio economics:** not measured here. Event returns may overlap and are not summed or annualized.

## Frozen comparator candidate

For each market, horizon, asset, fold and prior SMA direction:

- candidate events retain their actual selected dates;
- comparator dates are sampled without replacement from eligible non-candidate dates in the same stratum;
- the comparator has the same event count as the candidate where the stratum has enough dates;
- a fixed recorded seed determines sampling;
- no outcome, future volatility, future rank or future liquidity enters the strata or sampling;
- insufficient strata are reported, not relaxed after outcomes are viewed.

The primary timing estimand is the paired difference between candidate event-level central-net signed return and the equal-count schedule comparator's central-net signed return. Coverage, abstention rate and unmatched events are reported separately. This remains an event-level selection diagnostic, not a tradable portfolio.

## Dependence and power gate

Resample complete scheduled-market-date blocks at least as long as the 30-unit maximum horizon. Each sampled date carries the entire cross-asset panel, including dates with no candidate emission. Short tails are not full blocks. Report the number of full blocks and refuse interval-based qualification below the predeclared minimum.

Before execution, simulate power under fixed effect sizes and the observed prior-information strata without using market outcomes to tune parameters. The positive synthetic control must qualify and fixed-seed negative controls must have an acceptably low false-qualification rate. The expert must approve the effect-size grid, number of comparator draws, seed list, block method and qualification rule before any market result is computed.

## Holdout and exposure

This proposal cannot use the reserved holdout. Already inspected validation dates are development evidence only. If approved, it receives a new versioned registry and produces a separately labeled diagnostic; it cannot overwrite the Phase 2A report, enter the legacy scoreboard, or promote a strategy.
