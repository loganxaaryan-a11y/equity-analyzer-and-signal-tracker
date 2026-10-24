# Equity measurement integrity — bounded completion/crash closeout

**Date:** 12 October 2026  
**Scope:** completion/crash correctness, real-handler recovery evidence, exact export reproducibility. Strategy rules, frozen holdouts, issued contracts, raw snapshots, and prior grades were not changed.

## Finding → source → evidence

| Finding | Repair in the exact checkout | Regression / evidence | Result |
|---|---|---|---|
| A. Terminal item rows could read COMPLETE before cursor commit | `measurementCompletionPredicate` in `server/src/actions.ts` is shared by the commit path, `measurementRunView`, and `lastValidCompletedAt`. It requires exact identity reconciliation, zero queued/retry-pending members, `cursor === totalInScope`, persisted `status === complete`, and non-null `completedAt`. | `measurement_worker.integration.test.ts`: cursor 0 and 49 predicate counterexamples; 50 terminal members at cursor 0 remain incomplete until `runMeasurementBatch` advances the frozen cursor to 50 in one committed batch. | Closed offline. |
| B1. Prior tests copied SQL instead of driving the worker | `runMeasurementBatch` is exported with injected history provider, cached-provider, clock, and three failure hooks. Tests instantiate isolated SQLite with every production migration and call the production handler. | Actual-handler mixed batch: one valid evaluable contract, one provider failure, one immutable-contract exclusion. Result: evaluated 1 / retry-pending 1 / excluded 1, cursor 3; two accepted product revisions. | Closed offline. |
| B2. Accepted write interrupted before cursor commit | Idempotent revision identity constraint plus terminal catch-up preserves accepted rows and advances only the frozen cursor. | Injected `afterItemWrite` crash leaves cursor 0. A fresh action context resumes: revision count and immutable history SHA-256 unchanged, duplicate delta 0, rewrite delta 0, one cursor commit. | Closed offline. |
| B3. Expired worker could write after losing ownership | Lease CAS acquisition plus `refreshMeasurementLease` fences every intermediate item/revision path; final cursor CAS also includes lease version. | Worker A pauses inside the injected provider; clock advances six minutes; Worker B reacquires and completes; Worker A resumes and receives `LEASE_LOST`. Final evidence: cursor 1, exactly two product revisions, one batch row. | Closed offline for the tested boundary; not a deployed forced-kill claim. |
| B4. Crash after cursor commit could lose batch audit evidence | Migration `0034_measurement_batch_commit_journal.sql` adds a durable journal and atomically links the committed cursor row to its journal ID. Read recovery materializes `measurement_run_batches` only from that cursor-linked journal, then clears the pointer. | Injected `afterCursorCommit` crash: cursor/status/complete metadata persisted, journal 1, batch rows 0. Fresh handler/read recovery materializes exactly one batch row with measured revision identities and history hashes. | Closed offline. |
| C. Export was incomplete and non-reproducible | This archive preserves the checkout layout, includes `research/src`, `research/tsconfig.json`, configs/data/outputs, migrations, lockfile, and a vendored Hatch SDK tarball. `package.json` points to `vendor/space-sdk.tgz`; `research:validate` targets the current closure validation rather than the superseded repair freeze. | Archive-root `MANIFEST.tsv` records SHA-256 and byte length for every payload file. `PACKAGE-README.md` gives install and verification commands. | Closed. |
| Presentation: mixed quote/change timestamps and incorrect volume currency | The mark observation keeps value/event/receipt/success/source/venue/pointer together. `instrument.changePercent` is explicitly `SESSION Δ` from the analysis snapshot timestamp. Yahoo chart raw volume is labeled `shares`, `contracts`, or `base units` by instrument convention and explicitly not quote-currency notional. | Client/server strict typechecks passed; managed build and 390px/desktop audit passed with no overflow, clipping, console errors, or broken assets. | Closed for labeling; requested 320/375/768 and keyboard evidence remains pending. |

## Actual-handler evidence

The production-action integration suite is `server/src/measurement_worker.integration.test.ts`. It does not reproduce worker SQL in a miniature helper. Each test:

1. creates isolated in-memory SQLite;
2. executes the complete ordered `drizzle/*.sql` production migration set;
3. constructs a real Drizzle database/`Ctx`;
4. calls exported `runMeasurementBatch`;
5. measures persisted run cursors, item states, revision multiplicities, immutable revision projections/hashes, journals, and batch rows.

The six actual-handler tests passed with 34 assertions. The complete native suite passed **104/104 tests, 310 assertions**.

## Reproduction commands and exits

| Command | Exit | Log |
|---|---:|---|
| `bun install --frozen-lockfile` | 0 in exact-package verification | `logs/package-reproduction.log` |
| `bun run test` | 0 — 104 pass, 0 fail | `logs/native-tests-final.log` |
| `bun x tsc --noEmit -p server/tsconfig.json` | 0 | `logs/server-typecheck-final.log` |
| `bun x tsc --noEmit -p client/tsconfig.json` | 0 | `logs/client-typecheck-final.log` |
| `bun x tsc --noEmit -p research/tsconfig.json` | 0 | `logs/research-typecheck-final.log` |
| `bun run research:validate` | 0 | `logs/research-validate-final.log` |
| managed `web_artifacts.build` | success | `logs/managed-build-final.json` |
| managed `web_artifacts.audit` | pass | `logs/managed-audit-final.json` |

## Evidence boundaries still pending

- No production measurement run was started; sandbox rows and isolated SQLite tests are not production proof.
- Artifact-owned scheduler enablement, consecutive production cycles, controlled outage/recovery, and forced deployed-worker termination remain pending because this builder had no authorized operational/deployment path.
- 320/375/768 CSS-pixel and keyboard-open/dismissed captures remain pending. The managed audit verified desktop 1440 and mobile 390 only; mobile had 0px overflow and no clipped controls.
- Crypto `H_NO_DATA` / `W_NO_DATA` originating records are not present in this equity checkout.
- The managed content critic could not attribute full production-handler source from its truncated source comparison and found no measurement run in sandbox state. The complete source, tests, logs, and hashes in this package are the offline review surface; this is not represented as deployed evidence.

## Integrity statement

Holdouts remain locked. No strategy threshold, score, direction rule, promotion decision, issued record, raw snapshot, or prior grade was rewritten. This package establishes bounded offline completion/crash correctness and reproducibility; it does not establish improved predictive performance.
