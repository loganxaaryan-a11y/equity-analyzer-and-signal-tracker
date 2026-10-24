import { describe, expect, test } from "bun:test";
import { candleState, classifyFreshness, currentFreshness, observationIdentity, planSignalStatus, requestBudget, signalObservationEligibility } from "./freshness";

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
  test("freshness is recalculated at read time while fetch health remains separate", () => {
    const atReceipt = currentFreshness({ nowIso: "2026-10-09T14:00:00Z", providerEventAt: "2026-10-09T13:59:00Z", lastSuccessAt: "2026-10-09T14:00:00Z", kind: "quote", marketKind: "equity", marketOpen: true, error: null });
    const stopped = currentFreshness({ nowIso: "2026-10-09T19:00:00Z", providerEventAt: "2026-10-09T13:59:00Z", lastSuccessAt: "2026-10-09T14:00:00Z", kind: "quote", marketKind: "equity", marketOpen: true, error: null });
    expect(atReceipt.state).toBe("fresh"); expect(stopped.state).toBe("stale"); expect(stopped.fetchAgeSeconds).toBe(18_000);
  });
  test("successful unchanged fetch records health but does not freshen old provider content", () => {
    const row = currentFreshness({ nowIso: "2026-10-09T19:00:00Z", providerEventAt: "2026-10-09T13:00:00Z", lastSuccessAt: "2026-10-09T18:59:00Z", kind: "quote", marketKind: "equity", marketOpen: true, error: null });
    expect(row.fetchAgeSeconds).toBe(60); expect(row.state).toBe("stale");
  });
  test("future provider timestamps fail closed", () => {
    expect(classifyFreshness({ nowIso: "2026-10-09T14:00:00Z", eventAt: "2026-10-09T14:01:00Z", kind: "quote", marketKind: "equity", marketOpen: true, error: null }).state).toBe("stale");
  });
  test("pre-issuance quote cannot append a barrier event", () => {
    const eligibility = signalObservationEligibility({ validationStatus: "collecting", issuedAt: "2026-10-09T09:05:00Z", entryAt: "2026-10-09T09:05:00Z", exchangeCalendar: "XNYS", signalVenue: "Yahoo Finance", priceBasis: "Yahoo adjusted OHLC research reference", observationVenue: "Yahoo Finance aggregate", observationEventAt: "2026-10-09T09:04:00Z", freshnessState: "fresh" });
    expect(eligibility).toEqual({ eligible: false, reason: "pre_issuance_event" });
  });
  test("stale and incompatible quote observations cannot append barrier events", () => {
    const base = { validationStatus: "collecting" as const, issuedAt: "2026-10-09T09:05:00Z", entryAt: "2026-10-09T09:05:00Z", exchangeCalendar: "XNYS", signalVenue: "Yahoo Finance", priceBasis: "Yahoo adjusted OHLC research reference", observationVenue: "Yahoo Finance aggregate", observationEventAt: "2026-10-09T09:06:00Z" };
    expect(signalObservationEligibility({ ...base, freshnessState: "stale" }).reason).toBe("stale_quote");
    expect(signalObservationEligibility({ ...base, freshnessState: "fresh", observationVenue: "Binance" }).reason).toBe("incompatible_venue");
  });
});
