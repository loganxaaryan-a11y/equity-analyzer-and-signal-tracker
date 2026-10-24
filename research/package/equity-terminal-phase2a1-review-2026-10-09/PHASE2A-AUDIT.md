# Phase 2A audit

Date: 2026-10-09  
Scope: offline OHLCV research only

## Implemented

- Frozen `PHASE2A-RESEARCH-SPEC.md`, eight-trial registry, dataset manifest, and pre-outcome hashes. The first run exposed a fixed-16:00 equity availability defect on early-close dates; the input was corrected to the shared XNYS calendar, rehashed and rerun without changing OHLCV or research choices. The invalidated freeze and prior outcome exposure remain disclosed; all candidate, baseline and selection reports were identical after correction.
- One pure TypeScript harness shared by equity and crypto, with separate 5/30 horizon contracts.
- Exact frozen trend-continuation and breakout-with-volume hypotheses; no parameter search or ticker-subset search.
- Completed/available-bar filtering, first-subsequent-eligible-open entry, fixed-horizon exits, linear directional returns, explicit flat outcomes, and modeled central/stressed costs.
- Common-date chronological folds, label-availability purging, prior-context feature warm-up, and a physically absent holdout from the ordinary command.
- Always-long, always-short, SMA-200 and cash baselines on the full eligible schedule and candidate-emission timestamps.
- Per-fold and pooled counts, returns, matched differences, long/short split, data exclusions, overlap counts, and time-block uncertainty with an explicit few-block failure state.
- Machine-readable observations, reports, selections, trial-run log, fixture manifest, provenance report, and holdout-lock command evidence.
- Cohort/version isolation: every observation is `phase2a-ohlcv-v1`; the harness rejects a registry that permits legacy-scoreboard merge.

## Native verification

Environment: Bun 1.4.2 on Linux x64; project TypeScript 5.6.3.

| Command | Result |
|---|---|
| `bun test` | 55 passed, 0 failed: 34 retained Phase 1 tests plus 21 Phase 2A tests |
| `bun run typecheck` | passed for client, server and research TypeScript projects |
| `bun run research:validate` | 5,672 observations, zero selections, holdout opened `false` |
| `bun research/src/command.ts open-holdout` | rejected with exit code 1 and the Phase 2A holdout-block message |

Full output is stored under `research/output/`. No adapted-run or reported-only evidence is counted as a Phase 2A acceptance result.

## Outcome

No candidate merits holdout review or further promotion from this run.

- Equity 5-session trend: 35 accepted matured emissions, all long; mean central-net return -0.00838973.
- Equity breakout: no validation emissions.
- Crypto 5-day trend: 44 accepted matured emissions; mean central-net return -0.03897724.
- Crypto 5-day breakout: five accepted matured long emissions; mean central-net return 0.04033189, but it fails frozen sample size, direction balance, unique-date coverage and uncertainty checks.
- Thirty-unit candidates have no accepted matured validation emissions after boundary purging.
- Every uncertainty interval is unavailable because the validation window has fewer than four non-overlapping 30-date blocks.

This is a valid negative/insufficient result. The one-year survivor sample and 200-bar warm-up leave too little evidence to judge edge. The locked holdout remains unopened and unspent.

## Independently testable

A reviewer can rerun the exact commands above. Inputs needed for the train/validation run are included. The command verifies raw file hashes against the frozen pre-outcome record before computing performance. Synthetic regression fixtures are identified in `research/fixtures/fixture-manifest.json`; test source contains the deterministic generators and assertions.

## Unsupported

- Historical reconstruction of the existing live dossier strategy and its funding, OI, news, fundamentals or other provider factors.
- Historical whole-market selection, delisted/inactive membership, ETF/leveraged-instrument results, or runner recall.
- Total-return equity results, dividend effects, or verified real corporate-action events from this source extract.
- Executable short economics, borrow/locate availability, funding, observed slippage, portfolio aggregation or annualization.
- Intraday prediction, first-touch trade-path conclusions, live predictive edge, or production reliability.

## Pending

- Final holdout evaluation, which requires a separately reviewed Phase 2B decision and cannot be run by the ordinary command.
- Any prospective shadow evaluation or strategy promotion.
- More historical, corporate-action-aware data sufficient for several regimes and uncertainty blocks.
- The operational items retained in `research/OPERATIONAL-APPENDIX.md`.

Phase 2A stops here. Nothing was promoted, no live weight or issued contract changed, and no result entered the legacy scoreboard.
