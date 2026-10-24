import { describe, expect, test } from "bun:test";
import { acceptedEvaluationRevisionsForCohort, computeEquityDecisionFromRawInputs, deterministicReplaySnapshot, type DailyEvidenceBar, type EquityDecisionSnapshot } from "./measurement";

function rawWindow(): Array<DailyEvidenceBar & { volume: number }> {
  const rows: Array<DailyEvidenceBar & { volume: number }> = [];
  const start = Date.parse("2025-01-02T00:00:00.000Z");
  for (let index = 0; index < 230; index += 1) {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    const close = 100 + index * 0.08 + Math.sin(index / 5) * 1.5;
    rows.push({ date, open: close - 0.25, high: close + 1.2, low: close - 1.1, close, volume: 1_000_000 + (index % 17) * 25_000, availableAt: `${date}T21:00:00.000Z` });
  }
  return rows;
}

function issuedSnapshot() {
  const bars = rawWindow();
  const decisionAt = bars.at(-1)?.availableAt ?? "2025-08-19T21:00:00.000Z";
  const replay = computeEquityDecisionFromRawInputs(bars, decisionAt, { invalidationAtrMultiple: 2, target1R: 1.5, target2R: 2.5 });
  if (replay.status !== "reconstructed" || !replay.decision || !replay.levels) throw new Error("fixture did not reconstruct");
  const snapshot: EquityDecisionSnapshot = { availableThrough: decisionAt, rawBars: bars, factors: replay.factors, decision: { direction: replay.decision.direction, score: replay.decision.score }, levels: replay.levels, canonicalParameters: { invalidationAtrMultiple: 2, target1R: 1.5, target2R: 2.5 } };
  return { snapshot, decisionAt };
}

describe("Phase 1.2 reconstruction integration", () => {
  test("untouched raw snapshot reconstructs every compared output without network access", () => {
    const { snapshot, decisionAt } = issuedSnapshot(); const replay = deterministicReplaySnapshot(snapshot, decisionAt);
    expect(replay.status).toBe("reconstructed"); expect(replay.matchesSaved).toBe(true); expect(replay.mismatches).toEqual([]);
  });
  test("changing a relevant raw input produces field-level mismatches", () => {
    const { snapshot, decisionAt } = issuedSnapshot(); const changed = structuredClone(snapshot); const last = changed.rawBars.at(-1); if (!last) throw new Error("fixture"); last.close = (last.close ?? 0) * 1.3; last.high = last.close + 2; last.open = last.close - 1; last.low = last.close - 2;
    const replay = deterministicReplaySnapshot(changed, decisionAt); expect(replay.status).toBe("reconstructed"); expect(replay.matchesSaved).toBe(false); expect(replay.mismatches.some((row) => row.field.startsWith("levels.") || row.field === "decision.score")).toBe(true);
  });
  test("altering saved outputs alone is detected", () => {
    const { snapshot, decisionAt } = issuedSnapshot(); const changed = structuredClone(snapshot); changed.decision.score += 7; changed.levels.target1 += 3;
    const replay = deterministicReplaySnapshot(changed, decisionAt); expect(replay.matchesSaved).toBe(false); expect(replay.mismatches.map((row) => row.field)).toContain("decision.score"); expect(replay.mismatches.map((row) => row.field)).toContain("levels.target1");
  });
  test("post-decision unavailable input has no effect", () => {
    const { snapshot, decisionAt } = issuedSnapshot(); const baseline = deterministicReplaySnapshot(snapshot, decisionAt); const future = structuredClone(snapshot); future.rawBars.push({ date: "2026-01-05", open: 900, high: 999, low: 800, close: 950, volume: 9_000_000, availableAt: "2026-01-05T21:00:00.000Z" });
    const replay = deterministicReplaySnapshot(future, decisionAt); expect(replay.decision).toEqual(baseline.decision); expect(replay.levels).toEqual(baseline.levels); expect(replay.bars).toHaveLength(baseline.bars.length);
  });
});

describe("Phase 1.2 cohort isolation", () => {
  test("accepted revision selection excludes mixed strategy, horizon, evaluator and cost cohorts", () => {
    const wanted = "strategy|3.1|hash-a|trade_setup|30:trading_sessions|price|entry|unknown:unknown";
    const rows = [
      { id: 1, signalId: 1, product: "trade_setup", cohortKey: wanted, evaluatedAt: new Date("2026-10-09T10:00:00Z"), accepted: true, verdict: "HIT" },
      { id: 2, signalId: 2, product: "trade_setup", cohortKey: "strategy|3.0|hash-old|trade_setup|30:trading_sessions|price|entry|unknown:unknown", evaluatedAt: new Date("2026-10-09T10:00:00Z"), accepted: true, verdict: "MISS" },
      { id: 3, signalId: 3, product: "trade_setup", cohortKey: "strategy|3.1|hash-a|trade_setup|5:trading_sessions|price|entry|unknown:unknown", evaluatedAt: new Date("2026-10-09T10:00:00Z"), accepted: true, verdict: "MISS" },
      { id: 4, signalId: 4, product: "trade_setup", cohortKey: "strategy|3.1|hash-a|trade_setup|30:trading_sessions|price|entry|modeled:18", evaluatedAt: new Date("2026-10-09T10:00:00Z"), accepted: true, verdict: "MISS" },
    ];
    const selected = acceptedEvaluationRevisionsForCohort(rows, new Set([wanted])); expect([...selected.values()].map((row) => row.id)).toEqual([1]);
  });
});
