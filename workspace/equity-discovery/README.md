# Equity discovery repair — operations (v1.0.0)

**Status:** sandbox. Paper signals only. No brokerage, no production changes,
no artifact edits. Holdouts locked.

## What this is

A workspace batch lane repair for the deployed discovery timeout streak
(`equity-theory-discovery`: 15 consecutive `space worker request timed out
after 120000ms`, 2026-10-07 → 2026-10-13). **Labeled backup:** this lane is
the working backup, NOT a substitute — the deployed discovery repair remains
necessary. The deployed
`runAutomatedScan {universe:"sp100"}` cannot finish inside the 120s worker
budget — see `TIMEOUT-DIAGNOSIS-2026-10-14.md` for the stage-by-stage
breakdown (the ~101 serialized full-history "max" Yahoo fetches alone cost
~116–316s, plus two LLM calls).

This directory implements the repair as resumable batches + a paper handoff:

```
equity-discovery/
  README.md                        this file (ops doc, versioned)
  TIMEOUT-DIAGNOSIS-2026-10-14.md  deliverable 1: where the 120s goes
  scan/
    universe.py      S&P 100 load (same Wikipedia source as the terminal)
    indicators.py    faithful port of the terminal's indicator math
    gates.py         faithful port: 7-factor scoring, quality gates,
                     discovery completeness, issuance decision, levels
    scan_batch.py    resumable batch runner (per-symbol progress, atomic)
    consolidate.py   final accounting: scored/failed/skipped with reasons
  state/             scan-state-<cycle>.json, ledgers/<cycle>/*.json,
                     runs/<cycle>-batch-*.json, accounting-<cycle>.json,
                     qualified-candidates-<cycle>.json
  handoff/
    build_inputs.mjs  qualified candidates -> PaperCandidateInput[]
    run_handoff.mjs   Node: same integrated issuance handler as crypto
  evidence/          scheduled-run evidence, handoff reports
```

## Frozen rules (no prediction weight changes)

- 7 factors, weights **6/8/8/20/8/20/20**, Wilder RSI-14 / MACD 12–26 /
  ATR-14 / ATR-adjusted 30-session trend formulas, the 5-point redundancy
  adjustment, `signalDecision` (±20), 2.00× ATR-14 invalidation, 1.5R/2.5R
  targets, discovery completeness (252 sessions / 18-of-20 liquid / $25m
  median dollar volume / 5-day freshness / all factors GOOD), and the
  `signalIssuanceDecision` issuance gate are ported **verbatim in logic**
  from `~/workspace/ts-spaces/equity-analyzer-and-signal-tracker/server/src/actions.ts`
  (line refs in `scan/gates.py` and `scan/indicators.py` headers).
- Parameter hash pinned in every ledger:
  `atr2-target1.5R-weights-6-8-8-20-8-20-20` (the terminal's
  `SIGNAL_PARAMETER_HASH`).
- **Deliberate, documented deviation — fetch range only:** the scanner
  fetches `2y` instead of the terminal's `max`. Every factor and the
  completeness gate consume ≤ ~260 sessions; 2y ≈ 504 sessions. Factor
  inputs are identical, so scores are unchanged. This is a data-fetch
  optimization, not a methodology change.

## Running a scan cycle

```bash
cd scan
# 8 batches; each completes in ~10s (measured ~2s/symbol at concurrency 6)
for i in 0 1 2 3 4 5 6 7; do
  python3 scan_batch.py --state-dir ../state --cycle 2026-10-14 \
    --batches 8 --batch-index $i
done
python3 consolidate.py --state-dir ../state --cycle 2026-10-14
```

- Batches are disjoint and idempotent: re-running a batch skips symbols
  already terminal. Per-symbol state persists after every symbol (atomic
  tmp+rename) — a timeout never loses completed symbols.
- `consolidate.py` refuses (exit 2) unless every universe symbol is
  terminal, and names the missing symbols/batches.
- The complete factor ledger + evidence (`state/ledgers/<cycle>/<SYM>.json`)
  is written BEFORE a symbol is marked qualified.

## Paper handoff

```bash
cd handoff
node build_inputs.mjs --state-dir ../state --cycle 2026-10-14
node run_handoff.mjs --inputs handoff-inputs-2026-10-14.json \
  --db handoff-store-2026-10-14.db \
  --report handoff-report-2026-10-14.md
```

- `run_handoff.mjs` drives `processIntegratedCandidate` from the compiled
  orchestrator — the **same** issuance path, **same** gates (corrected veto
  incl. waiting-interval, retained equity short-regime gate), **same**
  DbStore as the crypto lane.
- Equity entry semantics: entry-v1 `next-xnys-regular-session-open-print`
  (consolidated tape). Sandbox venue is a `ScriptedFeed` — the contract's
  equity entry rule is the production rule; only the venue is scripted.
- State machine per candidate: `qualified → awaiting-entry →
  entered | expired | invalidated`. Every outcome recorded with its gate.
- Three timestamps asserted per entered signal:
  `setupAlertAt < entryObservedAt <= alertedAt`.

## Scheduled operation

Demo job `equity-discovery-scan-demo` (runonce, fired 2026-10-14 03:28 EDT):
ran batch 7 on its timer — see `evidence/scheduled-scan-2026-10-14.md`.

Recurring schedule (for the parent — NOT installed; needs Logan's call):

```json
{
  "id": "equity-discovery-scan",
  "title": "Equity discovery scan (resumable batches)",
  "owner": "goal:research-terminal",
  "enabled": true, "mode": "task",
  "schedule": { "kind": "interval", "every": "12h", "timezone": "America/Toronto", "flexible_time": true },
  "timeout_secs": 600,
  "body": "Run the next pending batch of the resumable equity discovery scan (cycle = today UTC): cd ~/workspace/goals/research-terminal/paper-signals/equity-discovery/scan && python3 scan_batch.py --state-dir ../state --cycle $(date -u +%F) --batches 8 --batch-index <next-pending>. Then, only if consolidate.py exits 0 (all symbols terminal), run the paper handoff for the cycle's qualified candidates. Report per-symbol accounting."
}
```

Note: the body needs the "next pending batch" resolved at run time; the
worker reads `state/scan-state-<cycle>.json` and picks the lowest batch
index with non-terminal symbols (a 10-line addition to scan_batch.py:
`--batch-index next`).

## Versioning

- This ops doc is v1.0.0 (2026-10-14).
- **No freeze bump:** no frozen executable changed. These are new
  operational files; the comparison harness (active freeze v2.1.5) is
  untouched. Per the task's versioning rule, a new freeze/version is only
  required if executables change — none did.
- If the terminal's factor block, weights, gates, or issuance decision
  change upstream, `scan/indicators.py` + `scan/gates.py` must be re-ported
  and the parameter hash re-pinned, and this doc revs to v1.1.0.

## Known findings (for parent/expert)

1. **Equity-short vs min-score floor:** the integrated handler rejects
   candidates with `score < minScore` (default 0). Equity shorts carry
   signed-negative scores (e.g. −24), so the default floor rejects every
   equity short at gate `min-score` — the repaired path's demos never
   covered an equity short. The handoff keeps the default config (same
   gates, unchanged) and records these rejections honestly. Whether the
   floor should apply to |score| for the equity lane is a parent/expert
   call — changing it is a versioned handler change, out of scope here.
2. **Deployed discovery still broken:** this repair is the workspace batch lane
   (backup). The
   deployed `runAutomatedScan` still times out; a durable fix needs the
   artifact builder (batch args on the action, or the scan split into the
   existing `populateUniverseTierBatch`-style resumable actions).
3. **T2 tier silently empty:** the scan's `velocityScreen` 50-symbol spark
   chunks 400-fail (VM-measured), so no symbol ever clears the +10%
   velocity qualifier. Pre-existing; not touched.
