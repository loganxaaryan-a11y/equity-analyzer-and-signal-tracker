/**
 * Build paper-handoff inputs from the consolidated equity scan.
 *
 * Reads:  state/qualified-candidates-<cycle>.json + state/ledgers/<cycle>/*.json
 * Writes: handoff/handoff-inputs-<cycle>.json  (PaperCandidateInput[])
 *
 * Each input carries the complete persisted evidence the integrated handler
 * needs: signal-day OHLC, history closes/highs, current price, asOf, and the
 * full rawBars for the real equity reconstruction path (short reassessment).
 * Nothing is recomputed here — the ledger is the source of truth, written
 * BEFORE the symbol was marked qualified by the scanner.
 *
 * Usage: node build_inputs.mjs --state-dir <dir> --cycle 2026-10-14
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith("--") ? [[a.slice(2), arr[i + 1]]] : []
  )
);
const stateDir = args["state-dir"];
const cycle = args["cycle"] || "2026-10-14";

const qualified = JSON.parse(
  readFileSync(join(stateDir, `qualified-candidates-${cycle}.json`), "utf8")
);

const inputs = qualified.candidates.map((c) => {
  const ledger = JSON.parse(readFileSync(c.ledgerPath, "utf8"));
  const sd = ledger.signalDay;
  return {
    terminal: "equity",
    symbol: c.symbol,
    name: c.name,
    direction: c.direction,
    score: c.score,
    entryPrice: c.entryPrice,
    invalidation: c.invalidation,
    target1: c.target1,
    target2: c.target2,
    signalDate: c.signalDate,
    detectedAt: c.detectedAt,
    source: "equity-discovery-scan",
    inputs: {
      signalDay: {
        day: sd.date, open: sd.open, high: sd.high, low: sd.low, close: sd.close,
        source: "yahoo-2y-discovery-scan",
      },
      historyCloses: ledger.historyCloses,
      historyHighs: ledger.historyHighs,
      currentPrice: sd.close,
      asOf: c.detectedAt,
      rawBars: ledger.rawBars.map((b) => ({
        date: b.date, open: b.open, high: b.high, low: b.low, close: b.close,
      })),
    },
    // provenance (not part of the handler contract; carried for the report)
    _provenance: {
      ledgerPath: c.ledgerPath,
      factorModel: ledger.factorModel,
      issuance: ledger.issuance,
      completeness: ledger.completeness,
    },
  };
});

const outPath = join(HERE, `handoff-inputs-${cycle}.json`);
mkdirSync(HERE, { recursive: true });
writeFileSync(outPath, JSON.stringify({ cycle, count: inputs.length, inputs }, null, 2));
console.log(JSON.stringify({ ok: true, count: inputs.length, outPath }));
