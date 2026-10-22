"""
S&P 100 universe loader — same source the terminal uses.

Source: universeUrls.sp100 = "https://en.wikipedia.org/wiki/S&P_100"
(actions.ts:1705-1708). Sector map comes from the S&P 500 page for sp100
scope (actions.ts:1719-1726); this port reads the sector column directly
from the S&P 100 table when present and falls back to "Unclassified".

Result is cached to state/universe.json with source URL + fetch date so
scheduled runs don't re-parse Wikipedia every batch.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SP100_URL = "https://en.wikipedia.org/wiki/S&P_100"
CACHE_NAME = "universe.json"


def _fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Muse Equity Analyzer/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def load_universe(state_dir, force_refresh=False):
    state_dir = Path(state_dir)
    cache = state_dir / CACHE_NAME
    if cache.exists() and not force_refresh:
        return json.loads(cache.read_text())
    html = _fetch(SP100_URL)
    tables = re.findall(r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html, re.S)
    # constituents table: the wikitable with ~101 data rows
    table = max(tables, key=lambda t: len(re.findall(r"<tr[^>]*>", t)))
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)
    profiles = []
    for row in rows[1:]:
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)
        if not cells:
            continue
        raw = re.sub(r"<[^>]+>", "", cells[0]).strip().split()
        raw = raw[0] if raw else ""
        if not re.match(r"^[A-Z][A-Z0-9.\-]{0,9}$", raw):
            continue
        symbol = raw.replace(".", "-")
        name = re.sub(r"<[^>]+>", "", cells[1]).strip() if len(cells) > 1 else symbol
        sector = re.sub(r"<[^>]+>", "", cells[2]).strip() if len(cells) > 2 else "Unclassified"
        profiles.append({"symbol": symbol, "name": name, "sector": sector or "Unclassified"})
    # dedupe, preserve order
    seen, out = set(), []
    for p in profiles:
        if p["symbol"] not in seen:
            seen.add(p["symbol"])
            out.append(p)
    payload = {
        "universe": "sp100",
        "sourceUrl": SP100_URL,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(out),
        "profiles": out,
    }
    state_dir.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(payload, indent=2))
    return payload


if __name__ == "__main__":
    import sys
    d = sys.argv[1] if len(sys.argv) > 1 else "state"
    u = load_universe(d, force_refresh="--refresh" in sys.argv)
    print(f"{u['count']} symbols from {u['sourceUrl']}")
