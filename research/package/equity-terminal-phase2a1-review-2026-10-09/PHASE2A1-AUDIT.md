# Phase 2A.1 measurement and reproducibility repair audit

Date: 2026-10-09  
Scope: equity/shared research harness only; no new strategy search, holdout evaluation or live promotion.

## Issue resolution

| Expert finding | Resolution | Regression evidence |
|---|---|---|
| Missing bars compressed or stretched the horizon | Entry and exit dates now come from the registered market clock. Crypto uses elapsed UTC dates; equity uses XNYS sessions. Exact entry and endpoint bars are required. Endpoint-only labels allow an intermediate outcome gap but never shift the endpoint. Feature lookbacks require every scheduled bar. | July 3–8 crypto counterexample; missing endpoint; missing feature session; XNYS holiday and early-close fixtures. |
| Candidate net was compared with baseline gross | Every baseline now exports gross, central net and stressed net. Gross differences use gross values; central-net differences use central-net values. | Identical trend candidate and matched SMA decisions produce zero gross difference and zero central-net difference. |
| Holdout safety depended on truncated input | The pure engine scans every series and rejects a holdout-dated bar before validating bars, building features, labels or reports. The CLI has the same guard path. | Synthetic holdout injection fails both direct `buildObservations` and `command.ts guard-input`. The ordinary validation input remains physically truncated and hash checked. |
| Uncertainty blocks counted emitted dates | Blocks now come from the complete registered market-date grid, preserve the whole cross-asset date panel, use only full 30-date blocks and disclose the short tail. Absolute and paired-difference intervals are separately named. | Crypto validation grid reports 62 scheduled dates, two full 30-date blocks and a two-date excluded tail. |
| Executable rules could diverge from readable freeze | A Phase 2A.1 registry now contains executable parameters and split boundaries. The raw engine SHA-256 is embedded in that registry and independently rechecked against `PHASE2A1-FREEZE.json` before a run. Original Phase 2A freeze hashes are rechecked first. | Freeze command rejects changed spec, original registry, dataset manifest, input, correction registry, engine or original report. |
| Positive/negative instrument controls absent | A separate synthetic cohort now tests guaranteed pre-decision signal value and independent noise across 12 fixed seeds. Controls never enter market observations or selection. | Positive control must qualify or the correction command stops. Negative seed outcomes and false-qualification count are exported. |
| Original outputs could be overwritten | Original candidate report, observations, run log and invalidated availability disclosure remain untouched. Corrections use `phase2a1-*` filenames and a comparison export. | Hash of the original candidate report is bound into the repair freeze. |
| Longer equity history underpowered | Added an acquisition/readiness plan using the terminal's existing maximum-history Yahoo path, consistent corporate-action normalization and pre-outcome power gates. | Planning document includes schedule counts and usable-count formulas; no performance was run. |
| Matched SMA cannot test timing | Equality is documented as a sanity check. A separate versioned equal-count timing comparator is proposed for expert review and not executed. | Protocol explicitly separates direction, timing and portfolio estimands. |

## Synthetic control design

The positive control records a deterministic binary feature before each synthetic decision. The later return is generated from that already-recorded feature, so the feature predicts the future outcome by construction without reading future information. The negative control uses independent deterministic PRNG streams for signal and later outcome across fixed seeds.

The control qualification rule requires at least 40 events, positive mean modeled-net return and a positive lower 90% complete-date-block interval. It deliberately does not require candidate outperformance against an identical matched-SMA return stream: that requirement would make a guaranteed positive control impossible to pass because identical decisions, entries, exits and costs must produce zero difference. Matched-SMA equality remains a market-estimand sanity test, not the control's edge-detection gate.

Synthetic outputs use cohort `phase2a1-synthetic-controls-v1`, are saved only to `research/output/phase2a1-synthetic-controls.json`, and are never merged with market evidence or legacy scores.

## Preserved decisions and limits

- Original Phase 2A results and prior availability exposure remain disclosed.
- The no-promotion decision remains unchanged.
- The current input remains a small survivor sample; `no candidate qualified under this run's rules` is supported, while `no edge exists` is not.
- The reserved holdout remains unopened; no actual holdout performance is present.
- No weights, indicators, strategy parameters, live issuance contract or legacy scoreboard changed.
- Live issuance, production persistence atomicity, scheduler/recovery cycles and incident-log evidence remain open in `research/OPERATIONAL-APPENDIX.md`.

## Review files

- Original: `PHASE2A-RESEARCH-SPEC.md`, `research/config/PHASE2A-FREEZE.json`, `research/output/candidate-report.json`
- Repair freeze: `research/config/PHASE2A1-FREEZE.json`, `research/config/phase2a1-trial-registry.json`
- Engine/tests: `research/src/harness.ts`, `research/src/harness.test.ts`, `research/src/command.ts`
- Corrected outputs: `research/output/phase2a1-*`
- Plans: `research/PHASE2A1-LONGER-HISTORY-PLAN.md`, `research/PHASE2A1-TIMING-POWER-PROTOCOL.md`
- Operational limitations: `research/OPERATIONAL-APPENDIX.md`
