import { describe, expect, test } from "bun:test";
import { acceptedEvaluationRevisions, assessDirectionalEvidence, deterministicReplaySnapshot, evaluateEquityDirectionForecast, evaluateEquityTradeSetup, expectedXnysSessions, linearReturnPct, xnysSessionBounds, type DailyEvidenceBar, type FrozenEvaluationSignal } from "./measurement";

const signal = (overrides: Partial<FrozenEvaluationSignal> = {}): FrozenEvaluationSignal => ({ signalId: 52, direction: "long", entryPrice: 100, stopPrice: 90, targetPrice: 115, issuedAt: "2026-10-03T15:00:00.000Z", entryAt: "2026-10-03T15:00:00.000Z", expiresAt: null, primaryHorizon: 30, horizonUnit: "trading_sessions", exchangeCalendar: "XNYS", entryRule: "first eligible quote after issuance", ...overrides });
const bar = (date: string, overrides: Partial<DailyEvidenceBar> = {}): DailyEvidenceBar => ({ date, open: 100, high: 105, low: 95, close: 100, availableAt: xnysSessionBounds(date)?.end ?? null, ...overrides });
const sessions = expectedXnysSessions(signal().entryAt, 30);
const completeBars = () => sessions.map((date) => bar(date));

describe("Phase 1.1 time and coverage closure", () => {
  test("pre-issuance target cannot settle the prospective setup", () => {
    const result = evaluateEquityTradeSetup(signal(), [bar("2026-10-02", { high: 116 }), bar("2026-10-05")], "2026-12-31T23:00:00.000Z");
    expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("missing_required_session"); expect(result.grossReturnPct).toBeNull();
  });
  test("missing OHLC before a later target is unverified", () => {
    const result = evaluateEquityTradeSetup(signal(), [bar("2026-10-05", { open: null, high: null, low: null, close: 100 }), bar("2026-10-06", { high: 116 })], "2026-12-31T23:00:00.000Z");
    expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("invalid_ohlc");
  });
  test("a future daily candle is never consumed", () => {
    const result = evaluateEquityTradeSetup(signal({ primaryHorizon: 1 }), [bar("2026-10-05", { high: 116 })], "2026-10-05T15:00:00.000Z");
    expect(result.verdict).toBe("OPEN"); expect(result.reasonCode).toBe("awaiting_closed_session");
  });
  test("expiry inside a daily candle cannot prove a touch", () => {
    const result = evaluateEquityTradeSetup(signal({ primaryHorizon: 1, expiresAt: "2026-10-05T17:00:00.000Z" }), [bar("2026-10-05", { high: 116 })], "2026-10-06T00:00:00.000Z");
    expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("expiry_straddles_session");
  });
  test("missing first, middle, and tail sessions never become verified time exits", () => {
    const firstMissing = evaluateEquityTradeSetup(signal({ primaryHorizon: 2 }), [bar("2026-10-06", { high: 116 })], "2026-10-07T00:00:00.000Z");
    const middleMissing = evaluateEquityTradeSetup(signal({ primaryHorizon: 3 }), [bar("2026-10-05"), bar("2026-10-07", { high: 116 })], "2026-10-08T00:00:00.000Z");
    const tailMissing = evaluateEquityTradeSetup(signal({ primaryHorizon: 3 }), [bar("2026-10-05")], "2026-10-08T00:00:00.000Z");
    for (const result of [firstMissing, middleMissing, tailMissing]) { expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("missing_required_session"); }
  });
  test("opening adverse gap applies before unordered high and low", () => {
    const result = evaluateEquityTradeSetup(signal({ primaryHorizon: 1 }), [bar("2026-10-05", { open: 80, high: 116, low: 79, close: 100 })], "2026-10-06T00:00:00.000Z");
    expect(result.verdict).toBe("MISS"); expect(result.reasonCode).toBe("opening_stop_gap"); expect(result.exitPrice).toBe(80); expect(result.grossReturnPct).toBe(-20);
  });
  test("double-touch daily bar stays ambiguous", () => {
    const result = evaluateEquityTradeSetup(signal({ primaryHorizon: 1 }), [bar("2026-10-05", { high: 116, low: 89 })], "2026-10-06T00:00:00.000Z");
    expect(result.verdict).toBe("AMBIGUOUS"); expect(result.grossReturnPct).toBeNull();
  });
  test("research-reference price cannot masquerade as executable setup", () => {
    const result = evaluateEquityTradeSetup(signal({ entryRule: "Reference close; paper execution is not claimed" }), completeBars(), "2026-12-31T23:00:00.000Z");
    expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("research_only_entry");
  });
  test("time exit uses the exact declared final session close", () => {
    const bars = completeBars(); const last = bars.at(-1); if (!last) throw new Error("fixture"); last.close = 103; last.high = 105; last.low = 95;
    const result = evaluateEquityTradeSetup(signal(), bars, "2026-12-31T23:00:00.000Z");
    expect(result.verdict).toBe("TIME_EXIT"); expect(result.exitPrice).toBe(103); expect(result.grossReturnPct).toBe(3);
  });
});

describe("returns, costs, calendars, and products", () => {
  test("linear shorts use entry notional", () => { expect(linearReturnPct("short", 100, 110)).toBeCloseTo(-10); expect(linearReturnPct("short", 100, 85)).toBeCloseTo(15); });
  test("unknown cost is null; modeled 18 bps is explicit", () => {
    const hit = [bar("2026-10-05", { high: 116 })]; const unknown = evaluateEquityTradeSetup(signal({ primaryHorizon: 1 }), hit, "2026-10-06T00:00:00.000Z"); const modeled = evaluateEquityTradeSetup(signal({ primaryHorizon: 1 }), hit, "2026-10-06T00:00:00.000Z", { kind: "modeled", roundTripBps: 18, version: "scenario-18bps-v1" });
    expect(unknown.grossReturnPct).toBe(15); expect(unknown.modeledNetReturnPct).toBeNull(); expect(unknown.costStatus).toBe("unknown"); expect(modeled.modeledNetReturnPct).toBeCloseTo(14.82); expect(modeled.costBps).toBe(18);
  });
  test("frozen META target 115 reaches evaluation unchanged", () => { const result = evaluateEquityTradeSetup(signal({ primaryHorizon: 1, targetPrice: 115 }), [bar("2026-10-05", { high: 115 })], "2026-10-06T00:00:00.000Z"); expect(result.exitPrice).toBe(115); });
  test("XNYS DST and early close bounds are explicit", () => {
    expect(xnysSessionBounds("2026-03-06")?.end).toBe("2026-03-06T21:00:00.000Z"); expect(xnysSessionBounds("2026-03-09")?.end).toBe("2026-03-09T20:00:00.000Z"); expect(xnysSessionBounds("2026-11-27")).toEqual({ start: "2026-11-27T14:30:00.000Z", end: "2026-11-27T18:00:00.000Z", earlyClose: true }); expect(xnysSessionBounds("2026-11-28")).toBeNull();
  });
  test("fixed-horizon direction fails closed across missing sessions", () => { const result = evaluateEquityDirectionForecast(signal({ primaryHorizon: 2 }), [bar("2026-10-05"), bar("2026-10-07")], "2026-10-08T00:00:00.000Z"); expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("missing_required_session"); });
  test("direction forecast does not consume evidence unavailable at cutoff", () => { const result = evaluateEquityDirectionForecast(signal({ primaryHorizon: 1 }), [bar("2026-10-05", { close: 104, high: 105, availableAt: "2026-10-07T20:00:00.000Z" })], "2026-10-06T20:00:00.000Z"); expect(result.verdict).toBe("OPEN"); expect(result.reasonCode).toBe("evidence_not_yet_available"); expect(result.grossReturnPct).toBeNull(); });
  test("entry inside a session cannot skip an unobserved entry-day path", () => { const result = evaluateEquityTradeSetup(signal({ issuedAt: "2026-10-05T13:59:00.000Z", entryAt: "2026-10-05T14:00:00.000Z", primaryHorizon: 2 }), [bar("2026-10-05", { low: 89 }), bar("2026-10-06", { high: 116 })], "2026-10-07T00:00:00.000Z"); expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("entry_session_path_unobserved"); });
  test("calendar dates outside validated coverage fail closed", () => { expect(expectedXnysSessions("2028-01-03T15:00:00.000Z", 1)).toEqual([]); const result = evaluateEquityDirectionForecast(signal({ entryAt: "2028-01-03T15:00:00.000Z", issuedAt: "2028-01-03T14:00:00.000Z", primaryHorizon: 1 }), [], "2028-01-10T00:00:00.000Z"); expect(result.verdict).toBe("UNVERIFIED"); expect(result.reasonCode).toBe("calendar_unavailable"); });
});

describe("append-only read model and offline replay", () => {
  test("accepted revision selects improved evidence and preserves predecessor row", () => {
    const oldRow = { id: 1, signalId: 52, product: "trade_setup", evaluatedAt: new Date("2026-10-06T00:00:00Z"), accepted: false, verdict: "UNVERIFIED" };
    const newRow = { id: 2, signalId: 52, product: "trade_setup", evaluatedAt: new Date("2026-10-07T00:00:00Z"), accepted: true, verdict: "HIT" };
    const current = acceptedEvaluationRevisions([oldRow, newRow]); expect(current.get("52|trade_setup")?.id).toBe(2); expect([oldRow, newRow]).toHaveLength(2);
  });
  test("offline replay ignores inputs unavailable at decision time", () => {
    const snapshot = { availableThrough: "2026-10-05T20:00:00Z", rawBars: [bar("2026-10-05", { availableAt: "2026-10-05T20:00:00Z" }), bar("2026-10-06", { availableAt: "2026-10-06T20:00:00Z", high: 999 })], factors: [{ id: "trend" }], decision: { direction: "long" as const, score: 42 }, levels: { entryPrice: 100, stopPrice: 90, target1: 115, target2: 125 } };
    const replay = deterministicReplaySnapshot(snapshot, "2026-10-05T20:01:00Z"); expect(replay.bars).toHaveLength(1); expect(replay.status).toBe("partial"); expect(replay.decision).toBeNull(); expect(replay.matchesSaved).toBe(false);
  });
  test("sample sufficiency does not validate poor economics or edge", () => { const assessment = assessDirectionalEvidence(Array.from({ length: 24 }, () => -1.0211)); expect(assessment.sampleSufficient).toBe(true); expect(assessment.qualified).toBe(false); expect(assessment.edgeValidated).toBe(false); });
});
