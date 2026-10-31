import { spawnSync } from "node:child_process";
import {
definePrivilegedContracts,
definePrivilegedHandlers,
z,
} from "@hatch/space-sdk";

const providerResponse = z.object({
  ok: z.boolean(),
  status: z.number().nullable(),
  data: z.unknown().nullable(),
  creditsCost: z.string().nullable(),
  creditsRemaining: z.string().nullable(),
  error: z.string().nullable(),
});

export const privileged = definePrivilegedContracts({
  assetEvidenceFiles: {
    request: z.object({ symbol: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9.=\-]{0,14}$/) }),
    response: z.object({ ok: z.boolean(), status: z.number().nullable(), data: z.unknown().nullable(), creditsCost: z.string().nullable(), creditsRemaining: z.string().nullable(), error: z.string().nullable() }),
    capabilities: ["subprocess"],
    timeoutMs: 60_000,
  },
  openbbEquityFile: {
    request: z.object({}),
    response: z.object({ ok: z.boolean(), status: z.number().nullable(), data: z.unknown().nullable(), creditsCost: z.string().nullable(), creditsRemaining: z.string().nullable(), error: z.string().nullable() }),
    capabilities: ["subprocess"],
    timeoutMs: 60_000,
  },
});

// Batch 3 (equity) — read-only workspace evidence reader. Reads the latest
// cross-stream verdict matrix plus the caller ledger and paste.trade ledger
// from workspace files at render time. Extraction is conservative: whole
// recorded entries mentioning the symbol only; no summarization, no inferred
// direction, no earliness claims. Never reads app.db, never writes.
const PYTHON_ASSET_EVIDENCE = String.raw`
import json, os, re, sys

payload = json.loads(sys.stdin.read())
symbol = str(payload.get("symbol") or "").strip().upper()
if not re.match(r"^[A-Z0-9][A-Z0-9.=\-]{0,14}$", symbol) or "/" in symbol or "\\" in symbol:
    print(json.dumps({"ok": False, "status": None, "data": None, "creditsCost": None, "creditsRemaining": None, "error": "invalid symbol"}, separators=(",", ":")))
    raise SystemExit(0)

RT = "/home/hatch/workspace/goals/research-terminal"
DOSSIERS = os.path.join(RT, "hidden_files", "asset-dossiers")
CROSS_DIR = os.path.join(RT, "hidden_files", "daily-board", "cross-stream")
CALLS = "/home/hatch/workspace/x-sweep/v2/calls.md"
PASTE = "/home/hatch/workspace/x-sweep/v2/paste-trade-calls.md"
errors = {}

def cap(text, limit=8000):
    if text is None:
        return None
    text = text.strip()
    if len(text) > limit:
        return text[:limit] + "\n... [truncated at " + str(limit) + " chars]"
    return text

# --- asset dossier ---
dossier = {"exists": False, "currentRead": None, "streamLog": None, "learned": None}
dossier_path = os.path.join(DOSSIERS, os.path.basename(symbol) + ".md")
try:
    if os.path.isfile(dossier_path):
        with open(dossier_path, "r", encoding="utf-8") as fh:
            text = fh.read()
        dossier["exists"] = True
        sections = {}
        current = None
        buf = []
        def flush():
            if current is not None:
                sections[current] = "\n".join(buf).strip()
        for line in text.splitlines():
            if line.startswith("## "):
                flush()
                current = line[3:].strip()
                buf = []
            elif current is not None:
                buf.append(line)
        flush()
        for heading, body in sections.items():
            low = heading.lower()
            if "current read" in low:
                dossier["currentRead"] = (heading + " " + body).strip() if body else heading
            elif "stream log" in low:
                dossier["streamLog"] = cap(body)
            elif "what we've learned" in low or "what we’ve learned" in low:
                dossier["learned"] = cap(body)
except Exception as exc:
    errors["dossier"] = type(exc).__name__ + ": " + str(exc)

# --- cross-stream verdict (latest matrix file) ---
cross = {"fileDate": None, "entry": None}
try:
    names = sorted(name for name in os.listdir(CROSS_DIR) if re.match(r"^\d{4}-\d{2}-\d{2}\.json$", name))
    if names:
        latest_name = names[-1]
        with open(os.path.join(CROSS_DIR, latest_name), "r", encoding="utf-8") as fh:
            matrix = json.load(fh)
        cross["fileDate"] = str(matrix.get("date") or latest_name[:-5])
        entry = (matrix.get("assets") or {}).get(symbol)
        if isinstance(entry, dict):
            def str_list(value):
                return [str(item) for item in value] if isinstance(value, list) else []
            cross["entry"] = {
                "board": entry.get("board") if isinstance(entry.get("board"), str) else None,
                "verdict": entry.get("verdict") if isinstance(entry.get("verdict"), str) else None,
                "agree": str_list(entry.get("agree")),
                "disagree": str_list(entry.get("disagree")),
                "risks": str_list(entry.get("risks")),
                "note": entry.get("note") if isinstance(entry.get("note"), str) else None,
            }
except Exception as exc:
    errors["crossStream"] = type(exc).__name__ + ": " + str(exc)

# --- smart-money evidence: whole recorded entries mentioning the symbol ---
token_re = re.compile(r"(?<![A-Za-z0-9$])\$?" + re.escape(symbol) + r"(?![A-Za-z0-9])")
iso_re = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z")
day_re = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2})")
entries = []

def read_lines(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read().splitlines()

try:
    section_date = None
    current = None
    def flush_calls():
        global current
        if current:
            text = "\n".join(current).strip()
            if text and token_re.search(text):
                stamp = iso_re.search(text)
                entries.append({"source": "caller ledger", "date": stamp.group(0) if stamp else section_date, "text": cap(text, 900)})
        current = None
    for line in read_lines(CALLS):
        day = day_re.match(line)
        if day:
            flush_calls()
            section_date = day.group(1)
            continue
        if line.startswith("## ") or line.startswith("# "):
            flush_calls()
            continue
        if line.startswith("- "):
            flush_calls()
            current = [line]
        elif current is not None and (line.startswith(" ") or line.startswith("\t")) and line.strip():
            current.append(line)
        elif not line.strip():
            continue
        else:
            flush_calls()
    flush_calls()
except Exception as exc:
    errors["calls"] = type(exc).__name__ + ": " + str(exc)

try:
    section_date = None
    for line in read_lines(PASTE):
        day = day_re.match(line)
        if day:
            section_date = day.group(1)
            continue
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) < 6 or cells[0].lower() == "handle" or set(cells[0]) <= set("-: "):
            continue
        if cells[1].upper() != symbol:
            continue
        stamp = iso_re.search(cells[5]) or iso_re.search(stripped)
        entries.append({"source": "paste.trade", "date": stamp.group(0) if stamp else section_date, "text": cap(stripped, 900)})
except Exception as exc:
    errors["paste"] = type(exc).__name__ + ": " + str(exc)

entries.sort(key=lambda item: item.get("date") or "", reverse=True)
entries = entries[:20]

out = {"dossier": dossier, "crossStream": cross, "smartMoney": {"entries": entries}, "errors": errors}
print(json.dumps({"ok": True, "status": 200, "data": out, "creditsCost": None, "creditsRemaining": None, "error": None}, separators=(",", ":")))
`;

// OpenBB parser supplement (equity) — read-only reader for the collected
// bundle file plus the engine's equity snapshot header. Returns both parsed
// JSON documents verbatim as data = {"bundle": ..., "snapshot": ...}; all
// projection happens in the action. The snapshot is read independently: a
// missing or unparseable snapshot yields snapshot=None and never fails the
// bundle read, and a bundle failure still carries the snapshot so the
// action can surface its freshness header. Never writes, never reads app.db.
const PYTHON_OPENBB_EQUITY = String.raw`
import json

BUNDLE_PATH = "/home/hatch/workspace/goals/research-terminal/paper-signals/pilot/marketdata/openbb/equity.json"
SNAPSHOT_PATH = "/home/hatch/workspace/goals/research-terminal/paper-signals/pilot/snapshots/equity-snapshot.json"

snapshot = None
try:
    with open(SNAPSHOT_PATH, "r", encoding="utf-8") as fh:
        parsed_snapshot = json.load(fh)
    if isinstance(parsed_snapshot, dict):
        snapshot = parsed_snapshot
except Exception:
    snapshot = None

try:
    with open(BUNDLE_PATH, "r", encoding="utf-8") as fh:
        bundle = json.load(fh)
    print(json.dumps({"ok": True, "status": 200, "data": {"bundle": bundle, "snapshot": snapshot}, "creditsCost": None, "creditsRemaining": None, "error": None}, separators=(",", ":")))
except Exception as exc:
    print(json.dumps({"ok": False, "status": None, "data": {"bundle": None, "snapshot": snapshot}, "creditsCost": None, "creditsRemaining": None, "error": type(exc).__name__ + ": " + str(exc)}, separators=(",", ":")))
`;

function runOpenbbEquityFile() {
  const result = spawnSync("python3", ["-c", PYTHON_OPENBB_EQUITY], { input: "{}", encoding: "utf8", timeout: 60_000, maxBuffer: 16_000_000 });
  if (result.error) return { ok: false, status: null, data: null, creditsCost: null, creditsRemaining: null, error: result.error.message.slice(0, 500) };
  if (result.status !== 0) return { ok: false, status: null, data: null, creditsCost: null, creditsRemaining: null, error: (result.stderr || "OpenBB equity bundle read failed").slice(0, 500) };
  try { return providerResponse.parse(JSON.parse(result.stdout)); }
  catch { return { ok: false, status: null, data: null, creditsCost: null, creditsRemaining: null, error: "OpenBB equity bundle read returned an unreadable response." }; }
}

function runAssetEvidence(symbol: string) {
  const result = spawnSync("python3", ["-c", PYTHON_ASSET_EVIDENCE], { input: JSON.stringify({ symbol }), encoding: "utf8", timeout: 60_000, maxBuffer: 8_000_000 });
  if (result.error) return { ok: false, status: null, data: null, creditsCost: null, creditsRemaining: null, error: result.error.message.slice(0, 500) };
  if (result.status !== 0) return { ok: false, status: null, data: null, creditsCost: null, creditsRemaining: null, error: (result.stderr || "Asset evidence file read failed").slice(0, 500) };
  try { return providerResponse.parse(JSON.parse(result.stdout)); }
  catch { return { ok: false, status: null, data: null, creditsCost: null, creditsRemaining: null, error: "Asset evidence file read returned an unreadable response." }; }
}

export const privilegedHandlers = definePrivilegedHandlers(privileged, {
  assetEvidenceFiles(args) { return runAssetEvidence(args.symbol); },
  openbbEquityFile() { return runOpenbbEquityFile(); },
});
