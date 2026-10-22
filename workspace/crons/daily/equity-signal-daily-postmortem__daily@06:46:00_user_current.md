---
id: equity-signal-daily-postmortem
title: Daily equity signal post-mortem
enabled: true
owner: space:equity-analyzer-and-signal-tracker
mode: task
schedule:
  kind: daily
  timezone: '@user.current'
  time: 06:46:00
timeout_secs: 3600
retry:
  on_failure: true
  max_retries: 1
delivery:
  - chat_id: a685c3e7-c8be-4137-8900-4e899008bca7
metadata:
  tags: [cron:flexible-time]
  originating_chat_context_json: '{"chat_id":"a685c3e7-c8be-4137-8900-4e899008bca7","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"d8c63a1c-801b-497b-a9fe-cd2681d2185d"}'
  presentation_locale: en-US
---
Run the equity terminal's daily postmortem lane on artifact `equity-analyzer-and-signal-tracker`: invoke the published `runDailySignalPostmortem` action with arguments `{ "trigger": "scheduled" }`. This one pass does everything: it reconciles signal history (marks, fills, expiries, automatic settlements for the fill-rule population) and then, only after a successful reconcile, runs the bounded-restart issuance step (new `pending_entry` setups under `equity-paper-fill-v2` from the latest completed scan batch's already-eligible candidates; atomic cohort cap filled + pending ≤ 5; fail-stop halt on any recording/monitoring failure). PAPER ONLY. Never change scoring, gates, or rules; never edit legacy records; never touch EQ-2.

Then read `getPaperIssuance` and send a concise brief scoped to CURRENT populations only, in this order:

1. **Restart cohort (the headline):** cohort counts from `getPaperIssuance` (cap, filled, pending, expiredUnfilled) and the halt state. Report what THIS pass did, from the pass's own issuance report: setups created (symbols), setups skipped for capacity, setups skipped as duplicates/active, any fills recorded, any expiries, any automatic settlements — each with its session date. If the halt flag is set or changed this pass, say so loudly with the reason.
2. **Current-population standings:** outcome counts for the fill-rule population and any other current-population tracked signals, taken from the artifact's own separated accounting (the tracker outcome counts distinguish populations — report each population under its own label, never summed together). Interim 1D/2D/3D returns are tracking noise, not verdicts; verdicts are only completed 5D/14D/30D target-vs-invalidation outcomes and automatic first-touch settlements.
3. **Legacy bucket (historical only, clearly labeled):** the 50 legacy tracked rows may be mentioned ONLY as a labeled historical bucket with their staleness stated every time: their evaluation has been stalled since 2026-10-10 and their issuance contracts are incomplete (ungradeable under the frozen evaluator). Do NOT compute proximity-to-target/invalidation lists, positive/negative mark splits, or any standings over legacy rows, and never blend them into the current figures above.

Freshness discipline: every figure in the brief carries its as-of (session date or timestamp) and its source (the postmortem pass, `getPaperIssuance`, or the tracker counts). Anything stale is labeled stale — never present a stale figure as current.

Failure handling: if `runDailySignalPostmortem` times out or errors, retry the action ONCE (the 120s action ceiling has bitten before; the Oct 20 pass succeeded on its retry). If it still fails, report the failure plainly in the brief — what failed and when — and STOP: never substitute a previous pass's numbers, never report figures from memory, and never claim the issuance step ran when the reconcile did not complete.

If the restart cohort is empty and no current-population signal exists, say so briefly — an empty current book is a valid report; do not pad it with legacy standings.
