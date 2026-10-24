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

export function requestBudget(activeInstruments: number, cadenceMinutes = MARKET_REFRESH_CONFIG.cadenceMinutes) {
  const bounded = Math.max(0, Math.min(MARKET_REFRESH_CONFIG.maxSymbolsPerRun, Math.floor(activeInstruments)));
  const runsPerDay = Math.floor(24 * 60 / Math.max(1, cadenceMinutes));
  const dailyRequests = bounded * runsPerDay * MARKET_REFRESH_CONFIG.requestsPerSymbol;
  return { activeInstruments: bounded, cadenceMinutes, runsPerDay, requestsPerRun: bounded, dailyRequests, monthlyRequests30d: dailyRequests * 30 };
}
