# Equity terminal Phase 2A review package

This package contains the fresh artifact source, unchanged migration history, frozen Phase 2A research specification/configuration, normalized train/validation inputs, provenance/hashes, machine-readable observations and reports, regression tests with native output, holdout-lock evidence, audit, and operational appendix.

No schema migration was required. The web client and production server actions were not functionally changed by Phase 2A; they are included so a reviewer can confirm isolation and rerun the retained Phase 1 tests.

The final holdout bars and performance are not included. `dataset-manifest.json` carries only their boundary, count and hashes.
