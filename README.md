# equity-analyzer-and-signal-tracker — snapshot 2026-10-22

Private save of the equity research terminal as it stood on 2026-10-22, taken
before the display-only slim-down rebuild (planned from 2026-10-23). The live
system keeps running in Muse; this repo is the rollback point, not a deploy
source.

## What's here
- `client/`, `server/`, `drizzle/` (migrations through 0052), `space.json` —
  the terminal app source as deployed.
- Root `*.md` / `*.txt` — the build and audit record that ships with the app.
- `workspace/equity-discovery/` — the workspace scan-lane code (dated handoff
  databases and state archives excluded; they stay on the VM).

## State at snapshot
- Fill rule **equity-paper-fill-v2** (migrations 0051/0052): setups start
  `pending_entry` and fill at the open of the first eligible completed daily
  bar; the 06:46 ET postmortem pass is the only scheduled pass that records
  fills and outcomes.
- Bounded restart armed 2026-10-21: **5 pending_entry setups** — GE (short),
  NFLX (short), LMT (long), BRK-B (long), LLY (long); 0 filled at snapshot.
- PAPER only. No brokerage, no real orders.

## Excluded on purpose
Live database (`app.db`), `node_modules`, build outputs, the app's `audits/`
and `research/` data dirs, and dated data archives. No secrets in this tree:
API credentials live in the Muse vault, and the tree was scanned before
pushing.

The shared paper pipeline (paper-signals) is saved with the crypto terminal:
`loganxaaryan-a11y/altcoin-analyzer-and-signal-tracker`. Earlier combined
export (2026-10-15): `loganxaaryan-a11y/research-terminal-source`.
