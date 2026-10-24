# Operational appendix — still open after Phase 2A

Phase 2A is isolated research. It does not close or retest the production-path limitations retained from Phase 1.

| Item | Status | Evidence in this package |
|---|---|---|
| Live issuance with a genuine new signal | pending | None; no issuance was attempted. |
| Production persistence atomicity | pending | Phase 1 synthetic/mock evidence remains narrower than production database rollback evidence. Phase 2A does not modify this path. |
| Two consecutive scheduled evaluator/recovery cycles | pending | None; Phase 2A is an offline command with no scheduler. |
| Production incident/root-cause logs | unavailable/pending | No incident log was available and none was invented. |
| Live strategy weights or contract promotion | not attempted | Explicitly outside Phase 2A. |
| Legacy-scoreboard merge | prohibited and regression-tested | Phase 2A uses a separate cohort; the research harness rejects merge-enabled configuration. |

Before any new strategy enters live issuance, the production issuance, persistence, scheduler/recovery and incident-evidence questions require their own operational verification. A favorable future research result would not substitute for those checks.
