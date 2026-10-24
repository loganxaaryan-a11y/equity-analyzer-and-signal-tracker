# Phase 2A / Phase 2A.1 offline research harness

## Reproduce the repaired review run

From the artifact root:

```bash
bun run research:phase2a1
bun test
bun run typecheck
bun research/src/command.ts open-holdout   # must fail closed
```

The repair command verifies the original Phase 2A freeze first, then verifies the Phase 2A.1 registry, executable engine hash, unchanged physical train/validation input, and original candidate-report hash. It writes only separately versioned correction files:

- `output/phase2a1-train-validation-observations.json`
- `output/phase2a1-corrected-report.json`
- `output/phase2a1-synthetic-controls.json`
- `output/phase2a1-original-vs-repaired.json`
- `output/PHASE2A1-CORRECTED-REPORT.md`

Original Phase 2A reports remain in place. The repair does not represent familiar outcomes as unseen evidence.

## Holdout boundary

The physical input still contains no reserved holdout bars. In addition, the pure engine rejects any bar on or after the registered holdout boundary before feature, label, observation or report construction. The CLI guard uses the same engine boundary. Synthetic fixtures exercise both direct engine and command paths; no real holdout label is read.

## Structure

- `src/harness.ts` — pure market clocks, frozen hypotheses, exact timing/labels, matched baselines/costs, scheduled-grid uncertainty, selection and separate synthetic controls.
- `src/command.ts` — two-layer freeze verification and reproducible, versioned output writer.
- `src/harness.test.ts` — market-clock, missing-bar, estimand, holdout, freeze-isolation and synthetic-control regressions.
- `config/trial-registry.json` — untouched original registry.
- `config/phase2a1-trial-registry.json` — executable repair parameters, splits and engine hash.
- `config/PHASE2A1-FREEZE.json` — repair registry/engine/input/original-report hashes.
- `PHASE2A1-LONGER-HISTORY-PLAN.md` — lawful acquisition and readiness plan; no performance search.
- `PHASE2A1-TIMING-POWER-PROTOCOL.md` — unexecuted timing-estimand proposal for expert review.
- `output/` — original and separately versioned corrected machine-readable evidence.

This directory performs no network calls, database writes, live issuance, strategy promotion or legacy-scoreboard merge.
