# Scheduled equity scan — run evidence (2026-10-14)

**Claim:** one equity discovery batch ran on its scheduler timer (not manually
kicked) and completed successfully.

**Job:** `equity-discovery-scan-demo` (runonce, kind=agent, owner
`goal:research-terminal`), created 2026-10-14 ~02:52 EDT for the demo.

**Scheduler record** (`cron.runs`, job `equity-discovery-scan-demo`):

| Field | Value |
|---|---|
| run_id | `e236ff59-d02f-42ae-b7af-e71ca0be5f1f` |
| scheduled_for | Wed 2026-10-14 03:28:00 EDT (1791962880) |
| started_at_utc | 1791962880 (= scheduled_for_utc, to the second) |
| finished_at_utc | 1791962898 (18s later) |
| trigger_reason | **scheduled** |
| status | **succeeded** |
| attempt | 1 |
| error_text | null |

**Worker-reported summary:** batch 7/8, cycle 2026-10-14 — attempted 10,
alreadyTerminal 0, counts {qualified: 9, scored: 1}, meanElapsedMs 1853,
maxElapsedMs 2325, ~4s wall time, inside budget. Consolidation and handoff
explicitly left to the parent per the job body.

**Cross-check against scan state** (independent of the worker's self-report):
`state/runs/2026-10-14-batch-7.json` exists with matching counts, and
`state/scan-state-2026-10-14.json` shows all 101 symbols terminal after this
run (was 91 terminal / 10 pending before 03:28).

**Honest labeling:** the *scan batch* ran on the scheduler (sandbox). The
deployed artifact's `runAutomatedScan` was not involved and remains broken —
that repair needs the artifact builder (see README §Known findings).
