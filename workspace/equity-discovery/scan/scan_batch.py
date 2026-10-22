"""
Resumable-batch equity discovery scanner (sandbox).

Repairs the deployed `runAutomatedScan` 120s-timeout failure mode without
touching production:

- The 101-symbol S&P 100 universe is split into N deterministic batches.
- Per-symbol progress is persisted (atomic tmp+rename) AFTER EVERY SYMBOL,
  so a timeout/interrupt can never lose completed symbols; a re-run skips
  symbols already terminal (idempotent resume).
- Each batch is sized from measured per-symbol timing to complete in seconds.
- Data fetch is `2y` (not the terminal's wasteful `max`): every factor and
  the completeness gate consume <= ~260 sessions, so factor inputs — and
  therefore scores — are identical. Fetch optimization only; weights,
  formulas, gates, and the issuance decision are ported verbatim (see
  gates.py / indicators.py headers for source line refs).
- The complete factor ledger + evidence is persisted BEFORE a symbol is
  marked qualified (mirrors the crypto handoff pattern: persist complete
  factor ledger + evidence before qualification; frozen rules; record every
  outcome).

Usage:
  python3 scan_batch.py --state-dir <dir> --cycle 2026-10-14 --batches 8 --batch-index 0

Exit 0 on batch completion (even if some symbols failed — failures are
recorded, not raised). Prints a one-line JSON summary to stdout.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from universe import load_universe
from indicators import completed_daily_points, finite
from gates import (
    score_symbol, build_frozen_levels, check_completeness, issuance_decision,
    SIGNAL_INVALIDATION_METHOD,
)

YAHOO_UA = "Mozilla/5.0 (compatible; MuseEquityTerminal/1.0; market-research)"
TERMINAL_STATES = ("scored", "qualified", "failed", "skipped")


def atomic_write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
        os.replace(tmp, path)
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def fetch_yahoo_2y(symbol, timeout=30):
    """2y daily bars; adjusted closes; mirrors yahooSeries parsing."""
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
           f"?interval=1d&range=2y&events=div%2Csplits")
    last_err = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": YAHOO_UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                payload = json.loads(r.read().decode("utf-8"))
            result = (payload.get("chart") or {}).get("result") or []
            if not result:
                err = ((payload.get("chart") or {}).get("error") or {}).get("description")
                raise RuntimeError(f"Yahoo returned no chart for {symbol}" + (f": {err}" if err else ""))
            result = result[0]
            quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
            adj = ((result.get("indicators") or {}).get("adjclose") or [{}])[0].get("adjclose") or []
            timestamps = result.get("timestamp") or []
            opens = quote.get("open") or []
            highs = quote.get("high") or []
            lows = quote.get("low") or []
            closes = quote.get("close") or []
            volumes = quote.get("volume") or []
            points = []
            for i, ts in enumerate(timestamps):
                raw_close = finite(closes[i] if i < len(closes) else None)
                adj_close = finite(adj[i] if i < len(adj) else None)
                ratio = adj_close / raw_close if (adj_close is not None and raw_close not in (None, 0)) else 1.0
                close = adj_close if adj_close is not None else raw_close
                vol = finite(volumes[i] if i < len(volumes) else None)

                def adj_ohlc(v):
                    v = finite(v)
                    return None if v is None else v * ratio

                if not isinstance(close, (int, float)) or not math.isfinite(close) or close <= 0:
                    continue
                if vol is not None and vol < 0:
                    continue
                date = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
                points.append({
                    "date": date,
                    "close": close,
                    "open": adj_ohlc(opens[i] if i < len(opens) else None),
                    "high": adj_ohlc(highs[i] if i < len(highs) else None),
                    "low": adj_ohlc(lows[i] if i < len(lows) else None),
                    "volume": vol,
                })
            points.sort(key=lambda p: p["date"])
            # dedupe by date, keep last
            deduped = list({p["date"]: p for p in points}.values())
            deduped.sort(key=lambda p: p["date"])
            return deduped, url
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}"
            if e.code == 429 and attempt < 2:
                time.sleep(0.8 * (2 ** attempt))
                continue
            break
        except Exception as e:  # noqa: BLE001 - recorded per symbol
            last_err = str(e)[:200]
            break
    raise RuntimeError(f"Yahoo fetch failed for {symbol}: {last_err}")


def score_one(symbol, name, sector, now_utc):
    """Score one symbol. Returns (status, detail_dict). Never raises."""
    t0 = time.monotonic()
    try:
        bars, source_url = fetch_yahoo_2y(symbol)
    except Exception as e:  # noqa: BLE001
        return "failed", {"reason": f"fetch: {e}", "elapsedMs": int((time.monotonic() - t0) * 1000)}, None
    if len(bars) < 60:
        return "skipped", {"reason": f"only {len(bars)} usable daily bars (< 60 minimum)",
                           "elapsedMs": int((time.monotonic() - t0) * 1000)}, None
    try:
        completed = completed_daily_points(bars, now_utc)
        if len(completed) < 60:
            return "skipped", {"reason": f"only {len(completed)} completed daily bars (< 60 minimum)",
                               "elapsedMs": int((time.monotonic() - t0) * 1000)}, None
        scored = score_symbol(completed, now_utc)
        complete_ok, complete_reason = check_completeness(completed, scored, now_utc)
        last = completed[-1]
        levels = build_frozen_levels(last["close"], scored["atr14"], scored["tradeDirection"]) \
            if scored["atr14"] else None
        issuance = None
        if scored["direction"] in ("long", "short") and levels:
            issuance = issuance_decision(scored["direction"], levels["stopPrice"], last, completed)
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        scored_at = now_utc.isoformat()
        detail = {
            "symbol": symbol, "name": name, "sector": sector,
            "score": scored["score"], "rawScore": scored["rawScore"],
            "redundancyAdjustment": scored["redundancyAdjustment"],
            "direction": scored["direction"],
            "signalDate": scored["signalDate"],
            "bars": len(completed),
            "firstBar": completed[0]["date"], "lastBar": completed[-1]["date"],
            "sourceUrl": source_url,
            "completenessOk": complete_ok, "completenessReason": complete_reason,
            "levels": levels,
            "issuance": issuance,
            "scoredAt": scored_at,
            "elapsedMs": elapsed_ms,
            "factorSummary": [(f["name"], f["weight"], f["score"], f["quality"]) for f in scored["factors"]],
        }
        # Persist the COMPLETE factor ledger + evidence BEFORE qualification.
        ledger = {
            "symbol": symbol, "name": name, "sector": sector,
            "universe": "sp100", "scoredAt": scored_at,
            "sourceUrl": source_url,
            "bars": {"count": len(completed), "first": completed[0]["date"], "last": completed[-1]["date"]},
            "factorModel": {
                "score": scored["score"], "rawScore": scored["rawScore"],
                "redundancyAdjustment": scored["redundancyAdjustment"],
                "direction": scored["direction"],
                "formula": "Raw = 100 x sum(weight x score) / sum(weights); "
                           "all-five trend-cluster aligned -> 5pt toward-zero redundancy adjustment",
                "parameterHash": "atr2-target1.5R-weights-6-8-8-20-8-20-20",
                "factors": scored["factors"],
            },
            "levels": levels,
            "levelsMethod": SIGNAL_INVALIDATION_METHOD,
            "completeness": {"ok": complete_ok, "reason": complete_reason},
            "issuance": issuance,
            "signalDay": last,
            "historyCloses": [p["close"] for p in completed],
            "historyHighs": [p["high"] for p in completed],
            "rawBars": [{"date": p["date"], "open": p["open"], "high": p["high"],
                         "low": p["low"], "close": p["close"], "volume": p["volume"]}
                        for p in completed],
        }
        if scored["direction"] in ("long", "short") and complete_ok and issuance and issuance["allowed"]:
            detail["ledgerReady"] = True
            return "qualified", detail, ledger
        if scored["direction"] not in ("long", "short"):
            detail["reason"] = f"no directional rating (score {scored['score']})"
        elif not complete_ok:
            detail["reason"] = f"completeness: {complete_reason}"
        else:
            detail["reason"] = f"issuance gate: {issuance['reason'] if issuance else 'no levels'}"
        detail["ledgerReady"] = True
        return "scored", detail, ledger
    except Exception as e:  # noqa: BLE001
        return "failed", {"reason": f"compute: {e}", "elapsedMs": int((time.monotonic() - t0) * 1000)}, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--cycle", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--batches", type=int, default=8)
    ap.add_argument("--batch-index", required=True,
                      help="batch index (int) or 'next' to pick the lowest batch with non-terminal symbols")
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()

    state_dir = Path(args.state_dir)
    now_utc = datetime.now(timezone.utc)
    universe = load_universe(state_dir)
    symbols = sorted(p["symbol"] for p in universe["profiles"])
    by_symbol = {p["symbol"]: p for p in universe["profiles"]}

    n = args.batches
    size = (len(symbols) + n - 1) // n

    if args.batch_index == "next":
        state_path = state_dir / f"scan-state-{args.cycle}.json"
        existing = json.loads(state_path.read_text())["symbols"] if state_path.exists() else {}
        chosen = None
        for bi in range(n):
            bs = symbols[bi * size:(bi + 1) * size]
            if any(existing.get(s, {"status": "pending"})["status"] not in TERMINAL_STATES for s in bs):
                chosen = bi
                break
        if chosen is None:
            print(json.dumps({"cycle": args.cycle, "batch": "next", "ok": True,
                              "allTerminal": True, "attempted": 0,
                              "note": "every symbol already terminal for this cycle"}))
            return
        args.batch_index = chosen
    else:
        args.batch_index = int(args.batch_index)
    batch_symbols = symbols[args.batch_index * size:(args.batch_index + 1) * size]

    state_path = state_dir / f"scan-state-{args.cycle}.json"
    if state_path.exists():
        state = json.loads(state_path.read_text())
    else:
        state = {"cycle": args.cycle, "universe": "sp100", "universeCount": len(symbols),
                 "batches": n, "symbols": {}}
    for s in symbols:
        state["symbols"].setdefault(s, {"status": "pending"})

    def save_state():
        atomic_write(state_path, json.dumps(state, indent=2))

    ledger_dir = state_dir / "ledgers" / args.cycle
    run_started = now_utc.isoformat()
    outcomes = {}
    pending = [s for s in batch_symbols if state["symbols"][s]["status"] not in TERMINAL_STATES]

    def work(sym):
        p = by_symbol[sym]
        result = score_one(sym, p["name"], p["sector"], datetime.now(timezone.utc))
        return sym, result

    # Fetch+compute concurrently, but PERSIST SEQUENTIALLY per symbol so a
    # timeout can never lose a completed symbol's ledger+state.
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        # submit in batch order; as each completes, persist immediately
        future_map = {ex.submit(work, s): s for s in pending}
        import concurrent.futures as cf
        for fut in cf.as_completed(future_map):
            sym = future_map[fut]
            try:
                _sym, result = fut.result()
            except Exception as e:  # noqa: BLE001 - worker crash safety
                result = ("failed", {"reason": f"worker: {e}"}, None)
            status = result[0]
            detail = result[1]
            ledger = result[2] if len(result) > 2 else None
            if ledger is not None:
                atomic_write(ledger_dir / f"{sym}.json", json.dumps(ledger, indent=2))
            rec = {"status": status, "batch": args.batch_index, **detail}
            # keep the state record small: drop heavy arrays from state
            rec.pop("factorSummary", None)
            state["symbols"][sym] = rec
            save_state()
            outcomes[sym] = {"status": status, "reason": detail.get("reason"),
                             "score": detail.get("score"), "direction": detail.get("direction"),
                             "elapsedMs": detail.get("elapsedMs")}

    skipped_already = [s for s in batch_symbols if s not in pending]
    run_record = {
        "cycle": args.cycle, "batchIndex": args.batch_index, "batches": n,
        "batchSymbols": batch_symbols,
        "startedAt": run_started, "finishedAt": datetime.now(timezone.utc).isoformat(),
        "attempted": pending, "alreadyTerminal": skipped_already,
        "outcomes": outcomes,
    }
    atomic_write(state_dir / "runs" / f"{args.cycle}-batch-{args.batch_index}.json",
                 json.dumps(run_record, indent=2))

    counts = {}
    for o in outcomes.values():
        counts[o["status"]] = counts.get(o["status"], 0) + 1
    elapsed = [o.get("elapsedMs") or 0 for o in outcomes.values()]
    summary = {
        "cycle": args.cycle, "batch": args.batch_index,
        "attempted": len(pending), "alreadyTerminal": len(skipped_already),
        "counts": counts,
        "meanElapsedMs": int(sum(elapsed) / len(elapsed)) if elapsed else 0,
        "maxElapsedMs": max(elapsed) if elapsed else 0,
        "ok": True,
    }
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
