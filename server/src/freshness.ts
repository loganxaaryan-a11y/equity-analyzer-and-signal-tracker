export type MarketKind = "equity" | "crypto";
export type ObservationKind = "quote" | "completed_candle" | "forming_candle";
export type FreshnessState = "fresh" | "stale" | "error" | "market_closed";
export type SignalEligibility = {
  eligible: boolean;
  reason: "eligible" | "signal_rejected" | "missing_issuance" | "pre_issuance_event" | "stale_quote" | "incompatible_calendar" | "incompatible_venue" | "incompatible_price_basis";
};

export const MARKET_REFRESH_CONFIG = {
  provider: "Yahoo Finance public chart",
  transport: "bounded polling",
  cadenceMinutes: 15,
  maxSymbolsPerRun: 20,
  quoteFreshSeconds: { crypto: 20 * 60, equity: 30 * 60 },
  completedCandleFreshSeconds: { crypto: 30 * 60 * 60, equity: 96 * 60 * 60 },
  formingCandleFreshSeconds: { crypto: 30 * 60, equity: 45 * 60 },
  retryBackoffSeconds: [30, 120] as const,
  requestsPerSymbol: 1,
  entitlement: "Public delayed/aggregated feed; not advertised as real-time",
} as const;

export function marketKindForSymbol(symbol: string): MarketKind {
  return symbol.toUpperCase().endsWith("-USD") ? "crypto" : "equity";
}

export function isFuturesSymbol(symbol: string): boolean {
  return symbol.toUpperCase().endsWith("=F");
}

export function futuresSessionOpen(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((row) => row.type === type)?.value ?? "";
  const weekday = part("weekday");
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  if (weekday === "Sat") return false;
  if (weekday === "Sun") return minute >= 18 * 60;
  if (weekday === "Fri") return minute < 17 * 60;
  return minute < 17 * 60 || minute >= 18 * 60;
}

export function ageSeconds(nowIso: string, eventAt: string | null): number | null {
  if (!eventAt) return null;
  const now = Date.parse(nowIso); const event = Date.parse(eventAt);
  return Number.isFinite(now) && Number.isFinite(event) ? Math.max(0, Math.floor((now - event) / 1000)) : null;
}

export function classifyFreshness(input: { nowIso: string; eventAt: string | null; kind: ObservationKind; marketKind: MarketKind; marketOpen: boolean; error: string | null }): { state: FreshnessState; ageSeconds: number | null; thresholdSeconds: number } {
  const thresholdSeconds = input.kind === "quote" ? MARKET_REFRESH_CONFIG.quoteFreshSeconds[input.marketKind] : input.kind === "forming_candle" ? MARKET_REFRESH_CONFIG.formingCandleFreshSeconds[input.marketKind] : MARKET_REFRESH_CONFIG.completedCandleFreshSeconds[input.marketKind];
  const age = ageSeconds(input.nowIso, input.eventAt);
  const futureEvent = input.eventAt != null && Number.isFinite(Date.parse(input.eventAt)) && Date.parse(input.eventAt) > Date.parse(input.nowIso) + 1_000;
  if (input.error) return { state: "error", ageSeconds: age, thresholdSeconds };
  if (futureEvent || age == null || age > thresholdSeconds) return { state: "stale", ageSeconds: age, thresholdSeconds };
  if (input.marketKind === "equity" && !input.marketOpen && input.kind === "quote") return { state: "market_closed", ageSeconds: age, thresholdSeconds };
  return { state: "fresh", ageSeconds: age, thresholdSeconds };
}

export function currentFreshness(input: { nowIso: string; providerEventAt: string | null; lastSuccessAt: string | null; kind: ObservationKind; marketKind: MarketKind; marketOpen: boolean; error: string | null }): { state: FreshnessState; providerAgeSeconds: number | null; fetchAgeSeconds: number | null; thresholdSeconds: number; stale: boolean } {
  const provider = classifyFreshness({ nowIso: input.nowIso, eventAt: input.providerEventAt, kind: input.kind, marketKind: input.marketKind, marketOpen: input.marketOpen, error: input.error });
  const fetchAgeSeconds = ageSeconds(input.nowIso, input.lastSuccessAt);
  return { state: provider.state, providerAgeSeconds: provider.ageSeconds, fetchAgeSeconds, thresholdSeconds: provider.thresholdSeconds, stale: provider.state === "stale" || provider.state === "error" };
}

export function signalObservationEligibility(input: {
  validationStatus: "unverified" | "collecting" | "validated" | "rejected";
  issuedAt: string | null;
  entryAt: string | null;
  exchangeCalendar: string;
  signalVenue: string;
  priceBasis: string;
  observationVenue: string;
  observationEventAt: string | null;
  freshnessState: FreshnessState;
}): SignalEligibility {
  if (input.validationStatus === "rejected") return { eligible: false, reason: "signal_rejected" };
  const cutoff = [input.issuedAt, input.entryAt].filter((value): value is string => value != null && Number.isFinite(Date.parse(value))).sort().at(-1) ?? null;
  if (!cutoff) return { eligible: false, reason: "missing_issuance" };
  if (!input.observationEventAt || !Number.isFinite(Date.parse(input.observationEventAt)) || Date.parse(input.observationEventAt) < Date.parse(cutoff)) return { eligible: false, reason: "pre_issuance_event" };
  if (input.freshnessState !== "fresh" && input.freshnessState !== "market_closed") return { eligible: false, reason: "stale_quote" };
  if (input.exchangeCalendar !== "XNYS") return { eligible: false, reason: "incompatible_calendar" };
  if (!input.signalVenue.toLowerCase().includes("yahoo") && input.signalVenue !== "XNYS") return { eligible: false, reason: "incompatible_venue" };
  if (!input.observationVenue.toLowerCase().includes("yahoo") && input.observationVenue !== "XNYS") return { eligible: false, reason: "incompatible_venue" };
  if (!input.priceBasis.toLowerCase().includes("adjusted") && !input.priceBasis.toLowerCase().includes("yahoo")) return { eligible: false, reason: "incompatible_price_basis" };
  return { eligible: true, reason: "eligible" };
}

export function candleState(input: { symbol: string; barDate: string; nowIso: string; equitySessionOpen: boolean }): "forming" | "closed" {
  const marketKind = marketKindForSymbol(input.symbol);
  const date = input.nowIso.slice(0, 10);
  if (marketKind === "crypto") return input.barDate === date ? "forming" : "closed";
  return input.barDate === date && input.equitySessionOpen ? "forming" : "closed";
}

export function observationIdentity(input: { symbol: string; kind: ObservationKind; eventAt: string; values: Record<string, number | null>; candleState: "forming" | "closed" }): string {
  const ordered = Object.keys(input.values).sort().map((key) => `${key}:${input.values[key] ?? "null"}`).join("|");
  return `${input.symbol.toUpperCase()}|${input.kind}|${input.eventAt}|${input.candleState}|${ordered}`;
}

export type FrozenSignal = { id: number; direction: "long" | "short"; entryPrice: number; invalidationLevel: number | null; target1: number | null; target2: number | null };
export type PlannedStatus = "target_observed" | "stop_observed" | "entry_no_longer_eligible";
export function planSignalStatus(signal: FrozenSignal, quote: number): Array<{ status: PlannedStatus; settlement: "observed_only"; note: string }> {
  const rows: Array<{ status: PlannedStatus; settlement: "observed_only"; note: string }> = [];
  if (signal.direction === "long") {
    if (signal.target1 != null && quote >= signal.target1) rows.push({ status: "target_observed", settlement: "observed_only", note: "Current mark is at/above target; earlier path is not established by a quote." });
    if (signal.invalidationLevel != null && quote <= signal.invalidationLevel) rows.push({ status: "stop_observed", settlement: "observed_only", note: "Current mark is at/below invalidation; earlier path is not established by a quote." });
    if (quote > signal.entryPrice * 1.03) rows.push({ status: "entry_no_longer_eligible", settlement: "observed_only", note: "Current mark is more than 3% above the frozen reference entry; the issued entry remains unchanged." });
  } else {
    if (signal.target1 != null && quote <= signal.target1) rows.push({ status: "target_observed", settlement: "observed_only", note: "Current mark is at/below target; earlier path is not established by a quote." });
    if (signal.invalidationLevel != null && quote >= signal.invalidationLevel) rows.push({ status: "stop_observed", settlement: "observed_only", note: "Current mark is at/above invalidation; earlier path is not established by a quote." });
    if (quote < signal.entryPrice * 0.97) rows.push({ status: "entry_no_longer_eligible", settlement: "observed_only", note: "Current mark is more than 3% below the frozen reference entry; the issued entry remains unchanged." });
  }
  return rows;
}

// --- NYSE session calendar -------------------------------------------------
// A daily bar is evidence about a session, not about the calendar date it is
// stamped with. A bar for session D is only *completed* once the series that
// carries it was captured after D's closing bell plus a publication delay.
// Judging completion at read time instead of capture time is what let a
// partial intraday bar (fetched at 10:00, read at 16:30) pass as completed.

export const BAR_PUBLICATION_DELAY_MINUTES = 15;

function dateParts(date: string): { year: number; month: number; day: number } {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month, day };
}
function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function addDays(date: string, days: number): string {
  const { year, month, day } = dateParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return formatDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}
function weekdayOf(date: string): number {
  const { year, month, day } = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const firstWeekday = weekdayOf(formatDate(year, month, 1));
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return formatDate(year, month, day);
}
function lastWeekday(year: number, month: number, weekday: number): string {
  const { day: lastDay } = dateParts(addDays(formatDate(year, month + 1, 1), -1));
  const lastWeekdayValue = weekdayOf(formatDate(year, month, lastDay));
  return formatDate(year, month, lastDay - ((lastWeekdayValue - weekday + 7) % 7));
}
function goodFriday(year: number): string {
  // Anonymous Gregorian computus for Easter Sunday; Good Friday is two days prior.
  const a = year % 19; const b = Math.floor(year / 100); const c = year % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); const day = ((h + l - 7 * m + 114) % 31) + 1;
  return addDays(formatDate(year, month, day), -2);
}
function observedHoliday(year: number, month: number, day: number): string {
  const date = formatDate(year, month, day); const weekday = weekdayOf(date);
  if (weekday === 6) return addDays(date, -1);
  if (weekday === 0) return addDays(date, 1);
  return date;
}

export function nyseHolidayDates(year: number): Set<string> {
  return new Set([
    observedHoliday(year, 1, 1),
    nthWeekday(year, 1, 1, 3), // Martin Luther King Jr. Day: third Monday of January
    nthWeekday(year, 2, 1, 3), // Washington's Birthday: third Monday of February
    goodFriday(year),
    lastWeekday(year, 5, 1), // Memorial Day: last Monday of May
    observedHoliday(year, 6, 19), // Juneteenth
    observedHoliday(year, 7, 4), // Independence Day
    nthWeekday(year, 9, 1, 1), // Labor Day: first Monday of September
    nthWeekday(year, 11, 4, 4), // Thanksgiving: fourth Thursday of November
    observedHoliday(year, 12, 25), // Christmas
  ]);
}

export function isNyseTradingDay(date: string): boolean {
  const weekday = weekdayOf(date);
  if (weekday === 0 || weekday === 6) return false;
  return !nyseHolidayDates(dateParts(date).year).has(date);
}

export function isNyseEarlyClose(date: string): boolean {
  if (!isNyseTradingDay(date)) return false;
  const { year, month, day } = dateParts(date);
  if (month === 11 && date === addDays(nthWeekday(year, 11, 4, 4), 1)) return true; // day after Thanksgiving
  if (month === 12 && day === 24) return true; // Christmas Eve
  if (month === 7 && day === 3) return true; // day before Independence Day
  if (month === 7 && day === 2) { const july4Weekday = weekdayOf(formatDate(year, 7, 4)); if (july4Weekday === 0 || july4Weekday === 6) return true; } // Jul 4 on a weekend: early close Thursday Jul 2
  return false;
}

export function nyseSessionCloseUtcIso(date: string): string {
  const hour = isNyseEarlyClose(date) ? 13 : 16;
  const probe = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = zone.match(/GMT([+-]\d+)(?::(\d+))?/);
  const offsetMinutes = match ? Number(match[1]) * 60 + Number(match[2] ?? 0) * Math.sign(Number(match[1])) : -300;
  return new Date(probe.getTime() - offsetMinutes * 60_000).toISOString();
}

export function sessionBarPublishedAtIso(date: string): string {
  return new Date(Date.parse(nyseSessionCloseUtcIso(date)) + BAR_PUBLICATION_DELAY_MINUTES * 60_000).toISOString();
}

export function newYorkDateOf(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((row) => row.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** True only when the session's closing bell + publication delay had already
 *  passed at the instant the carrying series was captured. A bar read later
 *  never becomes completed retroactively. */
export function isSessionBarCompleted(barDate: string, capturedAtIso: string): boolean {
  const captured = Date.parse(capturedAtIso);
  if (!Number.isFinite(captured)) return false;
  if (!isNyseTradingDay(barDate)) return false;
  return captured >= Date.parse(sessionBarPublishedAtIso(barDate));
}

export function latestCompletedSessionDate(nowIso: string): string {
  let date = newYorkDateOf(nowIso);
  for (let step = 0; step < 15; step++) {
    if (isNyseTradingDay(date) && Date.parse(nowIso) >= Date.parse(sessionBarPublishedAtIso(date))) return date;
    date = addDays(date, -1);
  }
  return date;
}

export type SeriesCoverage = {
  newestBarDate: string | null;
  newestCompletedBarDate: string | null;
  formingBarDate: string | null;
  latestCompletedSessionDate: string;
  coversLatestCompletedSession: boolean;
};

export function seriesCoverage(points: Array<{ date: string }>, capturedAtIso: string, nowIso: string): SeriesCoverage {
  const dates = points.map((point) => point.date).sort();
  const newestBarDate = dates.at(-1) ?? null;
  const completed = dates.filter((date) => isSessionBarCompleted(date, capturedAtIso));
  const newestCompletedBarDate = completed.at(-1) ?? null;
  const latest = latestCompletedSessionDate(nowIso);
  return {
    newestBarDate,
    newestCompletedBarDate,
    formingBarDate: newestBarDate != null && newestBarDate !== newestCompletedBarDate ? newestBarDate : null,
    latestCompletedSessionDate: latest,
    coversLatestCompletedSession: newestCompletedBarDate != null && newestCompletedBarDate >= latest,
  };
}

export function requestBudget(activeInstruments: number, cadenceMinutes = MARKET_REFRESH_CONFIG.cadenceMinutes) {
  const bounded = Math.max(0, Math.min(MARKET_REFRESH_CONFIG.maxSymbolsPerRun, Math.floor(activeInstruments)));
  const runsPerDay = Math.floor(24 * 60 / Math.max(1, cadenceMinutes));
  const dailyRequests = bounded * runsPerDay * MARKET_REFRESH_CONFIG.requestsPerSymbol;
  return { activeInstruments: bounded, cadenceMinutes, runsPerDay, requestsPerRun: bounded, dailyRequests, monthlyRequests30d: dailyRequests * 30 };
}
