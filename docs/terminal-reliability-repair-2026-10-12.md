# Equity terminal reliability repair — 2026-10-12

## Cover note

This checkout preserves issued signals and prior evaluation revisions. It adds a bounded, resumable, auditable measurement run; makes the saved-factor reader backward compatible; keeps records with absent optional factor detail in cohort accounting; and removes directional-proxy “expectancy”/kill advice from the tracker and sizing surface. Direction, present eligibility, freshness and edge validation are now separate labels.

No strategy threshold, score weight, holdout, frozen contract, historical decision, level or timestamp was changed. No strategy was promoted.

## Finding → cause → repair → regression → remaining limitation

| Finding | Status | Cause | Repair | Regression evidence | Remaining limitation |
|---|---|---|---|---|---|
| Optional/legacy factor payload could make a record disappear from monitoring/statistics | Reproduced in source | Daily monitoring and accepted-outcome statistics required a non-empty parsed factor array | Versioned read adapter accepts bare arrays and `{factors:[]}` wrappers; null/absent optional rows become a visible `factorReadIssue`; tracking no longer filters on optional factor detail | Build typecheck; sandbox `getsignaltracker` remains callable; malformed detail is reported rather than changing issuance | Production crypto null-note fixture belongs to the separate crypto artifact and is not evidence for this equity action |
| Monolithic daily evaluator could time out and conceal partial work | Reproduced architectural risk | One action fetched/evaluated the entire ledger | `runMeasurementBatch`: frozen membership, persisted authoritative cursor, maximum 20 per batch, append-only evidence identities, retry-pending IDs and explicit PARTIAL/FAILED/COMPLETE status | Item ledger and batch ledger expose every attempt; action/audit evidence is in the final archive | Consecutive production cycles are pending; build sandbox is not production execution |
| Trade state and grading state were conflated in summary language | Reproduced | One `pending/open` bucket carried both the position lifecycle and evaluator availability | `measurement_run_items` persists independent `trade_state` (`open/resolved/unknown`) and `grading_state` (`queued/evaluated/excluded/retry_pending`); failed grading preserves the prior trade state | Reconciliation UI renders the two state families in separate panels and on every ID row | Production-cycle proof remains pending |
| Existing run could not account for every frozen ID | Reproduced | Run-level counters had no durable item ledger or explicit per-ID reason | `measurement_run_items` creates exactly one row per frozen member at run start; every batch writes retrieval, eligibility, state, reason, attempt and evidence identities; arithmetic is `in scope = evaluated + excluded + retry-pending + queued` | Runtime response schema and UI require all ID rows and a `reconciled` arithmetic flag | A real 50-row run must be executed after deployment to provide deployed counts |
| Worker restart/repeated batch had no durable proof surface | Reproduced | Cursor existed, but no persisted batch boundary or replay operation | `measurement_run_batches` stores requested IDs, before/after cursor and revision counts. `replay_last` repeats the same IDs under the same run ID; evidence identity makes equal evaluations no-ops and no history-update path exists | UI exposes cursor, IDs, revisions before/after, duplicate rows created and history rows rewritten | Controlled deployed restart/recovery remains pending |
| Existing run could not be audited | Reproduced | No durable per-ID or per-batch evidence | `measurement_runs`, `measurement_run_items` and `measurement_run_batches` record run/cohort/evaluator/build/cutoff/times/membership/cursor/states/reasons/attempts/evidence identities | Reconciliation and restart evidence are queryable after refresh through `getLatestMeasurementRun` | Evidence-source revision metadata remains in append-only evaluation revisions rather than duplicated into the run row |
| “FRESH BUILD” implied fresh inputs | Reproduced | Delivery implementation label surfaced as freshness language | Replaced by `Analysis generated at`, independently of market-data freshness | UI audit required | None |
| Stored theory `LIVE` implied fresh evidence | Reproduced | Theory lifecycle and evidence recency shared one visual label | `ACTIVE RESEARCH THEORY` plus separate evidence update and stale/recent label | UI audit required | The current stale threshold remains the application-wide freshness policy |
| Legacy directional proxy presented as expectancy/kill input | Reproduced | +1/−1 outcome summary was reused as if it were trading R | Tracker now says legacy fixed-horizon directional diagnostic; no R/expectancy/kill output. Sizing is only arithmetic on user-entered risk, entry, stop and cost assumptions | UI audit required | Actual execution costs/fills remain unmeasured and are explicitly withheld |
| PLTR-style sample badge overstated validation | Reproduced | Replay coverage used “sample sufficient” | Renamed baseline replay coverage and placed `EDGE UNVALIDATED` next to assessment | UI audit required | Walk-forward sample remains legacy research context only |
| Claimed 06:00 daily equity post-mortem | Reproduced schedule mismatch | Artifact-owned job is disabled and configured 06:46 `@user.current`; a separate goal-owned combined review runs 06:00 America/Toronto | No schedule changed in this repair. Configuration and execution evidence are reported separately below | Scheduler read on 2026-10-12 | Artifact-owned post-mortem remains disabled pending owner decision; combined job is not a replacement for artifact run completeness |
| Stale mark labelled “CURRENT MARK” on home signal cards | Reproduced | Label was static even when the freshness row said stale/error or only a legacy observation existed | Home card now says `CURRENT MARK` only for a fresh live quote; all other observations say `LAST KNOWN MARK`, while the timestamp/source-age line remains visible | Multi-viewport UI audit in the final archive | None |
| H_NO_DATA / W_NO_DATA | Investigation required / external evidence missing | Whole-checkout search found no producer field, normalizer, DB column/value, scoring input, or UI token named `H_NO_DATA`/`W_NO_DATA`; the only occurrence was the earlier repair note | No guessed remapping, neutral vote, schema field or synthetic trace added. The existing input-state model continues to distinguish fresh/stale/unavailable/error and never awards direction for absence | Exact search command and zero code/data-path matches are in the archive log | A concrete originating terminal, record ID and raw provider payload are required to trace provider → normalization → storage → score → UI. This equity checkout cannot honestly invent that provenance |
| Revenue shown as “USD 5745” | Investigation required | No confirmed occurrence found in the touched equity UI/source | No speculative unit scaling added | — | Requires provider raw field, scale, currency, period and source from the reported record |

## Measurement definitions

- **in scope**: ordered signal IDs frozen when the run starts.
- **retrieved**: frozen IDs whose immutable ledger row was read.
- **eligible/due**: retrieved rows with the complete contract required by evaluator 3.2.0.
- **evaluated**: eligible rows with fresh or cached daily OHLC evidence supplied to the evaluator.
- **pending**: evaluated trade setups still open.
- **ambiguous**: target and stop first observed in the same daily bar.
- **unverified**: available evidence cannot prove the contract result.
- **excluded**: immutable contract fields needed by this evaluator are absent.
- **failed**: no fresh or cached evidence; grading is retry-pending while trade state remains independently open/resolved/unknown.
- **queued**: frozen member not yet attempted by a bounded batch.

Every run begins by inserting one item row for every frozen member. The reconciliation arithmetic is `in scope = evaluated + excluded + retry-pending + queued`; it does not use retrieval, eligibility or trade state as competing buckets. The run cursor stored in the database is authoritative. A stale client-supplied cursor cannot move it forward. `replay_last` deliberately repeats the persisted last-batch ID set under the same run ID without advancing the cursor. Evaluation revisions remain append-only and use the existing evidence-identity uniqueness contract; exact repeats create zero rows and the replay path contains no update to historical evaluation content.

## Schedule inspection (observed 2026-10-12)

### Artifact-owned equity post-mortem
- ID: `equity-signal-daily-postmortem`
- Owner: `space:equity-analyzer-and-signal-tracker`
- Configured: daily 06:46:00, timezone `@user.current` (resolved to America/Toronto at inspection)
- Enabled: **false**
- Last scheduler status: succeeded on 2026-10-05 06:46:40 EDT
- Next run: none while disabled
- Run-history API returned no retained rows; therefore no consecutive-cycle claim is made.

### Separate combined accuracy review
- ID: `signal-accuracy-test-week1`
- Owner: `goal:research-terminal`
- Configured: daily 06:00:00, timezone America/Toronto; DST follows that IANA zone
- Enabled: true
- Last scheduler status at inspection: succeeded 2026-10-12 06:07:21 EDT
- Next configured run: 2026-10-13 06:00 EDT
- This is a separate agent review, not proof that the artifact-owned post-mortem completed.

No duplicate artifact-owned equity post-mortem trigger was found. The separate combined review overlaps the subject matter and must remain separately labelled.

## Methodology map (no tuning)

1. **Candidate selection** — `runAutomatedScan`/scan pipeline loads market candidates and applies registered quality/activity gates. Quality/activity inputs govern measured coverage, ranking and issuance eligibility; absence is not converted to a direction.
2. **Direction and factor scoring** — candidate evidence is reconstructed by `reconstructAndValidateEquityCandidate`; `factorScoreBreakdown` reports raw factor contribution and redundancy adjustment. Agreement scores are heuristics, not probability.
3. **Theory promotion** — machine theory actions (`discoverTheories`, `synthesizeMarketTheories`) persist research hypotheses separately from issued signals. The UI now says active research theory, not fresh/live evidence.
4. **Issuance** — `recordSignal` freezes issuance identity, entry/risk fields, bar timing, build/strategy/evaluator metadata and the input snapshot. Existing tests verify rejected candidates do not persist and that draft stops cannot alter reconstruction.
5. **Monitoring** — `refreshMarketData` writes versioned observations and status events without mutating snapshots or creating decisions; current quotes are observations, never first-touch proof.
6. **Evaluation** — `evaluateEquityTradeSetup` handles contract barrier order; `evaluateEquityDirectionForecast` handles fixed-horizon direction. `appendEvaluationRevision` preserves prior grades and deduplicates exact evidence identity.
7. **Reporting** — `getSignalTracker` selects accepted revisions for one fixed cohort and now keeps records with missing factor detail visible. `runMeasurementBatch` exposes run completeness separately.

### Trace examples
- **PLTR**: an equity record follows the path above; the dossier labels replay sample as legacy baseline coverage and keeps edge unvalidated beside the assessment. No PLTR threshold or historical outcome was changed.
- **SOL / STRK**: these are crypto instruments and are not produced or evaluated by this equity checkout. Their timestamps, mover flags and call status cannot be honestly reconstructed from this database. Cross-terminal methodology review remains pending in the crypto checkout; no earlier detection time is inferred here.

### Independence and feedback-loop finding

Chart, news, smart-money and theory surfaces can describe overlapping underlying observations. This repair does not count the labels as independent confirmations and does not change registered weights. Theory lifecycle remains separate from issuance; any full-engine consumer must retain provenance and deduplicate underlying evidence before treating agreement as independent. No outcome-based ablation, threshold search or winner selection was performed.

## External research traceability

The equity artifact already stores source URLs/timestamps on market evidence and source-linked theory evidence. This repair did not alter morning-intel or big-updates jobs, which are goal-owned outside the artifact. Their configured-versus-accessed feed inventory, publication/retrieval times, failures, deduplication and job-health report therefore remain an external operational requirement, not a closure claim from this build.

## Verification boundary

Evidence is separated as:
1. **Source/build proof** — TypeScript build and migration application in the isolated builder copy.
2. **Sandbox action proof** — isolated data copy only; not a production cycle.
3. **Scheduler inspection** — configuration/state read; not proof of artifact action results.
4. **Production proof** — pending; no deployed commit, migration state, controlled outage/recovery, or consecutive production batch runs are claimed.
