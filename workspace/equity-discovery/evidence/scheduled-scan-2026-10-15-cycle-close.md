# Scheduled equity scan — cycle close (2026-10-16 run)

**Job:** `equity-discovery-scan-1330` (runonce-style scheduled batch lane job), fired Fri 2026-10-16 13:30 EDT.
**Lane:** workspace batch lane — labeled BACKUP, not a substitute for the deployed discovery repair.

**Pre-flight:** budget governor `pace_check.py --provider yahoo --slot daytime` → `allow` (Yahoo unmetered; zero Finnhub/Alpha Vantage calls, as mandated).
**Market-open check:** Fri 2026-10-16 is a NYSE trading day (2026 NYSE holidays: Jan 1, Jan 19, Feb 16, Apr 3, May 25, Jun 19, Jul 3 obs., Sep 7, Nov 26, Dec 25 — none apply).

**Cycle resolution (cycle-auto):** reused `2026-10-15` (latest incomplete cycle), not a fresh date cycle.

**Batch 7/8** (this run): 10 attempted, 0 alreadyTerminal — 8 qualified, 2 scored (UBER scored=-20 short, issuance gate: bearish daily structure not met; V scored=-42 short, same gate), mean 1687ms / max 2013ms, ~4s wall time.

**Consolidation:** exit 0 — all 101 S&P 100 symbols terminal: qualified=83, scored=18, failed=0, skipped=0.
Per-symbol accounting across `state/runs/2026-10-15-batch-*.json`: attempted 101, alreadyTerminal 0, counts {qualified: 83, scored: 18}, mean elapsed 3453ms, max 10279ms. Accounting file: `state/accounting-2026-10-15.json`.

**Paper handoff (cycle-specific outputs):**
- `handoff/handoff-inputs-2026-10-15.json` (83 candidates)
- `handoff/handoff-store-2026-10-15.db`
- `handoff/handoff-report-2026-10-15.md`
- Result: **83 candidates, 0 signals issued, 83 contracts — all 83 invalidated at gate `first-print-unverifiable`** (fail-closed: entry window closed before observation / scripted venue served no prints; no later print substituted). This is the known opening-print venue feed gap in the sandbox — sandbox-only, not a production path claim.

**Top scores (paper only, all invalidated, no entries taken):** longs PG/TMO/WMT 95, LLY/NOW/UNH 78, AAPL/ABBV 73; shorts GS/SCHW -95, CAT -78, BA/BAC/BKNG/C/CMCSA -73.

**Frozen methodology untouched:** 7-factor weights 6/8/8/20/8/20/20, Wilder RSI-14, ATR-14, issuance gates as ported. No deployed-artifact, crypto-pipeline, or methodology changes.
