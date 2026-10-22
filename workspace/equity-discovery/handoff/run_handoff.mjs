/**
 * Equity -> paper-path handoff runner (sandbox).
 *
 * Drives the SAME integrated issuance handler crypto uses
 * (processIntegratedCandidate — the repaired paper path with DbStore, the
 * corrected veto incl. waiting-interval, and the entry-v1 contract) for
 * equity candidates produced by the resumable-batch discovery scan.
 *
 * Equity entry semantics (entry-v1): next XNYS session open print
 * (consolidated tape), via the ScriptedFeed sandbox venue. The contract's
 * equity entry rule is the production rule — only the venue is scripted,
 * which is exactly what the entry-v1 sandbox VenueFeed interface is for.
 *
 * Per candidate the full state machine runs:
 *   qualified -> awaiting-entry -> entered | expired | invalidated
 * and every outcome is recorded (issued / rejected+gate / deferred+reason).
 * For entered signals the three timestamps are asserted:
 *   setupAlertAt < entryObservedAt <= alertDeliveredAt
 *
 * SANDBOX ONLY: DbStore file under handoff/, simulated alert acks, scripted
 * venue prints. No production issuance, no brokerage.
 *
 * Usage:
 *   node run_handoff.mjs --inputs handoff-inputs-2026-10-14.json \
 *                        --db handoff/store-2026-10-14.db \
 *                        --report handoff/handoff-report-2026-10-14.md \
 *                        [--limit N]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORCH_DIST = resolve(HERE, "../../orchestrator/dist/paper-signals/orchestrator");
const ENTRY_DIST = resolve(HERE, "../../entry-v1/dist");

const { DbStore } = await import(join(ORCH_DIST, "src/persistence/db-store.js"));
const { manualClock } = await import(join(ORCH_DIST, "src/clock.js"));
const {
  ingestIntegratedCandidate,
  processIntegratedCandidate,
} = await import(join(ORCH_DIST, "src/issuance/handler.js"));
const { MutableClock, ScriptedFeed } = await import(join(ENTRY_DIST, "src/feed.js"));
const { equityOpenPrintFeed, sessionBar } = await import(
  join(ORCH_DIST, "tests/fixtures.js")
);
const { nextXnysSession, etWallToUtcIso } = await import(
  join(ENTRY_DIST, "src/entry-rules.js")
);

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith("--") ? [[a.slice(2), arr[i + 1]]] : []
  )
);
const inputsPath = resolve(args["inputs"]);
const dbPath = resolve(args["db"]);
const reportPath = resolve(args["report"]);
const limit = args["limit"] ? parseInt(args["limit"], 10) : Infinity;
mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });

const { cycle, inputs } = JSON.parse(readFileSync(inputsPath, "utf8"));
const picked = inputs.slice(0, limit);

const lines = [];
const emit = (s = "") => { lines.push(s); console.log(s); };
let failures = 0;
const check = (name, cond, detail = "") => {
  if (!cond) failures++;
  emit(`  [${cond ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
};

const store = new DbStore(dbPath);
const alertLog = [];
const results = [];

for (const input of picked) {
  const { _provenance, ...candidateInput } = input;
  emit(`\n## ${candidateInput.symbol} ${candidateInput.direction} score=${candidateInput.score}`);
  const handlerStartMs = Math.max(Date.parse(candidateInput.detectedAt), Date.now());
  const clock = manualClock(handlerStartMs);

  // Venue: next XNYS session open print on the consolidated tape, priced at
  // the reference entry +0.1% (inside the 50bps equity drift cap).
  const printPrice = candidateInput.entryPrice * 1.001;
  const deps = {
    store,
    clock,
    config: { freshnessMs: 48 * 3_600_000 },
    entryFeedFor: () => {
      const setup = equityOpenPrintFeed(clock.now(), candidateInput.signalDate, printPrice);
      return {
        feed: setup.feed,
        clock: setup.clock,
        pollIntervalMs: 60_000,
        maxPolls: 5000,
        advance: (ms) => { setup.clock.advance(ms); clock.advance(ms); },
      };
    },
    // Post-entry session bar: clean by construction (long: low holds at the
    // entry print, above the 2xATR stop; short: mirrored). Sandbox fixture.
    postEntryEvidenceFor: () => {
      const entryDate = nextXnysSession(candidateInput.signalDate);
      const ohlc = candidateInput.direction === "long"
        ? { open: printPrice, high: printPrice * 1.01, low: printPrice, close: printPrice * 1.005 }
        : { open: printPrice, high: printPrice, low: printPrice * 0.99, close: printPrice * 0.995 };
      const openTs = Date.parse(etWallToUtcIso(entryDate, "09:30"));
      return {
        bars: [sessionBar(entryDate, ohlc, `${candidateInput.symbol} post-entry session (sandbox fixture)`)],
        nowAt: openTs + 6.5 * 3_600_000,
      };
    },
    deliverAlert: async (alert) => {
      alertLog.push({ id: alert.id, kind: alert.kind, at: new Date(clock.now()).toISOString() });
      return { acknowledged: true, mode: "simulated", ackId: `sandbox-${alert.id}` };
    },
    deliveryMode: "simulated",
  };

  let rec;
  try {
    rec = await ingestIntegratedCandidate(deps, candidateInput);
    rec = await processIntegratedCandidate(deps, rec, "manual", `equity-handoff-${candidateInput.symbol}-${cycle}`);
  } catch (e) {
    emit(`  [FAIL] handler threw: ${e.message}`);
    failures++;
    results.push({ symbol: candidateInput.symbol, status: "handler-error", reason: e.message });
    continue;
  }

  const row = {
    symbol: candidateInput.symbol,
    direction: candidateInput.direction,
    score: candidateInput.score,
    status: rec.status,
    gate: rec.outcome?.gate ?? null,
    reason: rec.outcome?.reason ?? null,
    candidateId: rec.candidateId,
    contractId: rec.contractId,
    signalId: rec.issuedSignalId,
    setupAlertAt: rec.setupAlertAt,
    entryObservedAt: rec.entryObservedAt,
    alertedAt: rec.alertedAt,
  };
  results.push(row);
  emit(`  status=${rec.status} gate=${row.gate ?? "-"} contract=${rec.contractId ?? "-"} signal=${rec.issuedSignalId ?? "-"}`);
  if (rec.outcome?.reason) emit(`  reason: ${rec.outcome.reason}`);

  if (rec.status === "issued") {
    check("setupAlertAt < entryObservedAt",
      !!(rec.setupAlertAt && rec.entryObservedAt && rec.setupAlertAt < rec.entryObservedAt),
      `${rec.setupAlertAt} < ${rec.entryObservedAt}`);
    check("entryObservedAt <= alertedAt",
      !!(rec.entryObservedAt && rec.alertedAt && rec.entryObservedAt <= rec.alertedAt),
      `${rec.entryObservedAt} <= ${rec.alertedAt}`);
    check("signal row persisted with contractId",
      store.listSignals().some((s) => s.signalId === rec.issuedSignalId && s.contractId === rec.contractId));
  }
}

// Final report
const md = [];
md.push(`# Equity -> paper-path handoff report — cycle ${cycle}`);
md.push(``);
md.push(`- Inputs: ${picked.length} qualified equity candidates from the resumable-batch discovery scan`);
md.push(`- Handler: integrated issuance path (DbStore ${dbPath}) — same orchestrator, same gates as crypto`);
md.push(`- Entry semantics: entry-v1 next-XNYS-session-open-print (consolidated tape; sandbox ScriptedFeed)`);
md.push(`- Alert acks: simulated (sandbox transport)`);
md.push(`- Timestamp rule asserted per entered signal: setupAlertAt < entryObservedAt <= alertedAt`);
md.push(``);
md.push(`| symbol | direction | score | status | gate | contract | signal | setupAlertAt | entryObservedAt | alertedAt |`);
md.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of results) {
  md.push(`| ${r.symbol} | ${r.direction} | ${r.score} | ${r.status} | ${r.gate ?? "-"} | ${r.contractId ?? "-"} | ${r.signalId ?? "-"} | ${r.setupAlertAt ?? "-"} | ${r.entryObservedAt ?? "-"} | ${r.alertedAt ?? "-"} |`);
}
md.push(``);
const byStatus = {};
for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
md.push(`Outcome mix: ${JSON.stringify(byStatus)}. Handler check failures: ${failures}.`);
md.push(``);
md.push(`## State machine coverage`);
md.push(``);
md.push(`qualified -> awaiting-entry -> entered | expired | invalidated, per the integrated handler.`);
md.push(`Rejections carry the deciding gate; deferrals carry the reason + next reassessment.`);
writeFileSync(reportPath, md.join("\n") + "\n");

const signals = store.listSignals();
const contracts = store.tableCount("contracts");
emit(`\n== handoff complete: ${results.length} candidates, ${signals.length} signals issued, ${contracts} contracts ==`);
emit(`report: ${reportPath}`);
store.close();
if (failures > 0) process.exitCode = 1;
