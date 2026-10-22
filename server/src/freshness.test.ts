import { describe, expect, test } from "bun:test";
import { candleState, classifyFreshness, currentFreshness, isNyseEarlyClose, isNyseTradingDay, isSessionBarCompleted, latestCompletedSessionDate, nyseSessionCloseUtcIso, observationIdentity, planSignalStatus, requestBudget, seriesCoverage, signalObservationEligibility } from "./freshness";

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

describe("Completed-session coverage (cache repair regression)", () => {
  // 2026-10-16 is a Friday; 2026-10-19 is the following Monday. October is EDT (UTC-4).
  test("reproduced gap: a partial Monday bar captured at 10:00 ET never completes, even when read after the close", () => {
    expect(isSessionBarCompleted("2026-10-19", "2026-10-19T14:00:00Z")).toBe(false);
    expect(isSessionBarCompleted("2026-10-19", "2026-10-19T20:14:00Z")).toBe(false); // 16:14 ET: publication delay not yet met
    expect(isSessionBarCompleted("2026-10-19", "2026-10-19T20:15:00Z")).toBe(true); // captured at/after close + 15m
  });
  test("Friday's completed bar stays valid during Monday's session without masquerading as Monday's", () => {
    expect(isSessionBarCompleted("2026-10-16", "2026-10-19T17:30:00Z")).toBe(true);
    expect(latestCompletedSessionDate("2026-10-19T17:30:00Z")).toBe("2026-10-16"); // Monday 13:30 ET
    expect(latestCompletedSessionDate("2026-10-19T21:30:00Z")).toBe("2026-10-19"); // Monday 17:30 ET, after publication
  });
  test("Sunday evening still resolves to Friday's completed session", () => {
    expect(latestCompletedSessionDate("2026-10-18T23:00:00Z")).toBe("2026-10-16");
  });
  test("coverage: a Saturday cache covering Friday legitimately hits on Monday intraday but not after Monday's close", () => {
    const points = [{ date: "2026-10-15" }, { date: "2026-10-16" }];
    const saturdayCapture = "2026-10-17T15:00:00Z";
    expect(seriesCoverage(points, saturdayCapture, "2026-10-19T17:30:00Z")).toEqual({ newestBarDate: "2026-10-16", newestCompletedBarDate: "2026-10-16", formingBarDate: null, latestCompletedSessionDate: "2026-10-16", coversLatestCompletedSession: true });
    expect(seriesCoverage(points, saturdayCapture, "2026-10-19T21:30:00Z").coversLatestCompletedSession).toBe(false);
  });
  test("coverage: a cache holding a partial Monday bar does not cover Monday after the close", () => {
    const points = [{ date: "2026-10-16" }, { date: "2026-10-19" }];
    const mondayIntradayCapture = "2026-10-19T14:00:00Z"; // 10:00 ET, mid-session
    const intraday = seriesCoverage(points, mondayIntradayCapture, "2026-10-19T17:30:00Z");
    expect(intraday.newestCompletedBarDate).toBe("2026-10-16");
    expect(intraday.formingBarDate).toBe("2026-10-19");
    expect(intraday.coversLatestCompletedSession).toBe(true); // Friday is still the latest completed session
    const postClose = seriesCoverage(points, mondayIntradayCapture, "2026-10-19T21:30:00Z");
    expect(postClose.coversLatestCompletedSession).toBe(false); // forces the post-close refetch the old date gate blocked
  });
  test("Thanksgiving week: Thursday is a holiday and Friday is a 13:00 early close", () => {
    expect(isNyseTradingDay("2026-11-26")).toBe(false);
    expect(isNyseTradingDay("2026-11-27")).toBe(true);
    expect(isNyseEarlyClose("2026-11-27")).toBe(true);
    expect(isSessionBarCompleted("2026-11-26", "2026-12-01T00:00:00Z")).toBe(false); // a holiday bar never completes
    expect(latestCompletedSessionDate("2026-11-27T17:00:00Z")).toBe("2026-11-25"); // Friday noon ET: Wednesday is latest completed
    expect(isSessionBarCompleted("2026-11-27", "2026-11-27T18:10:00Z")).toBe(false); // 13:10 ET, before 13:15 publication
    expect(isSessionBarCompleted("2026-11-27", "2026-11-27T18:20:00Z")).toBe(true);
    expect(latestCompletedSessionDate("2026-11-27T18:20:00Z")).toBe("2026-11-27");
  });
  test("Christmas week: Friday Dec 25 is a holiday and Thursday Dec 24 is an early close", () => {
    expect(isNyseTradingDay("2026-12-25")).toBe(false);
    expect(isNyseEarlyClose("2026-12-24")).toBe(true);
    expect(isSessionBarCompleted("2026-12-24", "2026-12-24T18:20:00Z")).toBe(true); // 13:20 EST
    expect(latestCompletedSessionDate("2026-12-27T15:00:00Z")).toBe("2026-12-24"); // Sunday after Christmas
  });
  test("Independence Day 2026: Jul 4 is a Saturday, so Jul 3 is the observed holiday and Jul 2 closes early", () => {
    expect(isNyseTradingDay("2026-07-03")).toBe(false);
    expect(isNyseEarlyClose("2026-07-02")).toBe(true);
    expect(isSessionBarCompleted("2026-07-02", "2026-07-02T17:10:00Z")).toBe(false); // 13:10 EDT
    expect(isSessionBarCompleted("2026-07-02", "2026-07-02T17:20:00Z")).toBe(true);
  });
  test("New Year: Friday Jan 1 2027 is a holiday, so Sunday Jan 3 resolves to Thursday Dec 31", () => {
    expect(isNyseTradingDay("2027-01-01")).toBe(false);
    expect(latestCompletedSessionDate("2027-01-03T15:00:00Z")).toBe("2026-12-31");
  });
  test("session close instants are DST-aware", () => {
    expect(nyseSessionCloseUtcIso("2026-03-06")).toBe("2026-03-06T21:00:00.000Z"); // Friday before spring forward: EST
    expect(nyseSessionCloseUtcIso("2026-03-09")).toBe("2026-03-09T20:00:00.000Z"); // Monday after: EDT
    expect(nyseSessionCloseUtcIso("2026-11-27")).toBe("2026-11-27T18:00:00.000Z"); // early close 13:00 EST
  });
});
