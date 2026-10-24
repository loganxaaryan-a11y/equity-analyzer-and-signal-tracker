import { describe, expect, test } from "bun:test";
import { candleState, classifyFreshness, observationIdentity, planSignalStatus, requestBudget } from "./freshness";

describe("Track A market freshness isolation", () => {
  test("throttled analysis does not enter the market-data budget", () => {
    expect(requestBudget(4, 15)).toEqual({ activeInstruments: 4, cadenceMinutes: 15, runsPerDay: 96, requestsPerRun: 4, dailyRequests: 384, monthlyRequests30d: 11520 });
  });
  test("old provider content stays stale even after a successful receipt", () => {
    expect(classifyFreshness({ nowIso: "2026-10-09T16:00:00Z", eventAt: "2026-10-09T12:00:00Z", kind: "quote", marketKind: "crypto", marketOpen: true, error: null }).state).toBe("stale");
  });
  test("forming crypto candle later closes without changing identity of prior version", () => {
    expect(candleState({ symbol: "BTC-USD", barDate: "2026-10-09", nowIso: "2026-10-09T16:00:00Z", equitySessionOpen: false })).toBe("forming");
    expect(candleState({ symbol: "BTC-USD", barDate: "2026-10-09", nowIso: "2026-10-10T00:01:00Z", equitySessionOpen: false })).toBe("closed");
  });
  test("provider outage retains age but reports error", () => {
    const row = classifyFreshness({ nowIso: "2026-10-09T16:00:00Z", eventAt: "2026-10-09T15:55:00Z", kind: "quote", marketKind: "equity", marketOpen: true, error: "HTTP 503" });
    expect(row.state).toBe("error"); expect(row.ageSeconds).toBe(300);
  });
  test("recovery derives a deterministic observation key for deduplication", () => {
    const input = { symbol: "SPY", kind: "quote" as const, eventAt: "2026-10-09T15:59:00Z", values: { price: 700, volume: null }, candleState: "forming" as const };
    expect(observationIdentity(input)).toBe(observationIdentity(input));
  });
  test("fresh quote does not imply stale factor freshness", () => {
    const quote = classifyFreshness({ nowIso: "2026-10-09T16:00:00Z", eventAt: "2026-10-09T15:55:00Z", kind: "quote", marketKind: "crypto", marketOpen: true, error: null });
    const funding = classifyFreshness({ nowIso: "2026-10-09T16:00:00Z", eventAt: "2026-10-08T15:55:00Z", kind: "quote", marketKind: "crypto", marketOpen: true, error: null });
    expect(quote.state).toBe("fresh"); expect(funding.state).toBe("stale");
  });
  test("status planning never mutates frozen levels", () => {
    const signal = { id: 1, direction: "long" as const, entryPrice: 100, invalidationLevel: 95, target1: 110, target2: 120 };
    const before = JSON.stringify(signal); const rows = planSignalStatus(signal, 111);
    expect(rows.some((row) => row.status === "target_observed")).toBe(true); expect(JSON.stringify(signal)).toBe(before);
  });
  test("barrier observation remains observed-only without path evidence", () => {
    expect(planSignalStatus({ id: 1, direction: "short", entryPrice: 100, invalidationLevel: 105, target1: 90, target2: 80 }, 89)[0]?.settlement).toBe("observed_only");
  });
  test("repeated status input produces the same deterministic identity material", () => {
    const key = observationIdentity({ symbol: "ETH-USD", kind: "quote", eventAt: "2026-10-09T15:59:00Z", values: { price: 4000 }, candleState: "forming" });
    expect(key).toBe(observationIdentity({ symbol: "ETH-USD", kind: "quote", eventAt: "2026-10-09T15:59:00Z", values: { price: 4000 }, candleState: "forming" }));
  });
  test("equity quote is labeled market-closed rather than real-time", () => {
    expect(classifyFreshness({ nowIso: "2026-10-09T16:00:00Z", eventAt: "2026-10-09T15:55:00Z", kind: "quote", marketKind: "equity", marketOpen: false, error: null }).state).toBe("market_closed");
  });
});
