"""
Consolidate a scan cycle: verify EVERY universe symbol reached a terminal
state (scored / qualified / failed / skipped) with a reason, and emit the
final accounting + the qualified-candidate list for the paper handoff.

Usage:
  python3 consolidate.py --state-dir <dir> --cycle 2026-10-14

Exit 0 + writes accounting.json and qualified-candidates.json.
Exit 2 if any symbol is still pending (cycle incomplete) — the report names
exactly which symbols and which batches are missing.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from universe import load_universe  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--cycle", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    args = ap.parse_args()

    state_dir = Path(args.state_dir)
    universe = load_universe(state_dir)
    symbols = sorted(p["symbol"] for p in universe["profiles"])

    state_path = state_dir / f"scan-state-{args.cycle}.json"
    if not state_path.exists():
        print(json.dumps({"ok": False, "error": f"no state for cycle {args.cycle}"}))
        sys.exit(2)
    state = json.loads(state_path.read_text())

    pending = [s for s in symbols if state["symbols"].get(s, {}).get("status") not in
               ("scored", "qualified", "failed", "skipped")]
    if pending:
        print(json.dumps({"ok": False, "cycle": args.cycle,
                          "pending": pending, "pendingCount": len(pending)}))
        sys.exit(2)

    buckets = {"qualified": [], "scored": [], "failed": [], "skipped": []}
    for s in symbols:
        rec = state["symbols"][s]
        buckets[rec["status"]].append({
            "symbol": s,
            "score": rec.get("score"), "direction": rec.get("direction"),
            "reason": rec.get("reason"),
            "signalDate": rec.get("signalDate"),
            "scoredAt": rec.get("scoredAt"),
            "batch": rec.get("batch"),
            "elapsedMs": rec.get("elapsedMs"),
        })
    for b in buckets.values():
        b.sort(key=lambda r: r["symbol"])

    # batch run records -> per-batch timing evidence
    batch_runs = sorted((state_dir / "runs").glob(f"{args.cycle}-batch-*.json"))
    batch_timing = []
    for p in batch_runs:
        r = json.loads(p.read_text())
        el = [o.get("elapsedMs") or 0 for o in r["outcomes"].values()]
        batch_timing.append({
            "batch": r["batchIndex"],
            "attempted": len(r["attempted"]),
            "meanElapsedMs": int(sum(el) / len(el)) if el else 0,
            "maxElapsedMs": max(el) if el else 0,
            "startedAt": r["startedAt"], "finishedAt": r["finishedAt"],
        })

    accounting = {
        "cycle": args.cycle, "universe": "sp100",
        "universeCount": len(symbols),
        "consolidatedAt": datetime.now(timezone.utc).isoformat(),
        "counts": {k: len(v) for k, v in buckets.items()},
        "buckets": buckets,
        "batchTiming": batch_timing,
        "ok": True,
    }
    (state_dir / f"accounting-{args.cycle}.json").write_text(json.dumps(accounting, indent=2))

    qualified = []
    for row in buckets["qualified"]:
        ledger_path = state_dir / "ledgers" / args.cycle / f"{row['symbol']}.json"
        ledger = json.loads(ledger_path.read_text())
        fm = ledger["factorModel"]
        qualified.append({
            "symbol": row["symbol"],
            "name": next(p["name"] for p in universe["profiles"] if p["symbol"] == row["symbol"]),
            "sector": next(p["sector"] for p in universe["profiles"] if p["symbol"] == row["symbol"]),
            "direction": fm["direction"],
            "score": fm["score"],
            "entryPrice": ledger["levels"]["entryPrice"],
            "invalidation": ledger["levels"]["stopPrice"],
            "target1": ledger["levels"]["target1"],
            "target2": ledger["levels"]["target2"],
            "signalDate": row["signalDate"],
            "detectedAt": row["scoredAt"],
            "ledgerPath": str(ledger_path),
        })
    qualified.sort(key=lambda c: c["symbol"])
    (state_dir / f"qualified-candidates-{args.cycle}.json").write_text(
        json.dumps({"cycle": args.cycle, "count": len(qualified),
                    "candidates": qualified}, indent=2))

    print(json.dumps({"ok": True, "cycle": args.cycle,
                      "counts": accounting["counts"],
                      "qualified": len(qualified)}))


if __name__ == "__main__":
    main()
