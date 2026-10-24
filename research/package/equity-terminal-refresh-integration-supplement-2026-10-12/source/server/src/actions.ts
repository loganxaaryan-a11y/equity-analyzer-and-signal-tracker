import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import * as schema from "./schema";
import { acceptedEvaluationRevisions, acceptedEvaluationRevisionsForCohort, assessDirectionalEvidence, deterministicReplaySnapshot, evaluateEquityDirectionForecast, evaluateEquityTradeSetup, reconstructAndValidateEquityCandidate, xnysSessionBounds, type DailyEvidenceBar, type EquityEvaluation, type FrozenEvaluationSignal } from "./measurement";
import { MARKET_REFRESH_CONFIG, candleState, classifyFreshness, currentFreshness, marketKindForSymbol, observationIdentity, planSignalStatus, requestBudget, signalObservationEligibility, type ObservationKind } from "./freshness";

type Point = { date: string; close: number; open: number | null; high: number | null; low: number | null; volume: number | null };
type ChartPoint = Point & { sma20: number | null; sma50: number | null; sma200Proxy: number | null };

const commodityAliases: Record<string, { name: string; future: string; proxy: string; why: string }> = {
  gold: { name: "Gold", future: "GC=F", proxy: "GLD", why: "COMEX Gold futures; GLD is a separate ETF alternative, never an automatic substitution." },
  xau: { name: "Gold", future: "GC=F", proxy: "GLD", why: "COMEX Gold futures; GLD is a separate ETF alternative, never an automatic substitution." },
  silver: { name: "Silver", future: "SI=F", proxy: "SLV", why: "COMEX Silver futures; SLV is a separate ETF alternative, never an automatic substitution." },
  xag: { name: "Silver", future: "SI=F", proxy: "SLV", why: "COMEX Silver futures; SLV is a separate ETF alternative, never an automatic substitution." },
  si: { name: "Silver", future: "SI=F", proxy: "SLV", why: "COMEX Silver futures; SLV is a separate ETF alternative, never an automatic substitution." },
  platinum: { name: "Platinum", future: "PL=F", proxy: "PPLT", why: "NYMEX Platinum futures; PPLT is a separate ETF alternative, never an automatic substitution." },
  xpt: { name: "Platinum", future: "PL=F", proxy: "PPLT", why: "NYMEX Platinum futures; PPLT is a separate ETF alternative, never an automatic substitution." },
  copper: { name: "Copper", future: "HG=F", proxy: "CPER", why: "COMEX High Grade Copper futures; CPER is a separate ETF alternative, never an automatic substitution." },
  hg: { name: "Copper", future: "HG=F", proxy: "CPER", why: "COMEX High Grade Copper futures; CPER is a separate ETF alternative, never an automatic substitution." },
  oil: { name: "WTI Crude Oil", future: "CL=F", proxy: "USO", why: "NYMEX WTI Crude futures; USO is a separate ETF alternative, never an automatic substitution." },
  crude: { name: "WTI Crude Oil", future: "CL=F", proxy: "USO", why: "NYMEX WTI Crude futures; USO is a separate ETF alternative, never an automatic substitution." },
  wti: { name: "WTI Crude Oil", future: "CL=F", proxy: "USO", why: "NYMEX WTI Crude futures; USO is a separate ETF alternative, never an automatic substitution." },
  brent: { name: "Brent Crude Oil", future: "BZ=F", proxy: "BNO", why: "ICE Brent Crude futures; BNO is a separate ETF alternative, never an automatic substitution." },
  bz: { name: "Brent Crude Oil", future: "BZ=F", proxy: "BNO", why: "ICE Brent Crude futures; BNO is a separate ETF alternative, never an automatic substitution." },
  naturalgas: { name: "Natural Gas", future: "NG=F", proxy: "UNG", why: "NYMEX Natural Gas futures; UNG is a separate ETF alternative, never an automatic substitution." },
  natgas: { name: "Natural Gas", future: "NG=F", proxy: "UNG", why: "NYMEX Natural Gas futures; UNG is a separate ETF alternative, never an automatic substitution." },
  gas: { name: "Natural Gas", future: "NG=F", proxy: "UNG", why: "NYMEX Natural Gas futures; UNG is a separate ETF alternative, never an automatic substitution." },
  ng: { name: "Natural Gas", future: "NG=F", proxy: "UNG", why: "NYMEX Natural Gas futures; UNG is a separate ETF alternative, never an automatic substitution." },
  wheat: { name: "Wheat", future: "ZW=F", proxy: "WEAT", why: "CBOT Wheat futures; WEAT is a separate ETF alternative, never an automatic substitution." },
  zw: { name: "Wheat", future: "ZW=F", proxy: "WEAT", why: "CBOT Wheat futures; WEAT is a separate ETF alternative, never an automatic substitution." },
  corn: { name: "Corn", future: "ZC=F", proxy: "CORN", why: "CBOT Corn futures; CORN is a separate ETF alternative, never an automatic substitution." },
  zc: { name: "Corn", future: "ZC=F", proxy: "CORN", why: "CBOT Corn futures; CORN is a separate ETF alternative, never an automatic substitution." },
  coffee: { name: "Coffee", future: "KC=F", proxy: "JO", why: "ICE Coffee C futures; JO is a separate ETN alternative, never an automatic substitution." },
  kc: { name: "Coffee", future: "KC=F", proxy: "JO", why: "ICE Coffee C futures; JO is a separate ETN alternative, never an automatic substitution." },
};

const privateCompanies: Record<string, { name: string; description: string; exposures: Array<{ ticker: string; why: string }> }> = {
  openai: { name: "OpenAI", description: "Private AI research and product company.", exposures: [{ ticker: "MSFT", why: "Strategic investor and major cloud partner." }, { ticker: "NVDA", why: "AI-compute supplier exposure, not ownership." }] },
  anthropic: { name: "Anthropic", description: "Private AI model developer.", exposures: [{ ticker: "AMZN", why: "Strategic investor and primary cloud partner." }, { ticker: "GOOGL", why: "Strategic investor and cloud partner." }] },
  stripe: { name: "Stripe", description: "Private payments infrastructure company.", exposures: [{ ticker: "V", why: "Public payments-network exposure; not Stripe ownership." }, { ticker: "ADYEN.AS", why: "Public payments-platform peer." }] },
  bytedance: { name: "ByteDance", description: "Private consumer internet and AI company, parent of TikTok.", exposures: [{ ticker: "META", why: "Public social-advertising peer, not ownership." }, { ticker: "TCEHY", why: "Public China internet and social-media peer." }] },
  spacex: { name: "SpaceX", description: "Private launch, satellite, and communications company.", exposures: [{ ticker: "RKLB", why: "Public launch-and-space-systems peer; not SpaceX ownership." }, { ticker: "LMT", why: "Public aerospace and defense exposure." }] },
  databricks: { name: "Databricks", description: "Private data and AI infrastructure company.", exposures: [{ ticker: "MSFT", why: "Cloud/data platform exposure and strategic ecosystem relationship." }, { ticker: "SNOW", why: "Closest large public data-platform peer." }] },
  revolut: { name: "Revolut", description: "Private digital banking and fintech company.", exposures: [{ ticker: "NU", why: "Public digital-bank peer." }, { ticker: "SOFI", why: "Public fintech and digital-bank peer." }] },
  perplexity: { name: "Perplexity AI", description: "Private AI search company.", exposures: [{ ticker: "GOOGL", why: "Public search and AI peer; not ownership." }, { ticker: "MSFT", why: "Public AI-search and cloud exposure." }] },
};

const pointSchema = z.object({ date: z.string(), close: z.number(), open: z.number().nullable(), high: z.number().nullable(), low: z.number().nullable(), volume: z.number().nullable(), sma20: z.number().nullable(), sma50: z.number().nullable(), sma200Proxy: z.number().nullable() });
const sourceSchema = z.object({ title: z.string(), url: z.string() });
const metricSchema = z.object({ label: z.string(), value: z.number().nullable(), unit: z.string() });
const polymarketHintMarketSchema = z.object({
  question: z.string(), yesImpliedCrowdPrice: z.number(), noImpliedCrowdPrice: z.number(), volume24hr: z.number(), liquidity: z.number(), openInterest: z.number().nullable(), slug: z.string(), marketUrl: z.string(), asOf: z.string(),
});
const polymarketHintResponse = z.object({ state: z.enum(["available", "no_data"]), query: z.string(), label: z.string(), market: polymarketHintMarketSchema.nullable(), reason: z.string().nullable() });
const crowdMarketOptionSchema = polymarketHintMarketSchema.extend({ eventTitle: z.string().nullable(), eventEndDate: z.string().nullable() });
const crowdMarketSearchResponse = z.object({ state: z.enum(["available", "no_data"]), query: z.string(), asOf: z.string(), options: z.array(crowdMarketOptionSchema).max(12), reason: z.string().nullable() });
const crowdMarketResearchResponse = z.object({
  state: z.enum(["available", "withheld", "no_data"]),
  market: crowdMarketOptionSchema.nullable(),
  crowdProbability: z.number().nullable(),
  researchedProbability: z.number().nullable(),
  edgePoints: z.number().nullable(),
  sampleSize: z.number(),
  instrument: z.object({ symbol: z.string(), price: z.number(), asOf: z.string().nullable() }).nullable(),
  factorAgreement: z.object({ score: z.number(), direction: z.enum(["long", "short", "mixed"]), band: z.string() }).nullable(),
  basis: z.string(), reason: z.string().nullable(),
});
const crowdPricingPanelSchema = z.object({ state: z.enum(["available", "no_data"]), label: z.string(), asOf: z.string().nullable(), reason: z.string().nullable(), fedDecision: z.array(polymarketHintMarketSchema), macroContext: z.array(polymarketHintMarketSchema).max(2), sentiment: z.object({ value: z.number(), classification: z.string(), asOf: z.string(), sourceUrl: z.string(), note: z.string() }).nullable() });
const analyzeResponse = z.object({
  status: z.enum(["ok", "private", "error"]), error: z.string().nullable(),
  privateCompany: z.object({ name: z.string(), description: z.string(), fundingStatus: z.string(), exposures: z.array(z.object({ ticker: z.string(), why: z.string() })), sources: z.array(sourceSchema) }).nullable(),
  commodity: z.object({ name: z.string(), future: z.string(), proxy: z.string(), why: z.string() }).nullable(),
  instrument: z.object({ name: z.string(), symbol: z.string(), summary: z.string(), price: z.number().nullable(), currency: z.string().nullable(), change: z.number().nullable(), changePercent: z.number().nullable(), marketCap: z.number().nullable(), asOf: z.string().nullable(), marketStatus: z.string().nullable(), barTimestamp: z.string(), barState: z.enum(["closed", "forming"]), quotePriceSource: z.enum(["regularMarketPrice", "dailyBar"]), resolvedFrom: z.string().nullable(), resolutionMethod: z.enum(["direct", "symbol_search", "commodity_alias"]), sources: z.array(sourceSchema) }).nullable(),
  chart: z.array(pointSchema), weekly: z.array(z.object({ date: z.string(), close: z.number() })),
  events: z.array(z.object({ date: z.string(), type: z.enum(["Dividend", "Split"]), label: z.string() })),
  returns: z.array(metricSchema), indicators: z.array(metricSchema),
  pattern: z.array(z.object({ horizon: z.string(), read: z.string(), value: z.number().nullable() })),
  factorModel: z.object({ score: z.number(), rawScore: z.number(), redundancyAdjustment: z.number(), freshness: z.string(), direction: z.enum(["long", "short", "mixed"]), label: z.string(), formula: z.string(), disclaimer: z.string(), factors: z.array(z.object({ name: z.string(), weight: z.number(), score: z.union([z.literal(-1), z.literal(0), z.literal(1)]), contribution: z.number(), reading: z.string(), quality: z.enum(["GOOD", "NO_DATA", "STALE", "ANOMALY"]), asOf: z.string(), source: z.string(), qualityReason: z.string() })) }).nullable(),
  walkForward: z.object({
    observations: z.number(), qualified: z.boolean(), hitRate: z.number().nullable(), averageDirectionalReturn: z.number().nullable(), cadence: z.string(), note: z.string(),
    decisionRule: z.string(), dataWindow: z.object({ fixedStart: z.string(), firstUsableDate: z.string().nullable(), lastSourceDate: z.string().nullable(), sourceSessions: z.number(), fingerprint: z.string() }),
    decisions: z.array(z.object({ decisionAt: z.string(), outcomeAt: z.string(), score: z.number(), direction: z.enum(["long", "short"]), entryClose: z.number(), outcomeClose: z.number(), directionalReturnPct: z.number() })),
  }).nullable(),
  thesis: z.string().nullable(), failure: z.string().nullable(),
  levels: z.object({ entryLow: z.number(), entryHigh: z.number(), invalidation: z.number(), target1: z.number(), target2: z.number(), direction: z.enum(["long", "short"]), atr14: z.number(), invalidationAtrMultiple: z.number(), invalidationBasis: z.string() }).nullable(),
  smartMoney: z.array(z.object({ label: z.string(), value: z.string(), tone: z.enum(["positive", "negative", "neutral"]), detail: z.string() })),
  secFilings: z.object({ state: z.enum(["available", "no_data"]), note: z.string(), asOf: z.string().nullable(), items: z.array(z.object({ form: z.string(), filedDate: z.string(), acceptedDate: z.string().nullable(), accession: z.string(), url: z.string(), source: z.string() })).max(8) }),
  earningsCalendar: z.object({ state: z.enum(["available", "no_data"]), note: z.string(), asOf: z.string().nullable(), events: z.array(z.object({ symbol: z.string(), date: z.string(), epsEstimate: z.number().nullable(), epsActual: z.number().nullable(), revenueEstimate: z.number().nullable(), revenueActual: z.number().nullable(), quarter: z.number().nullable(), source: z.literal("Finnhub") })).max(8) }),
  crowdPricing: crowdPricingPanelSchema,
  valuation: z.lazy(() => stockValuationResponse).nullable(),
  sectionVerdicts: z.object({
    chart: z.object({ verdict: z.string(), supportingFigures: z.array(z.string()).max(6), interpretedLine: z.string() }),
    valuation: z.object({ verdict: z.string(), supportingFigures: z.array(z.string()).max(6), interpretedLine: z.string() }),
    smartMoney: z.object({ verdict: z.string(), supportingFigures: z.array(z.string()).max(6), interpretedLine: z.string() }),
    crowd: z.object({ verdict: z.string(), supportingFigures: z.array(z.string()).max(6), interpretedLine: z.string() }),
  }).nullable(),
  synthesis: z.object({ verdict: z.enum(["aligned_long", "aligned_short", "contested", "mixed"]), conclusion: z.string(), invalidation: z.string() }).nullable(),
});

function cleanKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function finite(value: number | null | undefined): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function average(values: number[]): number | null { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function sma(points: Point[], period: number, index: number): number | null {
  if (index + 1 < period) return null;
  return average(points.slice(index + 1 - period, index + 1).map((p) => p.close));
}
function pct(current: number, previous: number | undefined): number | null { return previous && previous !== 0 ? ((current / previous) - 1) * 100 : null; }
function round(value: number, places = 2) { const f = 10 ** places; return Math.round(value * f) / f; }
function rsi(points: Point[], period = 14): number | null {
  if (points.length <= period) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const previous = points[i - 1]; const current = points[i]; if (!previous || !current) return null;
    const delta = current.close - previous.close; avgGain += Math.max(delta, 0); avgLoss += Math.max(-delta, 0);
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < points.length; i++) {
    const previous = points[i - 1]; const current = points[i]; if (!previous || !current) continue;
    const delta = current.close - previous.close;
    avgGain = ((avgGain * (period - 1)) + Math.max(delta, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-delta, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}
function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const seed = average(values.slice(0, period)); if (seed === null) return null;
  const k = 2 / (period + 1); let out = seed;
  for (const v of values.slice(period)) out = v * k + out * (1 - k);
  return out;
}
function calendarWeekKey(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(parsed.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((parsed.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${parsed.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function factorScoreBreakdown(factors: SignalFactor[]) {
  const normalized = normalizeSignalFactors(factors);
  const totalWeight = normalized.reduce((sum, factor) => sum + factor.weight, 0);
  if (!(totalWeight > 0)) return null;
  const rawScore = Math.round(100 * normalized.reduce((sum, factor) => sum + factor.weight * factor.score, 0) / totalWeight);
  const trendNames = new Set(["Price vs SMA 20", "Price vs SMA 50", "Price vs SMA 200", "MACD 12–26", "ATR-adjusted 30-session trend"]);
  // Historical tracker rows stored the fifth trend factor as “30-session return”.
  // Treat that legacy label as the ATR-adjusted slot so persisted signals receive
  // the same toward-zero redundancy adjustment as newly analyzed dossiers.
  const trend = normalized
    .map((factor) => ({ ...factor, name: factor.name === "30-session return" ? "ATR-adjusted 30-session trend" : factor.name }))
    .filter((factor) => trendNames.has(factor.name))
    .map((factor) => factor.score);
  const redundancyAdjustment = trend.length === trendNames.size && trend.every((score) => score === 1) ? -5 : trend.length === trendNames.size && trend.every((score) => score === -1) ? 5 : 0;
  return { rawScore, redundancyAdjustment, score: rawScore + redundancyAdjustment };
}
function walkForwardFactorBacktest(points: Point[], decisionLimit = 20) {
  const fixedStart = "2005-01-03";
  const source = points.filter((point) => point.date >= fixedStart);
  const decisions: Array<{ decisionAt: string; outcomeAt: string; score: number; direction: "long" | "short"; entryClose: number; outcomeClose: number; directionalReturnPct: number }> = [];
  for (let index = 220; index < source.length - 30; index++) {
    const current = source[index]; const next = source[index + 1]; const future = source[index + 30];
    if (!current || !future) continue;
    // One decision per completed calendar week. Calendar anchoring replaces the old
    // index += 7 grid, whose sample count shifted when the provider revised history rows.
    if (next && calendarWeekKey(next.date) === calendarWeekKey(current.date)) continue;
    const history = source.slice(0, index + 1); const previous = history[history.length - 2];
    const closes = history.map((point) => point.close); const volumes = history.map((point) => point.volume).filter((value): value is number => value != null);
    const mean20 = average(closes.slice(-20)); const mean50 = average(closes.slice(-50)); const mean200 = average(closes.slice(-200));
    const return30 = pct(current.close, history[history.length - 31]?.close); const currentRsi = rsi(history); const fast = ema(closes, 12); const slow = ema(closes, 26); const volumeZ = zScore(volumes.slice(-20));
    const historicalAtr = atr(history); const riskAdjustedReturn = return30 == null || historicalAtr == null || current.close <= 0 ? null : return30 / Math.max(0.01, historicalAtr / current.close * 100 * Math.sqrt(30));
    const factors: SignalFactor[] = [
      { name: "Price vs SMA 20", weight: 6, score: mean20 == null ? 0 : current.close > mean20 ? 1 : -1, contribution: 0, reading: "" },
      { name: "Price vs SMA 50", weight: 8, score: mean50 == null ? 0 : current.close > mean50 ? 1 : -1, contribution: 0, reading: "" },
      { name: "Price vs SMA 200", weight: 8, score: mean200 == null ? 0 : current.close > mean200 ? 1 : -1, contribution: 0, reading: "" },
      { name: "Wilder RSI 14", weight: 20, score: currentRsi == null ? 0 : currentRsi >= 55 && currentRsi <= 75 ? 1 : currentRsi <= 45 && currentRsi >= 25 ? -1 : 0, contribution: 0, reading: "" },
      { name: "MACD 12–26", weight: 8, score: fast == null || slow == null || Math.abs(fast - slow) < 0.000001 ? 0 : fast > slow ? 1 : -1, contribution: 0, reading: "" },
      { name: "High-volume direction", weight: 20, score: volumeZ == null || volumeZ <= 1 ? 0 : current.close > (previous?.close ?? current.close) ? 1 : current.close < (previous?.close ?? current.close) ? -1 : 0, contribution: 0, reading: "" },
      { name: "ATR-adjusted 30-session trend", weight: 20, score: riskAdjustedReturn == null || Math.abs(riskAdjustedReturn) < 0.5 ? 0 : riskAdjustedReturn > 0 ? 1 : -1, contribution: 0, reading: "" },
    ];
    const scoring = factorScoreBreakdown(factors); if (!scoring) continue;
    const decision = signalDecision(scoring.score); if (decision === "mixed") continue;
    const direction = decision;
    const directionalReturnPct = (future.close / current.close - 1) * 100 * (direction === "long" ? 1 : -1);
    decisions.push({ decisionAt: current.date, outcomeAt: future.date, score: scoring.score, direction, entryClose: round(current.close, 4), outcomeClose: round(future.close, 4), directionalReturnPct: round(directionalReturnPct) });
  }
  const observations = decisions.length; const wins = decisions.filter((row) => row.directionalReturnPct > 0).length; const meanDirectionalReturn = average(decisions.map((row) => row.directionalReturnPct));
  const firstUsableDate = source[0]?.date ?? null; const lastSourceDate = source.at(-1)?.date ?? null;
  const fingerprint = `${fixedStart}|${firstUsableDate ?? "none"}|${lastSourceDate ?? "none"}|${source.length}`;
  const evidenceAssessment = assessDirectionalEvidence(decisions.map((row) => row.directionalReturnPct));
  const clearsBasicEconomics = evidenceAssessment.positiveEconomics;
  return { observations, qualified: evidenceAssessment.qualified, hitRate: observations ? round(wins / observations * 100) : null, averageDirectionalReturn: meanDirectionalReturn == null ? null : round(meanDirectionalReturn), cadence: "Last available session of each completed calendar week; outcome exactly 30 trading sessions later", note: observations >= 20 ? (clearsBasicEconomics ? "Sample and positive mean directional return checkpoint met. This is still a direction-forecast diagnostic, not edge validation or trade-setup validation." : "Sample checkpoint met but mean directional return is not positive; sample size alone never certifies an edge.") : "Walk-forward evidence withheld until 20 deterministic replay observations exist. This is a direction forecast, not a target/stop setup test.", decisionRule: "At each displayed decision timestamp, factors use only bars at or before that close. The outcome uses the close exactly 30 later trading sessions; no intermediate or future bar enters the decision score.", dataWindow: { fixedStart, firstUsableDate, lastSourceDate, sourceSessions: source.length, fingerprint }, decisions: decisionLimit > 0 ? decisions.slice(-decisionLimit) : decisions };
}
const SIGNAL_INVALIDATION_ATR_MULTIPLE = 2;
const SIGNAL_INVALIDATION_METHOD = "2.00× Wilder ATR-14 from the reference entry";
function atr(points: Point[], period = 14): number | null {
  const trs: number[] = [];
  for (let i = 1; i < points.length; i++) { const previous = points[i - 1], current = points[i]; if (!previous || !current || current.high == null || current.low == null) continue; trs.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close))); }
  if (trs.length < period) return null;
  let value = average(trs.slice(0, period)); if (value === null) return null;
  for (const tr of trs.slice(period)) value = ((value * (period - 1)) + tr) / period;
  return value;
}
function zScore(values: number[]): number | null {
  if (values.length < 10) return null; const mean = average(values); if (mean === null) return null;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length); return sd ? (values[values.length - 1]! - mean) / sd : 0;
}
function obv(points: Point[]): number | null { let total = 0; let used = false; for (let i = 1; i < points.length; i++) { const p = points[i - 1], c = points[i]; if (!p || !c || c.volume == null) continue; used = true; total += c.close > p.close ? c.volume : c.close < p.close ? -c.volume : 0; } return used ? total : null; }

type YahooMeta = { currency?: string; symbol?: string; exchangeName?: string; fullExchangeName?: string; instrumentType?: string; regularMarketTime?: number; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; shortName?: string; longName?: string };
type YahooEvent = { date?: number; amount?: number; splitRatio?: string; numerator?: number; denominator?: number };
type YahooChart = { chart?: { result?: Array<{ meta?: YahooMeta; timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }>; adjclose?: Array<{ adjclose?: Array<number | null> }> }; events?: { dividends?: Record<string, YahooEvent>; splits?: Record<string, YahooEvent> } }>; error?: { code?: string; description?: string } | null } };
type YahooSearchQuote = { symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchange?: string; exchDisp?: string; isYahooFinance?: boolean; region?: string };
type YahooSearch = { quotes?: YahooSearchQuote[] };
const instrumentSuggestionSchema = z.object({ symbol: z.string(), name: z.string(), exchange: z.string(), country: z.string(), quoteType: z.string() });
const instrumentSearchResponse = z.object({ query: z.string(), suggestions: z.array(instrumentSuggestionSchema).max(8), source: z.literal("Yahoo Finance symbol search"), note: z.string().nullable() });
const exchangeCountries: Record<string, string> = {
  NMS: "United States", NGM: "United States", NCM: "United States", NYQ: "United States", ASE: "United States", PCX: "United States", BTS: "United States",
  TOR: "Canada", VAN: "Canada", CNQ: "Canada", NEO: "Canada", NSE: "India", BSE: "India", LSE: "United Kingdom", LON: "United Kingdom",
  GER: "Germany", FRA: "Germany", PAR: "France", AMS: "Netherlands", SWX: "Switzerland", HKG: "Hong Kong", JPX: "Japan", ASX: "Australia",
};
function yahooCountry(quote: YahooSearchQuote): string {
  const region = quote.region?.trim(); if (region) return region.toUpperCase() === "US" ? "United States" : region.toUpperCase() === "CA" ? "Canada" : region.toUpperCase() === "IN" ? "India" : region;
  const exchange = quote.exchange?.toUpperCase() ?? ""; if (exchangeCountries[exchange]) return exchangeCountries[exchange];
  const symbol = quote.symbol?.toUpperCase() ?? ""; if (symbol.endsWith(".TO") || symbol.endsWith(".V") || symbol.endsWith(".CN")) return "Canada"; if (symbol.endsWith(".NS") || symbol.endsWith(".BO")) return "India";
  return "Country unavailable";
}
type YahooSeries = { meta: YahooMeta; points: Point[]; weekly: Array<{ date: string; close: number }>; events: Array<{ date: string; type: "Dividend" | "Split"; label: string }>; sourceUrl: string };
function isoDate(seconds: number) { return new Date(seconds * 1000).toISOString().slice(0, 10); }
function weeklyFrom(points: Point[]) { const out: Array<{ date: string; close: number }> = []; for (let i = 0; i < points.length; i += 5) { const chunk = points.slice(i, i + 5); const last = chunk[chunk.length - 1]; if (last) out.push({ date: last.date, close: last.close }); } return out; }
function downsample<T>(rows: T[], maxPoints: number): T[] { if (rows.length <= maxPoints) return rows; const picked: T[] = []; const seen = new Set<number>(); for (let i = 0; i < maxPoints; i++) { const index = Math.round(i * (rows.length - 1) / (maxPoints - 1)); const row = rows[index]; if (row !== undefined && !seen.has(index)) { seen.add(index); picked.push(row); } } return picked; }
async function fetchYahooSearch(query: string): Promise<{ searchUrl: string; candidates: YahooSearchQuote[] } | null> {
  const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true`;
  let response: Response;
  try { response = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0 Muse Equity Analyzer" } }); }
  catch { return null; }
  if (!response.ok) return null;
  const payload = await response.json() as YahooSearch;
  const supported = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX", "FUTURE"]);
  return { searchUrl, candidates: (payload.quotes ?? []).filter((quote) => {
    const symbol = quote.symbol?.trim();
    return !!symbol && (!quote.quoteType || supported.has(quote.quoteType.toUpperCase()));
  }) };
}
async function searchYahooInstruments(query: string): Promise<z.infer<typeof instrumentSearchResponse>> {
  const found = await fetchYahooSearch(query);
  if (!found) return { query, suggestions: [], source: "Yahoo Finance symbol search", note: "Yahoo Finance search is unavailable right now." };
  const key = cleanKey(query);
  const score = (quote: YahooSearchQuote) => { const symbol = quote.symbol?.trim() ?? ""; const name = quote.longname ?? quote.shortname ?? ""; if (cleanKey(symbol) === key) return 0; if (cleanKey(name) === key) return 1; if (cleanKey(name).startsWith(key)) return 2; return 3; };
  const suggestions = [...found.candidates].sort((a, b) => score(a) - score(b)).slice(0, 8).flatMap((quote) => { const symbol = quote.symbol?.trim(); if (!symbol) return []; return [{ symbol, name: quote.longname ?? quote.shortname ?? symbol, exchange: quote.exchDisp ?? quote.exchange ?? "Exchange unavailable", country: yahooCountry(quote), quoteType: quote.quoteType ?? "Listed instrument" }]; });
  return { query, suggestions, source: "Yahoo Finance symbol search", note: suggestions.length ? null : `No listed instrument matched “${query}”.` };
}
type YahooLane = "interactive" | "background";
const yahooLaneQueues: Record<YahooLane, Promise<void>> = { interactive: Promise.resolve(), background: Promise.resolve() };
let yahooGlobalQueue: Promise<void> = Promise.resolve();
let lastYahooRequestAt = 0;
function sleep(ms: number) { return new Promise<void>((resolve) => setTimeout(resolve, ms)); }
async function pacedYahooFetch(url: string, lane: YahooLane = "interactive"): Promise<Response> {
  let releaseLane: () => void = () => undefined; const priorLane = yahooLaneQueues[lane];
  yahooLaneQueues[lane] = new Promise<void>((resolve) => { releaseLane = resolve; });
  await priorLane;
  let releaseGlobal: () => void = () => undefined; const priorGlobal = yahooGlobalQueue;
  yahooGlobalQueue = new Promise<void>((resolve) => { releaseGlobal = resolve; });
  await priorGlobal;
  try {
    const wait = Math.max(0, 650 - (Date.now() - lastYahooRequestAt));
    if (wait) await sleep(wait);
    for (let attempt = 0; attempt < 3; attempt++) {
      lastYahooRequestAt = Date.now();
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MuseEquityTerminal/1.0; market-research)" } });
      if (response.status !== 429) return response;
      if (attempt < 2) await sleep(800 * (2 ** attempt));
    }
    throw new Error("Yahoo Finance rate-limited the request after two backoff attempts; this refresh pass was abandoned.");
  } finally { releaseGlobal(); releaseLane(); }
}
async function yahooSeries(symbol: string, range = "2y", lane: YahooLane = "interactive"): Promise<YahooSeries> {
  const sourceUrl = range === "max" ? `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=div%2Csplits` : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&events=div%2Csplits`;
  let response: Response;
  try { response = await pacedYahooFetch(sourceUrl, lane); }
  catch (error) { throw new Error(`Yahoo Finance connection failed for ${symbol}: ${String(error)}`); }
  if (!response.ok) throw new Error(`Yahoo Finance returned HTTP ${response.status} for ${symbol}.`);
  const payload = await response.json() as YahooChart;
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo Finance returned no chart for ${symbol}${payload.chart?.error?.description ? `: ${payload.chart.error.description}` : "."}`);
  const quote = result.indicators?.quote?.[0]; const adjusted = result.indicators?.adjclose?.[0]?.adjclose; const timestamps = result.timestamp ?? [];
  const points: Point[] = timestamps.flatMap((timestamp, index) => {
    const rawClose = finite(quote?.close?.[index]); const adjustedClose = finite(adjusted?.[index]);
    const adjustmentRatio = adjustedClose != null && rawClose != null && rawClose > 0 ? adjustedClose / rawClose : 1;
    const adjustOhlc = (value: number | null | undefined) => { const measured = finite(value); return measured == null ? null : measured * adjustmentRatio; };
    const close = adjustedClose ?? rawClose; const volume = finite(quote?.volume?.[index]);
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0 || (volume != null && volume < 0)) return [];
    return [{ date: isoDate(timestamp), close, open: adjustOhlc(quote?.open?.[index]), high: adjustOhlc(quote?.high?.[index]), low: adjustOhlc(quote?.low?.[index]), volume }];
  });
  if (!points.length) throw new Error(`Yahoo Finance returned no usable OHLCV history for ${symbol}.`);
  const events: YahooSeries["events"] = [];
  for (const event of Object.values(result.events?.dividends ?? {})) if (event.date) events.push({ date: isoDate(event.date), type: "Dividend", label: `Dividend ${event.amount ?? ""}`.trim() });
  for (const event of Object.values(result.events?.splits ?? {})) if (event.date) events.push({ date: isoDate(event.date), type: "Split", label: `Split ${event.splitRatio ?? `${event.numerator ?? "?"}:${event.denominator ?? "?"}`}` });
  return { meta: result.meta ?? {}, points, weekly: weeklyFrom(points), events: events.sort((a, b) => a.date.localeCompare(b.date)), sourceUrl };
}
function parseCachedSeries(value: string, sourceUrl: string): YahooSeries | null {
  try {
    const parsed = z.object({ meta: z.record(z.string(), z.unknown()), points: z.array(z.object({ date: z.string(), close: z.number(), open: z.number().nullable(), high: z.number().nullable(), low: z.number().nullable(), volume: z.number().nullable() })), events: z.array(z.object({ date: z.string(), type: z.enum(["Dividend", "Split"]), label: z.string() })) }).parse(JSON.parse(value));
    const meta = parsed.meta as YahooMeta; return { meta, points: parsed.points, weekly: weeklyFrom(parsed.points), events: parsed.events, sourceUrl };
  } catch { return null; }
}
async function yahooFullHistory(ctx: Ctx, symbol: string, lane: YahooLane = "interactive", forceRefresh = false): Promise<YahooSeries> {
  const normalized = symbol.trim().toUpperCase(); const db = ctx.db<typeof schema>(); const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(schema.historicalCaches).where(eq(schema.historicalCaches.symbol, normalized)); const cached = rows[0];
  // Interactive reads may reuse today's full-history cache. Settlement is different:
  // a pre-market scan can stamp a cache with today's date while its newest completed
  // bar is still yesterday's. The daily horizon writer therefore opts out of this
  // date-only cache gate and asks Yahoo for the latest completed bar before deciding
  // whether a 5D / 14D / 30D observation exists.
  if (!forceRefresh && cached?.fetchedOn === today) { const parsed = parseCachedSeries(cached.seriesJson, cached.sourceUrl); if (parsed) { const first = parsed.points[0], last = parsed.points[parsed.points.length - 1]; const meanGapDays = first && last && parsed.points.length > 1 ? (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / 86400000 / (parsed.points.length - 1) : Infinity; if (meanGapDays < 10) return parsed; } }
  try {
    const fresh = await yahooSeries(normalized, "max", lane);
    const seriesJson = JSON.stringify({ meta: fresh.meta, points: fresh.points, events: fresh.events });
    await db.insert(schema.historicalCaches).values({ symbol: normalized, currency: fresh.meta.currency ?? null, seriesJson, sourceUrl: fresh.sourceUrl, fetchedOn: today, fetchedAt: new Date() }).onConflictDoUpdate({ target: schema.historicalCaches.symbol, set: { currency: fresh.meta.currency ?? null, seriesJson, sourceUrl: fresh.sourceUrl, fetchedOn: today, fetchedAt: new Date() } });
    return fresh;
  } catch (error) {
    if (cached) { const parsed = parseCachedSeries(cached.seriesJson, cached.sourceUrl); if (parsed) return parsed; }
    throw error;
  }
}
async function yahooForRequest(ctx: Ctx, commodity: (typeof commodityAliases)[string] | null, symbol: string) {
  const requested = commodity?.future ?? symbol;
  return { series: await yahooFullHistory(ctx, requested), requested };
}

async function fundingContext(ctx: Ctx, name: string) {
  const result = await ctx.tool.web_search(`${name} latest funding valuation status 2026`);
  const rows = result.content?.results?.filter((r) => !r.is_index_page && r.url).slice(0, 4) ?? [];
  const snippets = rows.map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet}`).join("\n");
  let fundingStatus = "Latest valuation was not established by the available sources.";
  if (snippets) {
    fundingStatus = await ctx.inference.complete(`Summarize the latest funding or valuation status for ${name} in one careful sentence using only these search snippets. If they do not establish it, say it is unavailable.\n${snippets}`, { schema: z.string() });
  }
  return { fundingStatus, sources: rows.map((r) => ({ title: r.title, url: r.url ?? "" })) };
}

type SignalFactor = { name: string; weight: number; score: -1 | 0 | 1; contribution: number; reading: string; quality?: "GOOD" | "NO_DATA" | "STALE" | "ANOMALY"; asOf?: string; source?: string; qualityReason?: string };
function normalizeSignalFactors(factors: SignalFactor[]): SignalFactor[] {
  const hasAtrTrend = factors.some((factor) => factor.name === "ATR-adjusted 30-session trend" || factor.name === "ATR-adjusted follow-through");
  return factors.filter((factor) => Number.isFinite(factor.weight) && factor.weight > 0 && !(hasAtrTrend && factor.name === "30-session return")).map((factor) => ({ ...factor, name: factor.name === "ATR-adjusted follow-through" ? "ATR-adjusted 30-session trend" : factor.name, contribution: factor.weight * factor.score }));
}
const SIGNAL_STRATEGY_ID = "equity-factor-agreement";
const SIGNAL_STRATEGY_VERSION = "3.1.0-measurement-closure";
const SIGNAL_PARAMETER_HASH = "atr2-target1.5R-weights-6-8-8-20-8-20-20";
const SIGNAL_BUILD_ID = "phase1-final-signoff-2026-10-09";
const SIGNAL_EVALUATOR_VERSION = "equity-eval-3.2.0";
const SIGNAL_SCORE_DEFINITION = "Seven deterministic factor votes scored -1/0/+1 with frozen weights 6/8/8/20/8/20/20; fully aligned five-factor trend cluster receives a 5-point toward-zero redundancy adjustment.";
const ACTIVE_COHORT_BASE = `${SIGNAL_STRATEGY_ID}|${SIGNAL_STRATEGY_VERSION}|${SIGNAL_PARAMETER_HASH}`;
const activeCohortKey = (product: "trade_setup" | "direction_forecast") => `${ACTIVE_COHORT_BASE}|${product}|30:trading_sessions|Yahoo adjusted OHLC research reference|Reference entry equals the completed adjusted daily close; paper execution is not claimed|unknown:unknown`;
const activeCohortKeys = new Set([activeCohortKey("trade_setup"), activeCohortKey("direction_forecast")]);
const cohortDescriptor = { strategyId: SIGNAL_STRATEGY_ID, strategyVersion: SIGNAL_STRATEGY_VERSION, parameterHash: SIGNAL_PARAMETER_HASH, evaluatorVersion: SIGNAL_EVALUATOR_VERSION, horizon: 30, horizonUnit: "trading_sessions", priceConvention: "Yahoo adjusted OHLC research reference", costScenario: "unknown" } as const;
type FrozenLevels = { entryPrice: number; stopPrice: number; target1: number; target2: number; riskPerUnit: number; direction: "long" | "short"; atr14: number; invalidationAtrMultiple: number; invalidationBasis: string };
function signalDecision(score: number): "long" | "short" | "mixed" { return score >= 20 ? "long" : score <= -20 ? "short" : "mixed"; }
function buildFrozenLevels(entryPrice: number, atr14: number, direction: "long" | "short"): FrozenLevels | null {
  if (!(entryPrice > 0) || !(atr14 > 0)) return null;
  const stopPrice = direction === "long" ? entryPrice - atr14 * SIGNAL_INVALIDATION_ATR_MULTIPLE : entryPrice + atr14 * SIGNAL_INVALIDATION_ATR_MULTIPLE;
  const riskPerUnit = Math.abs(entryPrice - stopPrice);
  return { entryPrice: round(entryPrice), stopPrice: round(stopPrice), target1: round(entryPrice + (direction === "long" ? 1 : -1) * 1.5 * riskPerUnit), target2: round(entryPrice + (direction === "long" ? 1 : -1) * 2.5 * riskPerUnit), riskPerUnit: round(riskPerUnit, 4), direction, atr14: round(atr14, 4), invalidationAtrMultiple: SIGNAL_INVALIDATION_ATR_MULTIPLE, invalidationBasis: SIGNAL_INVALIDATION_METHOD };
}
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`; return JSON.stringify(value); }
async function contentHash(value: unknown): Promise<string> { const bytes = new TextEncoder().encode(stableJson(value)); const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function factorId(name: string): string { const aliases: Record<string, string> = { "Price vs SMA 20": "price_vs_sma20", "Price vs SMA 50": "price_vs_sma50", "Price vs SMA 200": "price_vs_sma200", "Wilder RSI 14": "rsi14_wilder", "MACD 12–26": "macd_12_26", "High-volume direction": "volume_direction_z", "30-session return": "atr_adjusted_trend30", "ATR-adjusted follow-through": "atr_adjusted_trend30", "ATR-adjusted 30-session trend": "atr_adjusted_trend30" }; return aliases[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function exchangeCalendarFor(symbol: string, meta: YahooMeta): string { const type = meta.instrumentType?.toUpperCase() ?? ""; if (type === "CRYPTOCURRENCY" || /-(?:USD|USDT|EUR|GBP)$/i.test(symbol)) return "24/7"; const exchange = meta.exchangeName?.toUpperCase() ?? ""; return ["NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS"].includes(exchange) || !symbol.includes(".") ? "XNYS" : "UNSUPPORTED"; }
function newYorkCloseIso(date: string): string { const probe = new Date(`${date}T16:00:00.000Z`); const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "GMT-5"; const match = zone.match(/GMT([+-]\d+)(?::(\d+))?/); const offsetMinutes = match ? Number(match[1]) * 60 + Number(match[2] ?? 0) * Math.sign(Number(match[1])) : -300; return new Date(Date.parse(`${date}T16:00:00.000Z`) - offsetMinutes * 60_000).toISOString(); }
type SignalIssuanceReason = string;
type SignalIssuanceDecision = { allowed: boolean; reason: SignalIssuanceReason | null; belowSma50: boolean | null; lowerHighs: boolean | null; trend20Negative: boolean | null };
type ExactIssuanceCheck = { decision: SignalIssuanceDecision; signalDay: Point | null; history: Point[]; sourceUrl: string };
function newYorkClock(now = new Date()): { date: string; minutes: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((row) => row.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")), weekday: part("weekday") };
}
function isCompletedUsDailyBar(date: string, now = new Date()): boolean {
  const clock = newYorkClock(now);
  if (date < clock.date) return true;
  if (date > clock.date || clock.weekday === "Sat" || clock.weekday === "Sun") return false;
  return clock.minutes >= 16 * 60 + 15;
}
function completedDailyPoints(points: Point[], now = new Date()): Point[] { return points.filter((point) => isCompletedUsDailyBar(point.date, now)); }
function latestCompletedSignalDay(points: Point[], now = new Date()): Point | null { return completedDailyPoints(points, now).at(-1) ?? null; }
function recentLowerHighs(points: Point[]): boolean | null {
  const recent = points.slice(-35); if (recent.length < 12) return null;
  const peaks: number[] = [];
  for (let index = 2; index < recent.length - 2; index++) {
    const row = recent[index]; const currentHigh = row?.high; if (currentHigh == null) continue;
    const neighbors = [recent[index - 2]?.high, recent[index - 1]?.high, recent[index + 1]?.high, recent[index + 2]?.high];
    const measuredNeighbors = neighbors.filter((value): value is number => value != null);
    if (measuredNeighbors.length === neighbors.length && measuredNeighbors.every((value) => currentHigh >= value)) peaks.push(currentHigh);
  }
  if (peaks.length >= 2) return (peaks.at(-1) ?? Infinity) < (peaks.at(-2) ?? -Infinity);
  const recentHighs = recent.slice(-5).map((row) => row.high).filter((value): value is number => value != null);
  const priorHighs = recent.slice(-10, -5).map((row) => row.high).filter((value): value is number => value != null);
  return recentHighs.length === 5 && priorHighs.length === 5 ? Math.max(...recentHighs) < Math.max(...priorHighs) : null;
}
function signalIssuanceDecision(direction: "long" | "short", invalidation: number, signalDay: Point | null, history: Point[]): SignalIssuanceDecision {
  if (!signalDay || signalDay.open == null || signalDay.low == null || signalDay.high == null) return { allowed: false, reason: `issuance-check unavailable: exact completed signal-day OHLC was not available for ${signalDay?.date ?? "the requested date"}`, belowSma50: null, lowerHighs: null, trend20Negative: null };
  const breached = direction === "long" ? signalDay.low <= invalidation : signalDay.high >= invalidation;
  if (breached) {
    const reason = direction === "long" ? `born-dead LONG: signal-day low ${round(signalDay.low, 4)} <= invalidation ${round(invalidation, 4)}` : `born-dead SHORT: signal-day high ${round(signalDay.high, 4)} >= invalidation ${round(invalidation, 4)}`;
    return { allowed: false, reason, belowSma50: null, lowerHighs: null, trend20Negative: null };
  }
  if (direction === "long") return { allowed: true, reason: null, belowSma50: null, lowerHighs: null, trend20Negative: null };
  const signalIndex = history.findIndex((row) => row.date === signalDay.date); const throughSignalDay = signalIndex >= 0 ? history.slice(0, signalIndex + 1) : history.filter((row) => row.date <= signalDay.date);
  const mean50 = average(throughSignalDay.slice(-50).map((row) => row.close)); const close20Ago = throughSignalDay.at(-21)?.close;
  const belowSma50 = mean50 == null ? null : signalDay.close < mean50;
  const lowerHighs = recentLowerHighs(throughSignalDay);
  const trend20Negative = close20Ago == null ? null : signalDay.close < close20Ago;
  const bearishStructure = belowSma50 === true && (lowerHighs === true || trend20Negative === true);
  return bearishStructure ? { allowed: true, reason: null, belowSma50, lowerHighs, trend20Negative } : { allowed: false, reason: `short-regime: bearish daily structure gate not met on ${signalDay.date}`, belowSma50, lowerHighs, trend20Negative };
}
async function exactYahooIssuanceEvidence(symbol: string, signalDate: string, lane: YahooLane = "interactive"): Promise<Omit<ExactIssuanceCheck, "decision"> & { error: string | null }> {
  try {
    const series = await yahooSeries(symbol, "1y", lane);
    const history = completedDailyPoints(series.points);
    const signalDay = history.find((point) => point.date === signalDate) ?? null;
    return { signalDay, history, sourceUrl: series.sourceUrl, error: null };
  } catch (error) {
    return { signalDay: null, history: [], sourceUrl: "", error: `issuance-check unavailable: exact Yahoo daily series fetch failed for ${symbol}: ${String(error).replace(/^Error:\s*/, "")}` };
  }
}
async function exactYahooIssuanceCheck(symbol: string, signalDate: string, direction: "long" | "short", invalidation: number, lane: YahooLane = "interactive"): Promise<ExactIssuanceCheck> {
  const evidence = await exactYahooIssuanceEvidence(symbol, signalDate, lane);
  const decision = evidence.error ? { allowed: false, reason: evidence.error, belowSma50: null, lowerHighs: null, trend20Negative: null } : signalIssuanceDecision(direction, invalidation, evidence.signalDay, evidence.history);
  return { decision, signalDay: evidence.signalDay, history: evidence.history, sourceUrl: evidence.sourceUrl };
}
async function logSuppressedCandidate(ctx: Ctx, input: { symbol: string; name: string; setupType: string; direction: "long" | "short"; agreementScore: number; entryPrice: number; invalidation: number; signalDate: string; signalDay: Point | null; reason: SignalIssuanceReason; origin: "tracker" | "discovery"; sourceAsOf: string; sourceUrl: string; decision: SignalIssuanceDecision }) {
  await ctx.db<typeof schema>().insert(schema.suppressedSignalCandidates).values({ symbol: input.symbol, instrumentName: input.name, setupType: input.setupType, direction: input.direction, agreementScore: input.agreementScore, entryPrice: input.entryPrice, invalidationLevel: input.invalidation, signalDate: input.signalDate, signalDayOpen: input.signalDay?.open ?? null, signalDayHigh: input.signalDay?.high ?? null, signalDayLow: input.signalDay?.low ?? null, signalDayClose: input.signalDay?.close ?? null, reason: input.reason, origin: input.origin, sourceAsOf: input.sourceAsOf, sourceUrl: input.sourceUrl, contextJson: JSON.stringify({ belowSma50: input.decision.belowSma50, lowerHighs: input.decision.lowerHighs, trend20Negative: input.decision.trend20Negative }) }).onConflictDoNothing({ target: [schema.suppressedSignalCandidates.symbol, schema.suppressedSignalCandidates.signalDate, schema.suppressedSignalCandidates.reason, schema.suppressedSignalCandidates.origin] });
}
type AcceptedSignalCandidate = { direction: "long" | "short"; score: number; factors: SignalFactor[]; levels: FrozenLevels; gate: SignalIssuanceDecision; inputSnapshotId: string | null };
type RecordSignalResult = { recorded: boolean; suppressedReason: SignalIssuanceReason | null; signalDay: Point | null; acceptedCandidate: AcceptedSignalCandidate | null };
function acceptedCandidateFromStored(signal: typeof schema.trackedSignals.$inferSelect): AcceptedSignalCandidate | null {
  if (signal.invalidationLevel == null || signal.target1 == null || signal.target2 == null || signal.invalidationAtr14 == null || signal.invalidationAtrMultiple == null || signal.riskPerUnit == null) return null;
  let gate: SignalIssuanceDecision = { allowed: true, reason: null, belowSma50: null, lowerHighs: null, trend20Negative: null };
  try { const parsed = JSON.parse(signal.gateResultsJson) as Partial<SignalIssuanceDecision>; gate = { allowed: parsed.allowed === true, reason: typeof parsed.reason === "string" ? parsed.reason : null, belowSma50: typeof parsed.belowSma50 === "boolean" ? parsed.belowSma50 : null, lowerHighs: typeof parsed.lowerHighs === "boolean" ? parsed.lowerHighs : null, trend20Negative: typeof parsed.trend20Negative === "boolean" ? parsed.trend20Negative : null }; } catch { /* keep fail-closed parsed shape */ }
  return { direction: signal.direction, score: signal.confidence, factors: parseScanFactors(signal.factorBreakdownJson), levels: { entryPrice: signal.entryPrice, stopPrice: signal.invalidationLevel, target1: signal.target1, target2: signal.target2, riskPerUnit: signal.riskPerUnit, direction: signal.direction, atr14: signal.invalidationAtr14, invalidationAtrMultiple: signal.invalidationAtrMultiple, invalidationBasis: signal.invalidationMethod ?? SIGNAL_INVALIDATION_METHOD }, gate, inputSnapshotId: signal.inputSnapshotId };
}
export type RecordSignalDependencies = {
  loadIssuanceEvidence?: (symbol: string, signalDate: string) => Promise<Omit<ExactIssuanceCheck, "decision"> & { error: string | null }>;
  logSuppressed?: typeof logSuppressedCandidate;
};
export async function recordSignal(ctx: Ctx, symbol: string, name: string, setupType: string, _direction: "long" | "short", _confidence: number, signalDate: string, evidence: { factors: SignalFactor[]; levels: FrozenLevels; sourceAsOf: string; barTimestamp: string; barState: "closed" | "forming"; sourceUrl: string; exchangeCalendar: string; instrumentType: string }, dependencies: RecordSignalDependencies = {}): Promise<RecordSignalResult> {
  if (evidence.exchangeCalendar !== "XNYS") return { recorded: false, suppressedReason: `watch-only: ${evidence.exchangeCalendar} calendar is not yet supported by the issuance clock`, signalDay: null, acceptedCandidate: null };

  // Fetch one authoritative evidence window, reconstruct the complete candidate from
  // it, and only then apply the issuance gate. No earlier draft can lend its gate
  // result to a later direction, score, stop, or target set.
  const exact = await (dependencies.loadIssuanceEvidence ?? exactYahooIssuanceEvidence)(symbol, signalDate);
  const unavailableDecision: SignalIssuanceDecision = { allowed: false, reason: exact.error ?? `issuance-check unavailable: exact completed signal-day OHLC was not available for ${signalDate}`, belowSma50: null, lowerHighs: null, trend20Negative: null };
  const sourceAsOf = exact.signalDay ? newYorkCloseIso(exact.signalDay.date) : evidence.sourceAsOf;
  const rawBars = exact.history.map((bar) => ({ ...bar, availableAt: newYorkCloseIso(bar.date) }));
  const parameters = { invalidationAtrMultiple: SIGNAL_INVALIDATION_ATR_MULTIPLE, target1R: 1.5, target2R: 2.5 };
  const prepared = exact.error ? null : reconstructAndValidateEquityCandidate(rawBars, evidence.barTimestamp, signalDate, parameters);
  if (!prepared || prepared.status !== "accepted" || !prepared.reconstruction.decision || !prepared.reconstruction.levels || !prepared.gate) {
    const gate = prepared?.gate ?? unavailableDecision;
    const reconstruction = prepared?.reconstruction;
    const candidateDirection = reconstruction?.decision?.direction ?? _direction;
    const candidateScore = reconstruction?.decision?.score ?? _confidence;
    const candidateLevels = reconstruction?.levels ? { entryPrice: reconstruction.levels.entryPrice, stopPrice: reconstruction.levels.stopPrice, target1: reconstruction.levels.target1, target2: reconstruction.levels.target2, riskPerUnit: round(Math.abs(reconstruction.levels.entryPrice - reconstruction.levels.stopPrice), 4), direction: candidateDirection, atr14: reconstruction.levels.atr14, invalidationAtrMultiple: SIGNAL_INVALIDATION_ATR_MULTIPLE, invalidationBasis: SIGNAL_INVALIDATION_METHOD } : evidence.levels;
    const reason = prepared?.reason ?? gate.reason ?? "Final candidate reconstruction or gate validation was incomplete.";
    await (dependencies.logSuppressed ?? logSuppressedCandidate)(ctx, { symbol, name, setupType, direction: candidateDirection, agreementScore: candidateScore, entryPrice: candidateLevels.entryPrice, invalidation: candidateLevels.stopPrice, signalDate, signalDay: exact.signalDay, reason, origin: "tracker", sourceAsOf, sourceUrl: exact.sourceUrl || evidence.sourceUrl, decision: gate });
    return { recorded: false, suppressedReason: reason, signalDay: exact.signalDay, acceptedCandidate: null };
  }

  const reconstruction = prepared.reconstruction;
  const factors: SignalFactor[] = reconstruction.factors.map((factor) => ({ name: factor.name, weight: factor.weight, score: factor.score, contribution: factor.contribution, reading: factor.reading, quality: factor.quality, asOf: factor.asOf, source: factor.source, qualityReason: factor.qualityReason }));
  const confidence = reconstruction.decision.score;
  const ledgerDirection = reconstruction.decision.direction;
  const level = reconstruction.levels;
  const frozenLevels: FrozenLevels = { entryPrice: level.entryPrice, stopPrice: level.stopPrice, target1: level.target1, target2: level.target2, riskPerUnit: round(Math.abs(level.entryPrice - level.stopPrice), 4), direction: ledgerDirection, atr14: level.atr14, invalidationAtrMultiple: SIGNAL_INVALIDATION_ATR_MULTIPLE, invalidationBasis: SIGNAL_INVALIDATION_METHOD };
  const finalGate: SignalIssuanceDecision = prepared.gate;
  const coverage = factors.length ? factors.filter((factor) => factor.quality === "GOOD").length / factors.length : 0;
  const decisionAt = evidence.barTimestamp;
  const db = ctx.db<typeof schema>();
  const identity = { symbol, venue: "Yahoo Finance", strategyId: SIGNAL_STRATEGY_ID, strategyVersion: SIGNAL_STRATEGY_VERSION, parameterHash: SIGNAL_PARAMETER_HASH, decisionBar: decisionAt };
  const identityHash = await contentHash(identity);
  const deterministicSignalId = Number.parseInt(identityHash.slice(0, 12), 16);
  const snapshotPayload = { availableThrough: sourceAsOf, rawBars, factors: factors.map((factor) => ({ ...factor, id: factorId(factor.name) })), decision: { direction: ledgerDirection, score: confidence }, levels: frozenLevels, gateResults: finalGate, parameterHash: SIGNAL_PARAMETER_HASH, canonicalParameters: { ...parameters, weights: Object.fromEntries(factors.map((factor) => [factorId(factor.name), factor.weight])) }, providerMetadata: { provider: "Yahoo Finance", adjustmentBasis: "provider-adjusted OHLC", availabilityMeaning: "scheduled XNYS session close" }, replayStatus: reconstruction.status };
  const inputSnapshotId = await contentHash(snapshotPayload);
  const proposedCandidate: AcceptedSignalCandidate = { direction: ledgerDirection, score: confidence, factors, levels: frozenLevels, gate: finalGate, inputSnapshotId };
  const existing = (await db.select().from(schema.trackedSignals).where(eq(schema.trackedSignals.issuanceIdentity, identityHash)).limit(1))[0];
  if (existing) {
    const accepted = acceptedCandidateFromStored(existing);
    if (accepted && stableJson(accepted) !== stableJson(proposedCandidate)) {
      const eventPayload = { frozen: accepted, proposed: proposedCandidate };
      await db.insert(schema.signalEvents).values({ signalId: existing.id, eventType: "amendment", reason: "A retry produced different evidence; the original issuance remains immutable.", payloadJson: JSON.stringify(eventPayload), contentHash: await contentHash({ signalId: existing.id, eventType: "amendment", eventPayload }) }).onConflictDoNothing({ target: schema.signalEvents.contentHash });
    }
    return { recorded: true, suppressedReason: null, signalDay: exact.signalDay, acceptedCandidate: accepted };
  }
  const issuedAt = new Date().toISOString();
  const signalValues: typeof schema.trackedSignals.$inferInsert = { id: deterministicSignalId, symbol, instrumentName: name, setupType, direction: ledgerDirection, confidence, entryPrice: frozenLevels.entryPrice, signalDate, factorBreakdownJson: JSON.stringify(factors), invalidationLevel: frozenLevels.stopPrice, invalidationAtr14: frozenLevels.atr14, invalidationAtrMultiple: frozenLevels.invalidationAtrMultiple, invalidationMethod: frozenLevels.invalidationBasis, target1: frozenLevels.target1, target2: frozenLevels.target2, strategyId: SIGNAL_STRATEGY_ID, strategyVersion: SIGNAL_STRATEGY_VERSION, parameterHash: SIGNAL_PARAMETER_HASH, buildId: SIGNAL_BUILD_ID, decisionAt, availableAt: decisionAt, issuedAt, entryAt: issuedAt, expiresAt: null, inputSnapshotId, issuanceIdentity: identityHash, barStart: xnysSessionBounds(signalDate)?.start ?? null, barEnd: decisionAt, barIsClosed: evidence.barState === "closed", priceBasis: "Yahoo adjusted OHLC research reference", entryRule: "Reference entry equals the completed adjusted daily close; paper execution is not claimed", riskPerUnit: frozenLevels.riskPerUnit, primaryHorizon: 30, horizonUnit: "trading_sessions", featureValuesJson: JSON.stringify(factors), gateResultsJson: JSON.stringify(finalGate), scoreDefinition: SIGNAL_SCORE_DEFINITION, dataCoverage: round(coverage, 4), validationStatus: "collecting", exchangeCalendar: evidence.exchangeCalendar, venue: "Yahoo Finance", instrumentType: evidence.instrumentType, sourceAsOf, barTimestamp: decisionAt, barState: "closed", sourceUrl: exact.sourceUrl || evidence.sourceUrl, updatedAt: new Date() };
  const issuedEventPayload = { identity, inputSnapshotId, decision: snapshotPayload.decision, levels: frozenLevels, gateResults: finalGate };
  const issuedEventHash = await contentHash({ signalId: deterministicSignalId, eventType: "issued", issuedEventPayload });
  try {
    await db.batch([
      db.insert(schema.trackedSignals).values(signalValues).onConflictDoNothing({ target: schema.trackedSignals.issuanceIdentity }),
      db.insert(schema.signalInputSnapshots).values({ id: inputSnapshotId, signalId: deterministicSignalId, availableThrough: sourceAsOf, rawInputsJson: JSON.stringify(snapshotPayload), providerMetadataJson: JSON.stringify({ provider: "Yahoo Finance", sourceUrl: exact.sourceUrl || evidence.sourceUrl, timestampMeaning: "daily session close availability", adjustmentBasis: "provider-adjusted OHLC", capturedAt: issuedAt }), contentHash: inputSnapshotId }).onConflictDoNothing({ target: schema.signalInputSnapshots.id }),
      db.insert(schema.signalEvents).values({ signalId: deterministicSignalId, eventType: "issued", reason: "Initial immutable issuance bundle", payloadJson: JSON.stringify(issuedEventPayload), contentHash: issuedEventHash }).onConflictDoNothing(),
    ]);
  } catch (error) {
    const raced = (await db.select().from(schema.trackedSignals).where(eq(schema.trackedSignals.issuanceIdentity, identityHash)).limit(1))[0];
    if (!raced) throw error;
    return { recorded: true, suppressedReason: null, signalDay: exact.signalDay, acceptedCandidate: acceptedCandidateFromStored(raced) };
  }
  const committed = (await db.select().from(schema.trackedSignals).where(eq(schema.trackedSignals.issuanceIdentity, identityHash)).limit(1))[0];
  return { recorded: true, suppressedReason: null, signalDay: exact.signalDay, acceptedCandidate: committed ? acceptedCandidateFromStored(committed) : proposedCandidate };
}

type PolymarketHintMarket = z.infer<typeof polymarketHintMarketSchema>;
type PolymarketSearchMarket = PolymarketHintMarket & { eventTitle: string | null; eventEndDate: string | null; sourceUrl: string };
type PolymarketRawMarket = { question?: unknown; slug?: unknown; outcomes?: unknown; outcomePrices?: unknown; active?: unknown; closed?: unknown; volume24hr?: unknown; volume24hrClob?: unknown; liquidity?: unknown; liquidityClob?: unknown; openInterest?: unknown; updatedAt?: unknown; endDate?: unknown; endDateIso?: unknown };
type PolymarketRawEvent = PolymarketRawMarket & { title?: unknown; markets?: unknown };
type PolymarketSearchPayload = { events?: unknown; markets?: unknown };
const POLYMARKET_LABEL = "Implied crowd prices from Polymarket prediction markets - what bettors will pay, not probabilities.";
const polymarketSearchCache = new Map<string, { expiresAt: number; rows: PolymarketSearchMarket[]; fetchedAt: string; sourceUrl: string; error: string | null }>();
const polymarketSearchInflight = new Map<string, Promise<{ rows: PolymarketSearchMarket[]; fetchedAt: string; sourceUrl: string; error: string | null }>>();
let macroCrowdCache: { expiresAt: number; value: z.infer<typeof crowdPricingPanelSchema> } | null = null;
function numberValue(value: unknown): number | null { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function stringValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function jsonStringArray(value: unknown): string[] { if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string"); if (typeof value !== "string") return []; try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function marketKeywords(value: string): string[] { const stop = new Set(["will", "what", "when", "where", "with", "from", "after", "before", "there", "this", "that", "the", "and", "for", "into", "market", "markets", "theory", "stock", "shares", "price", "prices", "2026", "2027"]); return [...new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((word) => !stop.has(word)) ?? [])]; }
function keywordOverlapScore(query: string, question: string, eventTitle: string | null): number { const wanted = marketKeywords(query); if (!wanted.length) return 0; const haystack = new Set(marketKeywords(`${question} ${eventTitle ?? ""}`)); return wanted.reduce((score, word) => score + (haystack.has(word) ? word.length >= 7 ? 3 : 2 : 0), 0) / Math.max(1, wanted.length); }
function parsePolymarketMarket(raw: PolymarketRawMarket, fetchedAt: string, sourceUrl: string, event: PolymarketRawEvent | null): PolymarketSearchMarket | null {
  if (raw.active === false || raw.closed === true) return null;
  const question = stringValue(raw.question); const slug = stringValue(raw.slug); const outcomes = jsonStringArray(raw.outcomes); const prices = jsonStringArray(raw.outcomePrices).map((value) => Number(value));
  const yesIndex = outcomes.findIndex((value) => value.toLowerCase() === "yes"); const noIndex = outcomes.findIndex((value) => value.toLowerCase() === "no");
  const yes = yesIndex >= 0 ? prices[yesIndex] : null; const no = noIndex >= 0 ? prices[noIndex] : yes != null ? 1 - yes : null;
  const volume24hr = numberValue(raw.volume24hr) ?? numberValue(raw.volume24hrClob); const liquidity = numberValue(raw.liquidity) ?? numberValue(raw.liquidityClob) ?? 0; const openInterest = numberValue(raw.openInterest);
  if (!question || !slug || yes == null || no == null || !Number.isFinite(yes) || !Number.isFinite(no) || volume24hr == null || volume24hr < 1_000 || liquidity < 1_000) return null;
  return { question, yesImpliedCrowdPrice: round(yes, 4), noImpliedCrowdPrice: round(no, 4), volume24hr: round(volume24hr, 2), liquidity: round(liquidity, 2), openInterest, slug, marketUrl: `https://polymarket.com/market/${encodeURIComponent(slug)}`, asOf: fetchedAt, eventTitle: stringValue(event?.title), eventEndDate: stringValue(event?.endDate) ?? stringValue(event?.endDateIso) ?? stringValue(raw.endDate) ?? stringValue(raw.endDateIso), sourceUrl };
}
async function fetchPolymarketSearch(queryInput: string): Promise<{ rows: PolymarketSearchMarket[]; fetchedAt: string; sourceUrl: string; error: string | null }> {
  const query = queryInput.trim().slice(0, 180); const key = query.toLowerCase(); const cached = polymarketSearchCache.get(key); if (cached && cached.expiresAt > Date.now()) return cached;
  const pending = polymarketSearchInflight.get(key); if (pending) return pending;
  const task = (async () => {
    const sourceUrl = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(query)}`; const fetchedAt = new Date().toISOString(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 7_000);
    try {
      const response = await fetch(sourceUrl, { signal: controller.signal, headers: { "Accept": "application/json", "User-Agent": "Muse Equity Analyzer/1.0" } });
      if (!response.ok) return { rows: [], fetchedAt, sourceUrl, error: `Polymarket returned HTTP ${response.status}; crowd pricing was skipped.` };
      const payload = await response.json() as PolymarketSearchPayload; const rows: PolymarketSearchMarket[] = [];
      const events = Array.isArray(payload.events) ? payload.events : []; for (const eventValue of events) { if (!eventValue || typeof eventValue !== "object") continue; const event = eventValue as PolymarketRawEvent; if (event.active === false || event.closed === true) continue; const markets = Array.isArray(event.markets) ? event.markets : []; for (const marketValue of markets) { if (!marketValue || typeof marketValue !== "object") continue; const parsed = parsePolymarketMarket(marketValue as PolymarketRawMarket, fetchedAt, sourceUrl, event); if (parsed) rows.push(parsed); } }
      const topMarkets = Array.isArray(payload.markets) ? payload.markets : []; for (const marketValue of topMarkets) { if (!marketValue || typeof marketValue !== "object") continue; const parsed = parsePolymarketMarket(marketValue as PolymarketRawMarket, fetchedAt, sourceUrl, null); if (parsed) rows.push(parsed); }
      const deduped = [...new Map(rows.map((row) => [row.slug, row])).values()]; return { rows: deduped, fetchedAt, sourceUrl, error: null };
    } catch (error) { return { rows: [], fetchedAt, sourceUrl, error: error instanceof Error && error.name === "AbortError" ? "Polymarket timed out after 7 seconds; crowd pricing was skipped." : "Polymarket was unavailable; crowd pricing was skipped." }; }
    finally { clearTimeout(timeout); }
  })();
  polymarketSearchInflight.set(key, task); const result = await task; polymarketSearchInflight.delete(key); polymarketSearchCache.set(key, { ...result, expiresAt: Date.now() + 15 * 60_000 }); return result;
}
async function getPolymarketHintInternal(query: string): Promise<z.infer<typeof polymarketHintResponse>> {
  const result = await fetchPolymarketSearch(query); if (result.error) return { state: "no_data", query, label: POLYMARKET_LABEL, market: null, reason: result.error };
  const ranked = result.rows.map((row) => ({ row, score: keywordOverlapScore(query, row.question, row.eventTitle) })).sort((a, b) => b.score - a.score || b.row.volume24hr - a.row.volume24hr); const best = ranked[0];
  if (!best || best.score <= 0) return { state: "no_data", query, label: POLYMARKET_LABEL, market: null, reason: `No active relevant Polymarket market passed the $1k 24-hour volume and $1k liquidity gate for “${query}”.` };
  const { eventTitle: _eventTitle, eventEndDate: _eventEndDate, sourceUrl: _sourceUrl, ...market } = best.row; return { state: "available", query, label: POLYMARKET_LABEL, market, reason: null };
}

function crowdOption(row: PolymarketSearchMarket): z.infer<typeof crowdMarketOptionSchema> { const { sourceUrl: _sourceUrl, ...market } = row; return market; }
async function searchCrowdMarkets(query: string): Promise<z.infer<typeof crowdMarketSearchResponse>> {
  let result = await fetchPolymarketSearch(query);
  const fallback = /\b(btc|bitcoin)\b/i.test(query) ? "Bitcoin" : /\b(eth|ether|ethereum)\b/i.test(query) ? "Ethereum" : /\b(nvda|nvidia)\b/i.test(query) ? "Nvidia" : /\b(tsla|tesla)\b/i.test(query) ? "Tesla" : null;
  if (!result.rows.length && fallback && fallback.toLowerCase() !== query.trim().toLowerCase()) result = await fetchPolymarketSearch(fallback);
  if (result.error) return { state: "no_data", query, asOf: result.fetchedAt, options: [], reason: result.error };
  const rankQuery = fallback ?? query; const ranked = result.rows.map((row) => ({ row, score: keywordOverlapScore(rankQuery, row.question, row.eventTitle) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.row.volume24hr - a.row.volume24hr).slice(0, 12);
  if (!ranked.length) return { state: "no_data", query, asOf: result.fetchedAt, options: [], reason: `No active matching market passed the $1k 24-hour volume and $1k liquidity gate for “${query}”.` };
  return { state: "available", query, asOf: result.fetchedAt, options: ranked.map((item) => crowdOption(item.row)), reason: null };
}
const crowdAssets: Array<{ pattern: RegExp; symbol: string }> = [
  { pattern: /\b(bitcoin|btc)\b/i, symbol: "BTC-USD" }, { pattern: /\b(ethereum|ether|eth)\b/i, symbol: "ETH-USD" },
  { pattern: /\b(s&p|s&p 500|spy)\b/i, symbol: "SPY" }, { pattern: /\b(nasdaq|qqq)\b/i, symbol: "QQQ" },
  { pattern: /\b(nvidia|nvda)\b/i, symbol: "NVDA" }, { pattern: /\b(tesla|tsla)\b/i, symbol: "TSLA" },
  { pattern: /\b(gold)\b/i, symbol: "GC=F" }, { pattern: /\b(crude|wti|oil)\b/i, symbol: "CL=F" },
];
function crowdTarget(question: string): { target: number; side: "above" | "below" } | null {
  const side: "above" | "below" | null = /\b(above|over|higher than|at least|reach|hit)\b/i.test(question) ? "above" : /\b(below|under|lower than|at most|fall to|drop to)\b/i.test(question) ? "below" : null;
  if (!side) return null;
  const matches = [...question.matchAll(/(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)\s*([kKmM])?/g)];
  const candidates = matches.map((match) => { const raw = Number((match[1] ?? "").replace(/,/g, "")); const suffix = (match[2] ?? "").toLowerCase(); return raw * (suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1); }).filter((value) => Number.isFinite(value) && value > 1);
  const target = candidates.sort((a, b) => b - a)[0]; return target == null ? null : { target, side };
}
function factorScoreAt(points: Point[], index: number): number | null {
  const current = points[index]; if (!current || index < 220) return null; const history = points.slice(0, index + 1); const previous = history[history.length - 2]; const closes = history.map((point) => point.close); const volumes = history.map((point) => point.volume).filter((value): value is number => value != null);
  const mean20 = average(closes.slice(-20)); const mean50 = average(closes.slice(-50)); const mean200 = average(closes.slice(-200)); const return30 = pct(current.close, history[history.length - 31]?.close); const currentRsi = rsi(history); const fast = ema(closes, 12); const slow = ema(closes, 26); const volumeZ = zScore(volumes.slice(-20)); const historicalAtr = atr(history); const riskAdjustedReturn = return30 == null || historicalAtr == null || current.close <= 0 ? null : return30 / Math.max(0.01, historicalAtr / current.close * 100 * Math.sqrt(30));
  const factors: SignalFactor[] = [
    { name: "Price vs SMA 20", weight: 6, score: mean20 == null ? 0 : current.close > mean20 ? 1 : -1, contribution: 0, reading: "" }, { name: "Price vs SMA 50", weight: 8, score: mean50 == null ? 0 : current.close > mean50 ? 1 : -1, contribution: 0, reading: "" }, { name: "Price vs SMA 200", weight: 8, score: mean200 == null ? 0 : current.close > mean200 ? 1 : -1, contribution: 0, reading: "" },
    { name: "Wilder RSI 14", weight: 20, score: currentRsi == null ? 0 : currentRsi >= 55 && currentRsi <= 75 ? 1 : currentRsi <= 45 && currentRsi >= 25 ? -1 : 0, contribution: 0, reading: "" }, { name: "MACD 12–26", weight: 8, score: fast == null || slow == null || Math.abs(fast - slow) < 0.000001 ? 0 : fast > slow ? 1 : -1, contribution: 0, reading: "" }, { name: "High-volume direction", weight: 20, score: volumeZ == null || volumeZ <= 1 ? 0 : current.close > (previous?.close ?? current.close) ? 1 : current.close < (previous?.close ?? current.close) ? -1 : 0, contribution: 0, reading: "" }, { name: "ATR-adjusted 30-session trend", weight: 20, score: riskAdjustedReturn == null || Math.abs(riskAdjustedReturn) < 0.5 ? 0 : riskAdjustedReturn > 0 ? 1 : -1, contribution: 0, reading: "" },
  ];
  return factorScoreBreakdown(factors)?.score ?? null;
}
async function researchCrowdMarket(ctx: Ctx, query: string, slug: string): Promise<z.infer<typeof crowdMarketResearchResponse>> {
  let found = await fetchPolymarketSearch(query); let row = found.rows.find((item) => item.slug === slug) ?? null;
  if (!row) { const fallback = /\b(btc|bitcoin)\b/i.test(query) ? "Bitcoin" : /\b(eth|ether|ethereum)\b/i.test(query) ? "Ethereum" : /\b(nvda|nvidia)\b/i.test(query) ? "Nvidia" : /\b(tsla|tesla)\b/i.test(query) ? "Tesla" : null; if (fallback) { found = await fetchPolymarketSearch(fallback); row = found.rows.find((item) => item.slug === slug) ?? null; } }
  if (!row) return { state: "no_data", market: null, crowdProbability: null, researchedProbability: null, edgePoints: null, sampleSize: 0, instrument: null, factorAgreement: null, basis: "No comparison was run.", reason: found.error ?? "That market is no longer active or did not pass the liquidity gate." };
  const market = crowdOption(row); const asset = crowdAssets.find((item) => item.pattern.test(row.question)); const target = crowdTarget(row.question);
  if (!asset || !target) return { state: "withheld", market, crowdProbability: round(row.yesImpliedCrowdPrice * 100, 1), researchedProbability: null, edgePoints: null, sampleSize: 0, instrument: null, factorAgreement: null, basis: "The crowd price is live. The terminal only publishes its own probability when it can identify an underlying asset, a numeric barrier, a side, and at least 20 comparable historical setups.", reason: "No measured asset-barrier base rate can be built for this market wording." };
  const series = await yahooFullHistory(ctx, asset.symbol); const points = series.points; const last = points.at(-1); if (!last) return { state: "no_data", market, crowdProbability: round(row.yesImpliedCrowdPrice * 100, 1), researchedProbability: null, edgePoints: null, sampleSize: 0, instrument: null, factorAgreement: null, basis: "No comparison was run.", reason: "Underlying price history was unavailable." };
  const currentScore = factorScoreAt(points, points.length - 1); if (currentScore == null) return { state: "withheld", market, crowdProbability: round(row.yesImpliedCrowdPrice * 100, 1), researchedProbability: null, edgePoints: null, sampleSize: 0, instrument: { symbol: asset.symbol, price: last.close, asOf: last.date }, factorAgreement: null, basis: "Current factor agreement could not be measured.", reason: "Terminal probability withheld." };
  const endMs = row.eventEndDate ? Date.parse(row.eventEndDate) : NaN; const calendarDays = Number.isFinite(endMs) ? Math.ceil((endMs - Date.now()) / 86_400_000) : NaN; const horizon = Number.isFinite(calendarDays) && calendarDays > 0 ? Math.max(1, Math.min(60, Math.round(calendarDays * 5 / 7))) : null;
  if (horizon == null) return { state: "withheld", market, crowdProbability: round(row.yesImpliedCrowdPrice * 100, 1), researchedProbability: null, edgePoints: null, sampleSize: 0, instrument: { symbol: asset.symbol, price: last.close, asOf: last.date }, factorAgreement: { score: currentScore, direction: currentScore > 0 ? "long" : currentScore < 0 ? "short" : "mixed", band: `${Math.max(0, Math.abs(currentScore) - 10)}–${Math.min(100, Math.abs(currentScore) + 10)}` }, basis: "The market did not provide a usable future resolution date.", reason: "Horizon-matched base rate cannot be measured." };
  const threshold = target.target / last.close - 1; const samples: boolean[] = []; const touchMarket = /\b(reach|hit|touch)\b/i.test(row.question);
  for (let index = 220; index < points.length - horizon; index++) { const current = points[index]; const future = points[index + horizon]; const next = points[index + 1]; if (!current || !future) continue; if (next && calendarWeekKey(next.date) === calendarWeekKey(current.date)) continue; const score = factorScoreAt(points, index); if (score == null || Math.sign(score) !== Math.sign(currentScore) || Math.abs(score - currentScore) > 15) continue; const path = points.slice(index + 1, index + horizon + 1); const realized = touchMarket ? target.side === "above" ? Math.max(...path.map((point) => point.high ?? point.close)) / current.close - 1 : Math.min(...path.map((point) => point.low ?? point.close)) / current.close - 1 : future.close / current.close - 1; samples.push(target.side === "above" ? realized >= threshold : realized <= threshold); }
  const sampleSize = samples.length; const researchedProbability = sampleSize >= 20 ? round(samples.filter(Boolean).length / sampleSize * 100, 1) : null; const crowdProbability = round(row.yesImpliedCrowdPrice * 100, 1); const factorDirection = currentScore > 0 ? "long" as const : currentScore < 0 ? "short" as const : "mixed" as const; const band = `${Math.max(0, Math.abs(currentScore) - 15)}–${Math.min(100, Math.abs(currentScore) + 15)}`;
  const basis = `${sampleSize} non-overlapping weekly decisions with the same factor direction and agreement within 15 points, tested over ${horizon} trading sessions against a ${round(threshold * 100, 2)}% ${target.side} barrier using ${touchMarket ? "intraperiod highs/lows" : "the horizon close"}. Current agreement ${currentScore > 0 ? "+" : ""}${currentScore}.`;
  return researchedProbability == null ? { state: "withheld", market, crowdProbability, researchedProbability: null, edgePoints: null, sampleSize, instrument: { symbol: asset.symbol, price: last.close, asOf: last.date }, factorAgreement: { score: currentScore, direction: factorDirection, band }, basis, reason: `Only ${sampleSize} comparable setups; 20 are required.` } : { state: "available", market, crowdProbability, researchedProbability, edgePoints: round(researchedProbability - crowdProbability, 1), sampleSize, instrument: { symbol: asset.symbol, price: last.close, asOf: last.date }, factorAgreement: { score: currentScore, direction: factorDirection, band }, basis, reason: null };
}
async function buildMacroCrowdPricing(): Promise<z.infer<typeof crowdPricingPanelSchema>> {
  if (macroCrowdCache && macroCrowdCache.expiresAt > Date.now()) return macroCrowdCache.value;
  const [fed, inflation, recession] = await Promise.all([fetchPolymarketSearch("fed decision"), fetchPolymarketSearch("CPI inflation"), fetchPolymarketSearch("US recession")]);
  const now = Date.now(); const upcomingFed = fed.rows.filter((row) => row.eventEndDate && Number.isFinite(Date.parse(row.eventEndDate)) && Date.parse(row.eventEndDate) >= now).sort((a, b) => Date.parse(a.eventEndDate ?? "") - Date.parse(b.eventEndDate ?? "")); const nearestEvent = upcomingFed[0]?.eventTitle ?? null;
  const fedRows = (nearestEvent ? upcomingFed.filter((row) => row.eventTitle === nearestEvent) : fed.rows).sort((a, b) => b.yesImpliedCrowdPrice - a.yesImpliedCrowdPrice).slice(0, 8);
  const other = [inflation, recession].flatMap((result) => result.rows.map((row) => ({ row, score: keywordOverlapScore(result === inflation ? "CPI inflation" : "US recession", row.question, row.eventTitle) }))).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.row.volume24hr - a.row.volume24hr).map((item) => item.row); const macroRows = [...new Map(other.map((row) => [row.slug, row])).values()].slice(0, 2);
  const strip = (row: PolymarketSearchMarket): PolymarketHintMarket => { const { eventTitle: _eventTitle, eventEndDate: _eventEndDate, sourceUrl: _sourceUrl, ...market } = row; return market; };
  const asOf = [...fedRows, ...macroRows].map((row) => row.asOf).sort().at(-1) ?? null; const errors = [fed.error, inflation.error, recession.error].filter((value): value is string => !!value); const value: z.infer<typeof crowdPricingPanelSchema> = fedRows.length || macroRows.length ? { state: "available", label: POLYMARKET_LABEL, asOf, reason: errors.length ? errors.join(" ") : null, fedDecision: fedRows.map(strip), macroContext: macroRows.map(strip), sentiment: null } : { state: "no_data", label: POLYMARKET_LABEL, asOf: null, reason: errors.join(" ") || "No active macro market passed the $1k 24-hour volume and $1k liquidity gate.", fedDecision: [], macroContext: [], sentiment: null };
  macroCrowdCache = { expiresAt: Date.now() + 15 * 60_000, value }; return value;
}
function emptyCrowdPricing(reason: string): z.infer<typeof crowdPricingPanelSchema> { return { state: "no_data", label: POLYMARKET_LABEL, asOf: null, reason, fedDecision: [], macroContext: [], sentiment: null }; }
async function fetchFearGreed() { const sourceUrl = "https://api.alternative.me/fng/?limit=1&format=json"; try { const response = await fetch(sourceUrl, { headers: { "User-Agent": "Muse Equity Analyzer support@meta.com" } }); if (!response.ok) return null; const payload = await response.json() as { data?: Array<{ value?: string; value_classification?: string; timestamp?: string }> }; const row = payload.data?.[0]; const value = Number(row?.value); const seconds = Number(row?.timestamp); if (!Number.isFinite(value) || !Number.isFinite(seconds)) return null; return { value, classification: row?.value_classification ?? "Unclassified", asOf: new Date(seconds * 1000).toISOString(), sourceUrl, note: "Alternative.me Fear & Greed is crowd/sentiment context only and contributes zero to directional factor agreement." }; } catch { return null; } }

async function analyze(ctx: Ctx, rawQuery: string, shouldRecord = false, includeBacktest = false, includeValuation = false): Promise<z.infer<typeof analyzeResponse>> {
  const query = rawQuery.trim(); const key = cleanKey(query);
  const privateMatch = privateCompanies[key];
  if (privateMatch) {
    const context = await fundingContext(ctx, privateMatch.name);
    return { status: "private", error: null, privateCompany: { ...privateMatch, ...context }, commodity: null, instrument: null, chart: [], weekly: [], events: [], returns: [], indicators: [], pattern: [], factorModel: null, walkForward: null, thesis: null, failure: null, levels: null, smartMoney: [], secFilings: emptySecFilings("SEC filings are unavailable because no listed issuer dossier was loaded."), earningsCalendar: emptyFinnhubEarnings("Earnings calendar is unavailable because no listed issuer dossier was loaded."), crowdPricing: emptyCrowdPricing("Crowd pricing is shown only for listed-instrument dossiers."), valuation: null, sectionVerdicts: null, synthesis: null };
  }
  const commodity = commodityAliases[key] ?? null;
  const requestedSymbol = commodity?.future ?? query.toUpperCase();
  const resolutionMethod: "direct" | "commodity_alias" = commodity ? "commodity_alias" : "direct";
  // These sources are independent of the chart request. Starting them together keeps
  // dossier latency at the slowest source instead of the sum of all four sources.
  const dossierContextPromise = Promise.all([
    buildMacroCrowdPricing().catch(() => emptyCrowdPricing("Polymarket was unavailable; the dossier loaded without crowd pricing.")),
    fetchFearGreed(),
    commodity ? Promise.resolve(emptySecFilings("SEC filings are unavailable for commodity futures.")) : recentSecFilings(requestedSymbol),
    commodity ? Promise.resolve({ insiders: null, earnings: null, filings: null }) : finnhubDossierContext(ctx, requestedSymbol),
  ]);
  let source: Awaited<ReturnType<typeof yahooForRequest>>;
  try { source = await yahooForRequest(ctx, commodity, requestedSymbol); }
  catch (directError) {
    const reason = String(directError).replace(/^Error:\s*/, "");
    if (commodity) {
      return { status: "error", error: `Yahoo Finance data failed for “${query}”. ${reason}`, privateCompany: null, commodity, instrument: null, chart: [], weekly: [], events: [], returns: [], indicators: [], pattern: [], factorModel: null, walkForward: null, thesis: null, failure: null, levels: null, smartMoney: [], secFilings: emptySecFilings("SEC filings are unavailable because no listed issuer dossier was loaded."), earningsCalendar: emptyFinnhubEarnings("Earnings calendar is unavailable because no listed issuer dossier was loaded."), crowdPricing: emptyCrowdPricing("Crowd pricing is unavailable because the instrument dossier could not be loaded."), valuation: null, sectionVerdicts: null, synthesis: null };
    }
    return { status: "error", error: `No chart matched the exact ticker “${requestedSymbol}”. Search by company name and pick the intended listing; the analyzer never substitutes another symbol. ${reason}`, privateCompany: null, commodity: null, instrument: null, chart: [], weekly: [], events: [], returns: [], indicators: [], pattern: [], factorModel: null, walkForward: null, thesis: null, failure: null, levels: null, smartMoney: [], secFilings: emptySecFilings("SEC filings are unavailable because no listed issuer dossier was loaded."), earningsCalendar: emptyFinnhubEarnings("Earnings calendar is unavailable because no listed issuer dossier was loaded."), crowdPricing: emptyCrowdPricing("Crowd pricing is unavailable because the instrument dossier could not be loaded."), valuation: null, sectionVerdicts: null, synthesis: null };
  }
  const { series } = source; const daily = completedDailyPoints(series.points); const weekly = weeklyFrom(daily).slice(-104); const meta = series.meta;
  const symbol = meta.symbol ?? requestedSymbol;
  const valuationPromise = commodity || !includeValuation ? Promise.resolve(null) : stockValuation(ctx, symbol, { series });
  const name = meta.longName ?? meta.shortName ?? commodity?.name ?? symbol;
  const currency = meta.currency ?? null; const day200 = average(daily.slice(-200).map((p) => p.close));
  const chartFull: ChartPoint[] = daily.slice(-260).map((p, i, shown) => ({ ...p, sma20: finite(sma(shown, 20, i)), sma50: finite(sma(shown, 50, i)), sma200Proxy: finite(sma(shown, 200, i)) })); const chart = downsample(chartFull, 90);
  const last = daily[daily.length - 1]!; const previous = daily[daily.length - 2];
  const returnSpecs = [{ label: "7d", bars: 7 }, { label: "15d", bars: 15 }, { label: "30d", bars: 30 }, { label: "50d", bars: 50 }, { label: "90d", bars: 90 }, { label: "6m", bars: 126 }, { label: "1y", bars: 252 }];
  const returns = returnSpecs.map(({ label, bars }) => ({ label, value: finite(pct(last.close, daily[daily.length - 1 - bars]?.close)), unit: "%" }));
  const lastWeekly = weekly[weekly.length - 1];
  const closes = daily.map((p) => p.close); const obvNow = obv(daily); const rsiComputed = rsi(daily); const macdFast = ema(closes, 12); const macdSlow = ema(closes, 26); const currentAtr = atr(daily);
  const last20 = closes.slice(-20); const mid = average(last20); const sd = mid === null ? null : Math.sqrt(last20.reduce((s, v) => s + (v - mid) ** 2, 0) / Math.max(1, last20.length));
  const volumes = daily.map((p) => p.volume).filter((v): v is number => v != null);
  const indicators = [
    { label: "RSI 14", value: finite(rsiComputed), unit: "" }, { label: "MACD", value: macdFast != null && macdSlow != null ? round(macdFast - macdSlow) : null, unit: "" },
    { label: "Bollinger upper", value: mid != null && sd != null ? round(mid + 2 * sd) : null, unit: currency ?? "" }, { label: "Bollinger lower", value: mid != null && sd != null ? round(mid - 2 * sd) : null, unit: currency ?? "" },
    { label: "ATR 14", value: finite(currentAtr == null ? null : round(currentAtr)), unit: currency ?? "" }, { label: "OBV", value: finite(obvNow), unit: "" }, { label: "Volume z", value: finite(zScore(volumes.slice(-20))), unit: "σ" }, { label: "200d MA", value: finite(day200), unit: "" },
  ];
  const horizonDefs = [{ horizon: "Weeks", bars: 10 }, { horizon: "Months", bars: 30 }, { horizon: "6 months", weeklyBars: 26 }, { horizon: "1 year", weeklyBars: 52 }];
  const pattern = horizonDefs.map((h) => { const value = h.bars ? pct(last.close, daily[daily.length - 1 - h.bars]?.close) : lastWeekly ? pct(lastWeekly.close, weekly[weekly.length - 1 - (h.weeklyBars ?? 0)]?.close) : null; const read = value == null ? "History unavailable" : value > 8 ? "Advancing trend" : value < -8 ? "Declining trend" : "Range / transition"; return { horizon: h.horizon, read, value: finite(value) }; });
  const latestSma20 = chartFull[chartFull.length - 1]?.sma20; const latestSma50 = chartFull[chartFull.length - 1]?.sma50; const rsiNow = rsiComputed; const volZ = zScore(volumes.slice(-20)); const ret30 = returns.find((r) => r.label === "30d")?.value;
  const macdValue = macdFast != null && macdSlow != null ? macdFast - macdSlow : null;
  type FactorScore = -1 | 0 | 1;
  const lastBarAgeDays = Math.max(0, (Date.now() - Date.parse(`${last.date}T21:00:00Z`)) / 86400000);
  const hasAnomaly = daily.slice(-260).some((point, index, rows) => { const prior = rows[index - 1]; if (!prior || prior.close <= 0) return false; const move = point.close / prior.close - 1; return !Number.isFinite(move) || move <= -1 || Math.abs(move) > 0.8; });
  const factors: Array<{ name: string; weight: number; score: FactorScore; contribution: number; reading: string; quality: "GOOD" | "NO_DATA" | "STALE" | "ANOMALY"; asOf: string; source: string; qualityReason: string }> = [];
  const addFactor = (name: string, weight: number, value: FactorScore, reading: string) => { const quality = hasAnomaly ? "ANOMALY" as const : lastBarAgeDays > 5 ? "STALE" as const : reading === "Unavailable" ? "NO_DATA" as const : "GOOD" as const; const score = quality === "GOOD" ? value : 0; const qualityReason = quality === "ANOMALY" ? "A recent daily move exceeded the 80% anomaly gate; contribution withheld." : quality === "STALE" ? `Latest source bar is ${round(lastBarAgeDays, 1)} days old; contribution withheld above 5 days.` : quality === "NO_DATA" ? "Minimum source sample was not available; contribution withheld." : "Sample, anomaly, and freshness gates passed."; factors.push({ name, weight, score, contribution: weight * score, reading, quality, asOf: last.date, source: "Yahoo Finance chart", qualityReason }); };
  addFactor("Price vs SMA 20", 6, latestSma20 == null ? 0 : last.close > latestSma20 ? 1 : -1, latestSma20 == null ? "Unavailable" : `${round(last.close)} vs ${round(latestSma20)}`);
  addFactor("Price vs SMA 50", 8, latestSma50 == null ? 0 : last.close > latestSma50 ? 1 : -1, latestSma50 == null ? "Unavailable" : `${round(last.close)} vs ${round(latestSma50)}`);
  addFactor("Price vs SMA 200", 8, day200 == null ? 0 : last.close > day200 ? 1 : -1, day200 == null ? "Unavailable" : `${round(last.close)} vs ${round(day200)}`);
  const rsiFactor: FactorScore = rsiNow == null ? 0 : rsiNow >= 55 && rsiNow <= 75 ? 1 : rsiNow <= 45 && rsiNow >= 25 ? -1 : 0;
  addFactor("Wilder RSI 14", 20, rsiFactor, rsiNow == null ? "Unavailable" : `${round(rsiNow)}; 55–75 bullish, 25–45 bearish, extremes/neutral score 0`);
  addFactor("MACD 12–26", 8, macdValue == null || Math.abs(macdValue) < 0.000001 ? 0 : macdValue > 0 ? 1 : -1, macdValue == null ? "Unavailable" : String(round(macdValue)));
  const volumeFactor: FactorScore = volZ == null || volZ <= 1 ? 0 : last.close > (previous?.close ?? last.close) ? 1 : last.close < (previous?.close ?? last.close) ? -1 : 0;
  addFactor("High-volume direction", 20, volumeFactor, volZ == null ? "Unavailable" : `${round(volZ)}σ; scores only above 1σ`);
  const riskAdjustedReturn = ret30 == null || currentAtr == null || last.close <= 0 ? null : ret30 / Math.max(0.01, currentAtr / last.close * 100 * Math.sqrt(30));
  addFactor("ATR-adjusted 30-session trend", 20, riskAdjustedReturn == null || Math.abs(riskAdjustedReturn) < 0.5 ? 0 : riskAdjustedReturn > 0 ? 1 : -1, riskAdjustedReturn == null ? "Unavailable" : `${round(riskAdjustedReturn)} = 30-session return ÷ (ATR% × √30); this is the sole 30-session trend factor`);
  const scoring = factorScoreBreakdown(factors) ?? { rawScore: 0, redundancyAdjustment: 0, score: 0 };
  const signalScore = scoring.score; const direction = signalDecision(signalScore);
  const tradeDirection: "long" | "short" = signalScore >= 0 ? "long" : "short";
  const setupType = rsiNow != null && (rsiNow > 75 || rsiNow < 25) ? "Reversal" : Math.abs(ret30 ?? 0) > 10 ? "Breakout" : "Trend";
  const frozenLevels = currentAtr == null ? null : buildFrozenLevels(last.close, currentAtr, tradeDirection); const hasAtrInvalidation = frozenLevels != null; const invalidation = frozenLevels?.stopPrice ?? 0;
  const positiveReturns = returns.filter((r) => r.value != null && r.value > 0).length; const measured = returns.filter((r) => r.value != null).length;
  const thesis = `${direction === "long" ? "Bullish" : direction === "short" ? "Bearish" : "Mixed"} factor agreement at ${signalScore > 0 ? "+" : ""}${signalScore}. ${positiveReturns} of ${measured} standardized trading-session returns are positive; price is ${latestSma50 != null && last.close > latestSma50 ? "above" : "not above"} the 50-session trend.`;
  const failure = hasAtrInvalidation ? `${tradeDirection === "long" ? "Long" : "Short"} mechanical invalidation is ${tradeDirection === "long" ? "below" : "above"} ${round(invalidation)}, set ${SIGNAL_INVALIDATION_METHOD}. Targets are 1.5R and 2.5R reference levels, not forecasts.` : "Mechanical invalidation is unavailable because Wilder ATR-14 could not be computed from the source OHLC history.";
  const upVolume = daily.slice(-20).filter((p, i, a) => i > 0 && p.close > (a[i - 1]?.close ?? p.close)).reduce((s, p) => s + (p.volume ?? 0), 0); const downVolume = daily.slice(-20).filter((p, i, a) => i > 0 && p.close < (a[i - 1]?.close ?? p.close)).reduce((s, p) => s + (p.volume ?? 0), 0);
  const unusual = daily.slice(-20).filter((p) => { if (p.volume == null || volumes.length < 10) return false; const avgVol = average(volumes.slice(-20)) ?? Infinity; return p.volume > avgVol * 1.75; }).length;
  const gaps = daily.slice(-20).filter((p, i, a) => { const prev = a[i - 1]; return !!prev && p.open != null && prev.close !== 0 && Math.abs((p.open / prev.close) - 1) > 0.02; }).length;
  const smartMoney: Array<{ label: string; value: string; tone: "positive" | "negative" | "neutral"; detail: string }> = [
    { label: "Accumulation proxy", value: upVolume > downVolume ? "Positive" : "Negative", tone: upVolume > downVolume ? "positive" as const : "negative" as const, detail: "Compares volume on advancing vs declining sessions; it is not institutional ownership data." },
    { label: "Unusual-volume sessions", value: String(unusual), tone: "neutral" as const, detail: "Sessions above 1.75× the recent average; block ownership is not identifiable from OHLCV." },
    { label: "Opening gaps >2%", value: String(gaps), tone: "neutral" as const, detail: "Recent price gaps can indicate information arrival, but not who traded." },
    { label: "OBV proxy", value: obvNow == null ? "Unavailable" : (obvNow >= 0 ? "Accumulating" : "Distributing"), tone: obvNow == null ? "neutral" as const : obvNow >= 0 ? "positive" as const : "negative" as const, detail: "On-balance volume is a directional proxy, not dark-pool or 13F evidence." },
  ];
  const marketTime = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : `${last.date}T00:00:00.000Z`;
  const displayPrice = finite(meta.regularMarketPrice) ?? last.close;
  const quotePriceSource = finite(meta.regularMarketPrice) != null ? "regularMarketPrice" as const : "dailyBar" as const;
  const exchangeCalendar = exchangeCalendarFor(symbol, meta); const barTimestamp = exchangeCalendar === "24/7" ? `${last.date}T23:59:59.999Z` : newYorkCloseIso(last.date); const barState = "closed" as const;
  let acceptedIssuedCandidate: AcceptedSignalCandidate | null = null;
  if (shouldRecord && direction !== "mixed" && frozenLevels) {
    const issuance = await recordSignal(ctx, symbol, name, setupType, tradeDirection, Math.abs(signalScore), last.date, { factors, levels: frozenLevels, sourceAsOf: marketTime, barTimestamp, barState, sourceUrl: series.sourceUrl, exchangeCalendar, instrumentType: meta.instrumentType ?? "unknown" });
    acceptedIssuedCandidate = issuance.recorded ? issuance.acceptedCandidate : null;
  }
  const displayedScore = acceptedIssuedCandidate?.score ?? signalScore;
  const displayedDirection: "long" | "short" | "mixed" = acceptedIssuedCandidate?.direction ?? direction;
  const displayedFactors = acceptedIssuedCandidate?.factors ?? factors;
  const displayedLevels = acceptedIssuedCandidate?.levels ?? frozenLevels;
  const displayedRisk = displayedLevels?.atr14 ?? 0;
  const displayedInvalidation = displayedLevels?.stopPrice ?? 0;
  const displayedTarget1 = displayedLevels?.target1 ?? 0;
  const displayedTarget2 = displayedLevels?.target2 ?? 0;
  const priorClose = previous?.close; const change = priorClose ? displayPrice - priorClose : null; const changePercent = priorClose ? (displayPrice / priorClose - 1) * 100 : null;
  const summary = `${meta.instrumentType ?? "Listed instrument"} on ${meta.fullExchangeName ?? meta.exchangeName ?? "exchange unavailable"}.`;
  const sources = [{ title: `Yahoo Finance chart · ${symbol}`, url: series.sourceUrl }];
  const [[macroCrowdPricing, sentiment, edgarFilings, finnhubContext], valuation] = await Promise.all([dossierContextPromise, valuationPromise]);
  const crowdPricing = { ...macroCrowdPricing, sentiment };
  if (finnhubContext.insiders) for (const transaction of finnhubContext.insiders.transactions.slice(0, 8)) {
    const shareText = transaction.share == null ? "shares unavailable" : `${transaction.share.toLocaleString("en-US")} shares`;
    const changeText = transaction.change == null ? "change unavailable" : `change ${transaction.change.toLocaleString("en-US")}`;
    const priceText = transaction.transactionPrice == null ? "price unavailable" : `price ${transaction.transactionPrice}`;
    smartMoney.push({ label: `Reported insider filing · ${transaction.name}`, value: transaction.transactionCode, tone: "neutral", detail: `${shareText}; ${changeText}; ${priceText}; transaction ${transaction.transactionDate}; filed ${transaction.filingDate}. Finnhub snapshot as of ${finnhubContext.insiders.asOf}. Reported filing only; disclosure can lag the actual trade.` });
  }
  const finnhubFilingItems = finnhubContext.filings?.filings.map((filing) => ({ form: filing.form, filedDate: filing.filedDate, acceptedDate: filing.acceptedDate, accession: filing.accessionNumber, url: filing.reportUrl, source: "Finnhub" })) ?? [];
  const combinedFilingItems = [...edgarFilings.items, ...finnhubFilingItems].filter((item, index, rows) => rows.findIndex((candidate) => candidate.accession === item.accession && candidate.form === item.form) === index).sort((a, b) => b.filedDate.localeCompare(a.filedDate)).slice(0, 8);
  const secFilings: SecFilingsView = combinedFilingItems.length ? { state: "available", note: `Issuer filings from SEC EDGAR${finnhubFilingItems.length ? " supplemented by Finnhub" : ""}.`, asOf: [edgarFilings.asOf, finnhubContext.filings?.asOf ?? null].filter((value): value is string => !!value).sort().at(-1) ?? null, items: combinedFilingItems } : edgarFilings;
  const upcomingEarnings = finnhubContext.earnings?.events.filter((event) => event.symbol.toUpperCase() === symbol && event.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8) ?? [];
  const earningsCalendar = upcomingEarnings.length && finnhubContext.earnings ? { state: "available" as const, note: "Scheduled earnings events reported by Finnhub; dates are calendar context, not predictions.", asOf: finnhubContext.earnings.asOf, events: upcomingEarnings.map((event) => ({ ...event, source: "Finnhub" as const })) } : emptyFinnhubEarnings(finnhubContext.earnings ? `Finnhub snapshot as of ${finnhubContext.earnings.asOf} contains no upcoming ${symbol} event.` : `No Finnhub earnings snapshot is stored for ${symbol}.`);
  const valuationVerdict = valuation?.sections.find((section) => section.key === "verdict")?.verdict ?? "unavailable";
  const valuationFigures = valuation?.sections.flatMap((section) => section.metrics).filter((metric) => metric.status === "available").slice(0, 4).map((metric) => `${metric.label}: ${metric.value}`) ?? [];
  const positiveSmart = smartMoney.filter((item) => item.tone === "positive").length; const negativeSmart = smartMoney.filter((item) => item.tone === "negative").length;
  const smartVerdict = positiveSmart > negativeSmart ? "constructive" : negativeSmart > positiveSmart ? "cautious" : "neutral";
  const fearGreed = crowdPricing.sentiment?.value ?? null; const crowdVerdict = fearGreed == null ? "unavailable" : fearGreed >= 60 ? "risk-on" : fearGreed <= 40 ? "risk-off" : "neutral";
  const displayedBreakdown = factorScoreBreakdown(displayedFactors) ?? { rawScore: displayedScore, redundancyAdjustment: 0, score: displayedScore };
  const chartVerdict = displayedDirection === "long" ? "bullish" : displayedDirection === "short" ? "bearish" : "mixed";
  const sectionVerdicts = {
    chart: { verdict: chartVerdict, supportingFigures: [`Agreement ${displayedScore > 0 ? "+" : ""}${displayedScore}/100`, `RSI-14 ${rsiNow == null ? "unavailable" : round(rsiNow)}`, `MACD ${macdValue == null ? "unavailable" : round(macdValue)}`, displayedLevels ? `Invalidation ${round(displayedInvalidation)}` : "Invalidation unavailable"], interpretedLine: `${chartVerdict === "mixed" ? "The chart has no directional edge" : `The chart leans ${chartVerdict}`} because the accepted factor model reads ${displayedScore > 0 ? "+" : ""}${displayedScore}/100; ${displayedLevels ? `the read fails at ${round(displayedInvalidation)}` : "a mechanical failure level is unavailable"}.` },
    valuation: { verdict: valuationVerdict, supportingFigures: valuationFigures, interpretedLine: valuation ? `The valuation pipeline reads ${valuationVerdict}; the conclusion uses reported fundamentals and keeps missing fields explicit.` : "Valuation does not apply to this instrument." },
    smartMoney: { verdict: smartVerdict, supportingFigures: [`${positiveSmart} constructive reads`, `${negativeSmart} cautious reads`, `${smartMoney.length} total reads`], interpretedLine: `Smart-money proxies are ${smartVerdict}; these are filing and volume clues, not proof of institutional intent.` },
    crowd: { verdict: crowdVerdict, supportingFigures: [fearGreed == null ? "Fear & Greed unavailable" : `Fear & Greed ${round(fearGreed, 0)}`, `${crowdPricing.fedDecision.length} liquid Fed markets`, `${crowdPricing.macroContext.length} macro markets`], interpretedLine: `Positioning context is ${crowdVerdict}; crowd prices frame the macro backdrop and do not override the instrument signal.` },
  };
  const chartSide = displayedDirection === "long" ? 1 : displayedDirection === "short" ? -1 : 0;
  const smartSide = smartVerdict === "constructive" ? 1 : smartVerdict === "cautious" ? -1 : 0;
  // Only a directional witness can contest the chart/factor-model call. Valuation
  // and positioning remain context: rich/cheap/fair and risk-on/risk-off can
  // qualify a trade, but they do not express an instrument direction themselves.
  const directionalConflict = chartSide !== 0 && smartSide !== 0 && smartSide !== chartSide;
  const synthesisVerdict: "aligned_long" | "aligned_short" | "contested" | "mixed" = chartSide > 0 ? (directionalConflict ? "contested" : "aligned_long") : chartSide < 0 ? (directionalConflict ? "contested" : "aligned_short") : "mixed";
  const multiplesSection = valuation?.sections.find((section) => section.key === "multiples");
  const ownHistoryMissing = multiplesSection?.metrics.some((metric) => metric.label === "Own-history multiple" && metric.status === "missing") ?? false;
  const revenueQualitySupportive = valuation?.sections.find((section) => section.key === "revenue_quality")?.verdict === "supportive";
  const valuationLimits = [ownHistoryMissing ? "own-history multiple missing" : null, valuation?.status === "partial" ? "partial valuation input set" : null].filter((item): item is string => item != null);
  const limitsText = valuationLimits.length ? ` Limits: ${valuationLimits.join("; ")}.` : "";
  const fundamentalsText = revenueQualitySupportive ? " Reported revenue quality remains supportive." : "";
  const valuationCaveat = chartSide > 0 && valuationVerdict === "rich" ? `Mostly bullish: the chart/factor model leads, but valuation is rich on available peer/reverse-DCF comparisons — a technical trade, not a value trade.${limitsText}${fundamentalsText}` : chartSide < 0 && valuationVerdict === "cheap" ? `Mostly bearish: the chart/factor model leads, but valuation is cheap — the valuation cushion is a caveat to the directional call.${limitsText}${fundamentalsText}` : chartSide !== 0 ? `${chartVerdict === "bullish" ? "Bullish" : "Bearish"}; valuation is ${valuationVerdict}.${limitsText}${fundamentalsText}` : `Valuation is ${valuationVerdict}.${limitsText}${fundamentalsText}`;
  const directionalRead = synthesisVerdict === "contested" ? `Smart-money evidence is ${smartVerdict}, which directionally contradicts the ${chartVerdict} chart call.` : smartSide === chartSide && smartSide !== 0 ? `Smart-money evidence is ${smartVerdict}, confirming the ${chartVerdict} chart call.` : `Smart-money evidence is ${smartVerdict}, with no directional contradiction to the ${chartVerdict} chart call.`;
  const displayedFailure = displayedLevels ? `${displayedDirection === "long" ? "Long" : "Short"} mechanical invalidation is ${displayedDirection === "long" ? "below" : "above"} ${round(displayedInvalidation)}, set ${SIGNAL_INVALIDATION_METHOD}. Targets are 1.5R and 2.5R reference levels, not forecasts.` : failure;
  const synthesis = { verdict: synthesisVerdict, conclusion: `${name}: ${valuationCaveat} ${directionalRead} Positioning is ${crowdVerdict} context and does not veto the call.`, invalidation: displayedFailure };
  const quoteDate = marketTime.slice(0, 10);
  const freshness = quoteDate === last.date ? `Factor inputs as of ${last.date} — current with the ${quoteDate} quote.` : `Factor inputs as of ${last.date} — one trading session behind the ${quoteDate} quote.`;
  const responseFactors = displayedFactors.map((factor) => ({ ...factor, quality: factor.quality ?? "NO_DATA" as const, asOf: factor.asOf ?? last.date, source: factor.source ?? "Yahoo Finance chart", qualityReason: factor.qualityReason ?? "Quality metadata was unavailable; contribution remains explicit." }));
  return { status: "ok", error: null, privateCompany: null, commodity, instrument: { name, symbol, summary, price: displayPrice, currency, change: finite(change), changePercent: finite(changePercent), marketCap: null, asOf: marketTime, marketStatus: "Yahoo Finance delayed quote", barTimestamp, barState, quotePriceSource, resolvedFrom: null, resolutionMethod, sources }, chart, weekly, events: series.events, returns, indicators, pattern, factorModel: { score: displayedScore, rawScore: displayedBreakdown.rawScore, redundancyAdjustment: displayedBreakdown.redundancyAdjustment, freshness, direction: displayedDirection, label: displayedDirection === "mixed" ? "Mixed agreement" : `${displayedDirection === "long" ? "Long" : "Short"} agreement`, formula: "Raw = 100 × Σ(weight × score) ÷ Σ(weights). If all five trend-cluster factors (SMA-20/50/200, MACD, ATR-adjusted 30-session trend) are +1 or all are −1, subtract 5 points from absolute agreement. Final = raw + shown redundancy adjustment; factor scores are −1, 0, or +1.", disclaimer: "This measures factor agreement, NOT the probability that the trade profits.", factors: responseFactors }, walkForward: includeBacktest ? walkForwardFactorBacktest(daily) : null, thesis: acceptedIssuedCandidate ? `${displayedDirection === "long" ? "Bullish" : "Bearish"} accepted issuance at ${displayedScore > 0 ? "+" : ""}${displayedScore}; the displayed direction and levels are the immutable candidate that passed the final gate.` : thesis, failure: displayedFailure, levels: displayedLevels ? { entryLow: round(displayedLevels.entryPrice - displayedRisk * .25), entryHigh: round(displayedLevels.entryPrice + displayedRisk * .25), invalidation: round(displayedInvalidation), target1: round(displayedTarget1), target2: round(displayedTarget2), direction: displayedLevels.direction, atr14: round(displayedRisk, 4), invalidationAtrMultiple: displayedLevels.invalidationAtrMultiple, invalidationBasis: displayedLevels.invalidationBasis } : null, smartMoney, secFilings, earningsCalendar, crowdPricing, valuation, sectionVerdicts, synthesis };
}

type TapeSignal = {
  id: string; name: string; direction: "bullish" | "bearish"; active: boolean;
  aligned: number; conflicts: number; measured: number; evidenceTier: "thin" | "moderate" | "strong";
  alignmentScore: number | null; alignmentLabel: "HIGH" | "MEDIUM" | "LOW" | "NO RATING";
  checks: Array<{ label: string; status: "supports" | "conflicts" | "unavailable" }> ;
  empiricalRead: string; thesis: string; failure: string;
  entryLow: number | null; entryHigh: number | null; invalidation: number | null;
  target1: number | null; target2: number | null; invalidationBasis: string | null; unavailableReason: string | null;
};
function getMetric(rows: Array<{ label: string; value: number | null }>, label: string) { return rows.find((row) => row.label === label)?.value ?? null; }
function buildSignalTape(result: z.infer<typeof analyzeResponse>, spy: z.infer<typeof analyzeResponse> | null): TapeSignal[] {
  if (!result.instrument || !result.factorModel) return [];
  const price = result.instrument.price; const levels = result.levels; const ret7 = getMetric(result.returns, "7d"); const ret15 = getMetric(result.returns, "15d"); const ret30 = getMetric(result.returns, "30d"); const ret50 = getMetric(result.returns, "50d"); const ret90 = getMetric(result.returns, "90d");
  const spy30 = spy ? getMetric(spy.returns, "30d") : null; const spy90 = spy ? getMetric(spy.returns, "90d") : null;
  const rsiNow = getMetric(result.indicators, "RSI 14"); const volumeZ = getMetric(result.indicators, "Volume z"); const atrNow = getMetric(result.indicators, "ATR 14"); const ma20 = result.factorModel.factors.find((factor) => factor.name === "Price vs SMA 20")?.score ?? 0; const ma50 = result.factorModel.factors.find((factor) => factor.name === "Price vs SMA 50")?.score ?? 0; const ma200 = result.factorModel.factors.find((factor) => factor.name === "Price vs SMA 200")?.score ?? 0;
  const make = (id: string, name: string, direction: "bullish" | "bearish", rawChecks: Array<boolean | null>, rawLabels: string[], empiricalRead: string, thesis: string, failure: string, unavailableReason: string | null = null): TapeSignal => {
    const checks = Array.from({ length: 5 }, (_unused, index) => rawChecks[index] ?? null);
    const checkLabels = Array.from({ length: 5 }, (_unused, index) => rawLabels[index] ?? `Required evidence dimension ${index + 1}`);
    const measuredChecks = checks.filter((value): value is boolean => value != null); const measured = measuredChecks.length; const aligned = measuredChecks.filter(Boolean).length; const conflicts = measured - aligned;
    // Five required dimensions stay in the denominator. Missing evidence therefore contributes zero,
    // and a perfect score is possible only when all five dimensions are measured and supportive.
    const alignmentScore = measured >= 4 ? Math.round(aligned / 5 * 100) : null;
    const evidenceTier: TapeSignal["evidenceTier"] = measured === 5 && aligned === 5 ? "strong" : measured >= 4 && aligned >= 3 && conflicts <= 1 ? "moderate" : "thin";
    const alignmentLabel: TapeSignal["alignmentLabel"] = alignmentScore == null ? "NO RATING" : alignmentScore === 100 ? "HIGH" : alignmentScore >= 60 ? "MEDIUM" : "LOW";
    const risk = price != null && atrNow != null && atrNow > 0 ? atrNow : null; const entryLow = price != null && risk != null ? round(price - risk * 0.25) : levels?.entryLow ?? null; const entryHigh = price != null && risk != null ? round(price + risk * 0.25) : levels?.entryHigh ?? null; const midpoint = entryLow != null && entryHigh != null ? (entryLow + entryHigh) / 2 : null; const invalidation = midpoint != null && risk != null ? round(direction === "bullish" ? midpoint - risk * SIGNAL_INVALIDATION_ATR_MULTIPLE : midpoint + risk * SIGNAL_INVALIDATION_ATR_MULTIPLE) : null; const oneR = midpoint != null && invalidation != null ? Math.abs(midpoint - invalidation) : null; const target1 = midpoint != null && oneR != null ? round(midpoint + (direction === "bullish" ? 1 : -1) * 1.5 * oneR) : null; const target2 = midpoint != null && oneR != null ? round(midpoint + (direction === "bullish" ? 1 : -1) * 2.5 * oneR) : null;
    return { id, name, direction, active: !unavailableReason && alignmentScore != null && evidenceTier !== "thin", aligned, conflicts, measured, evidenceTier, alignmentScore, alignmentLabel, checks: checks.map((value, index) => ({ label: checkLabels[index] ?? `Required evidence dimension ${index + 1}`, status: value == null ? "unavailable" as const : value ? "supports" as const : "conflicts" as const })), empiricalRead, thesis, failure, entryLow, entryHigh, invalidation, target1, target2, invalidationBasis: invalidation == null ? null : SIGNAL_INVALIDATION_METHOD, unavailableReason: measured < 4 ? (unavailableReason ?? `Directional rating withheld: only ${measured} of 5 required dimensions are measured.`) : unavailableReason };
  };
  const direction: "bullish" | "bearish" = result.factorModel.direction === "short" ? "bearish" : "bullish"; const sign = direction === "bullish" ? 1 : -1;
  const horizonValues = [ret7, ret15, ret30, ret50, ret90];
  const momentum = make("momentum", "Multi-horizon momentum alignment", direction, horizonValues.map((value) => value == null ? null : sign * value > 0), ["7-session return", "15-session return", "30-session return", "50-session return", "90-session return"], `${horizonValues.filter((value) => value != null && sign * value > 0).length} of ${horizonValues.filter((value) => value != null).length} measured trading-session returns align ${direction}.`, "Continuation is favored only while multiple horizons keep the same sign.", "The setup fails when the 15- and 30-session returns both flip against the signal.");
  const rsAvailable = ret30 != null && ret90 != null && spy30 != null && spy90 != null;
  const rs30 = rsAvailable ? ret30 - spy30 : null; const rs90 = rsAvailable ? ret90 - spy90 : null;
  const rsDirection: "bullish" | "bearish" = (rs30 ?? 0) >= 0 ? "bullish" : "bearish"; const rsSign = rsDirection === "bullish" ? 1 : -1;
  const relative = make("relative-strength", "Relative-strength breakout vs SPY", rsDirection, [rs30 == null ? null : rsSign * rs30 > 0, rs90 == null ? null : rsSign * rs90 > 0, ret30 == null ? null : rsSign * ret30 > 0, ma50 === 0 ? null : ma50 === rsSign, volumeZ == null ? null : volumeZ >= 1], ["30-session excess return vs SPY", "90-session excess return vs SPY", "30-session absolute return", "Price vs SMA-50", "Latest volume z-score ≥ 1σ"], rsAvailable ? `Excess return vs SPY: ${round(rs30 ?? 0)}% over 30 sessions and ${round(rs90 ?? 0)}% over 90 sessions.` : "SPY comparison unavailable.", "Persistent positive ratio returns indicate leadership; negative readings indicate lag.", "Fails when both 30- and 90-session ratio returns cross against the signal.", rsAvailable ? null : "SPY or instrument history is unavailable");
  const volumeDirection: "bullish" | "bearish" = (ret7 ?? 0) >= 0 ? "bullish" : "bearish";
  const volume = make("volume-z", "Volume-z breakout", volumeDirection, [volumeZ == null ? null : volumeZ >= 1, ret7 == null ? null : (volumeDirection === "bullish" ? ret7 > 0 : ret7 < 0), rsiNow == null ? null : (volumeDirection === "bullish" ? rsiNow > 50 : rsiNow < 50), ma50 === 0 ? null : ma50 === (volumeDirection === "bullish" ? 1 : -1), ret30 == null ? null : (volumeDirection === "bullish" ? ret30 > 0 : ret30 < 0)], ["Latest volume z-score ≥ 1σ", "7-session return direction", "Wilder RSI-14 side of 50", "Price vs SMA-50", "30-session return direction"], volumeZ == null ? "Volume series unavailable." : `Latest volume z-score is ${round(volumeZ)}σ; direction is taken from the 7-session return.`, "Price direction backed by statistically elevated volume carries more evidence than price alone.", "Fails if follow-through reverses while volume z-score falls below 0.", volumeZ == null ? "Volume observations are unavailable" : null);
  const chart = result.chart; const bandwidths = chart.map((_point, index) => { if (index < 19) return null; const closes = chart.slice(index - 19, index + 1).map((p) => p.close); const mean = average(closes); if (mean == null || mean === 0) return null; const sd = Math.sqrt(closes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / closes.length); return 4 * sd / mean * 100; }).filter((value): value is number => value != null); const currentBw = bandwidths[bandwidths.length - 1] ?? null; const priorBw = bandwidths[bandwidths.length - 6] ?? null; const squeezeDirection: "bullish" | "bearish" = (ret7 ?? 0) >= 0 ? "bullish" : "bearish";
  const squeeze = make("squeeze", "Volatility squeeze → expansion", squeezeDirection, [currentBw == null || priorBw == null ? null : currentBw > priorBw, atrNow == null || price == null ? null : atrNow / price > 0.015, ret7 == null ? null : Math.abs(ret7) > 2, ma50 === 0 ? null : ma50 === (squeezeDirection === "bullish" ? 1 : -1), volumeZ == null ? null : volumeZ > 0], ["20-session bandwidth expanding", "Wilder ATR-14 above 1.5% of price", "Absolute 7-session return above 2%", "Price vs SMA-50", "Volume z-score above 0"], currentBw == null ? "Bollinger bandwidth unavailable." : `20-session Bollinger bandwidth is ${round(currentBw)}%${priorBw == null ? "." : ` versus ${round(priorBw)}% five sessions earlier.`}`, "Expansion after compression can sustain directional travel when price and ATR confirm.", "Fails if bandwidth contracts again and price returns inside the prior 20-session range.", currentBw == null ? "Insufficient chart history" : null);
  const maDirection: "bullish" | "bearish" = ma20 + ma50 + ma200 >= 0 ? "bullish" : "bearish"; const maSign = maDirection === "bullish" ? 1 : -1;
  const movingAverage = make("ma-stack", "Moving-average stack alignment", maDirection, [ma20 === 0 ? null : ma20 === maSign, ma50 === 0 ? null : ma50 === maSign, ma200 === 0 ? null : ma200 === maSign, ret30 == null ? null : maSign * ret30 > 0, volumeZ == null ? null : volumeZ >= 1], ["Price vs SMA-20", "Price vs SMA-50", "Price vs SMA-200", "30-session return direction", "Latest volume z-score ≥ 1σ"], `Price-vs-average votes: 20d ${ma20 > 0 ? "above" : ma20 < 0 ? "below" : "unavailable"}, 50d ${ma50 > 0 ? "above" : ma50 < 0 ? "below" : "unavailable"}, 200d ${ma200 > 0 ? "above" : ma200 < 0 ? "below" : "unavailable"}.`, "Stacked price relationships describe regime alignment, not timing certainty.", "Fails when price loses the 20- and 50-session averages against the setup.");
  const recent = chart.slice(-21); const priorRange = recent.slice(0, -1); const resistance = priorRange.length ? Math.max(...priorRange.map((p) => p.high ?? p.close)) : null; const support = priorRange.length ? Math.min(...priorRange.map((p) => p.low ?? p.close)) : null; const reclaimDirection: "bullish" | "bearish" = resistance != null && price != null && price >= resistance ? "bullish" : "bearish";
  const reclaim = make("reclaim", "Support / resistance reclaim", reclaimDirection, [price == null || resistance == null ? null : reclaimDirection === "bullish" ? price >= resistance : support != null ? price <= support : null, volumeZ == null ? null : volumeZ > 0, ret7 == null ? null : reclaimDirection === "bullish" ? ret7 > 0 : ret7 < 0, ma50 === 0 ? null : ma50 === (reclaimDirection === "bullish" ? 1 : -1), rsiNow == null ? null : reclaimDirection === "bullish" ? rsiNow > 50 : rsiNow < 50], ["Price beyond prior 20-session range", "Volume z-score above 0", "7-session return direction", "Price vs SMA-50", "Wilder RSI-14 side of 50"], support == null || resistance == null || price == null ? "20-session range unavailable." : `Price ${round(price)} versus prior 20-session support ${round(support)} and resistance ${round(resistance)}.`, "A close beyond the prior range is testable only if it holds on subsequent sessions.", "Fails on a daily close back inside the reclaimed range.", support == null || resistance == null ? "Insufficient OHLC history" : null);
  const earnings = make("pead", "Post-earnings drift continuation", direction, [null, null, null, null, null], ["Verified earnings timestamp", "Standardized earnings surprise", "Event-day abnormal return", "Post-event relative return", "Post-event volume confirmation"], "No verified earnings-event return series is available in the Yahoo chart response.", "PEAD requires a sourced earnings event and post-event abnormal returns.", "Not testable until an earnings event is sourced and aligned to trading sessions.", "Verified earnings-event series unavailable");
  momentum.active = momentum.active && momentum.aligned >= 3;
  relative.active = relative.active && rs30 != null && rs90 != null && rsSign * rs30 > 0 && rsSign * rs90 > 0;
  volume.active = volume.active && volumeZ != null && volumeZ >= 1;
  squeeze.active = squeeze.active && currentBw != null && priorBw != null && currentBw > priorBw;
  reclaim.active = reclaim.active && price != null && (reclaimDirection === "bullish" ? resistance != null && price >= resistance : support != null && price <= support);
  return [momentum, relative, volume, squeeze, earnings, movingAverage, reclaim];
}

const tradeShape = z.object({ id: z.number(), ticker: z.string(), direction: z.enum(["long", "short"]), entry: z.number(), exitPrice: z.number().nullable(), size: z.number(), thesis: z.string(), rMultiple: z.number().nullable(), notes: z.string(), setup: z.string(), tradeDate: z.string(), createdAt: z.string(), updatedAt: z.string() });
const tradeInput = z.object({ ticker: z.string().min(1), direction: z.enum(["long", "short"]), entry: z.number().positive(), exitPrice: z.number().positive().nullable(), size: z.number().positive(), thesis: z.string().min(1), rMultiple: z.number().nullable(), notes: z.string(), setup: z.string().min(1).max(80), tradeDate: z.string().min(8) });
const ruleShape = z.object({ id: z.number(), text: z.string(), checked: z.boolean(), sortOrder: z.number(), createdAt: z.string(), updatedAt: z.string() });
function mapTrade(row: typeof schema.trades.$inferSelect): z.infer<typeof tradeShape> { return { id: row.id, ticker: row.ticker, direction: row.direction, entry: row.entry, exitPrice: row.exitPrice, size: row.size, thesis: row.thesis, rMultiple: row.rMultiple, notes: row.notes, setup: row.setup, tradeDate: row.tradeDate, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function mapRule(row: typeof schema.tradingRules.$inferSelect): z.infer<typeof ruleShape> { return { id: row.id, text: row.text, checked: row.checked, sortOrder: row.sortOrder, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }

const secHeaders = { "User-Agent": "Muse Equity Analyzer support@meta.com", "Accept-Encoding": "gzip, deflate" };
const managers = [
  { name: "BlackRock", cik: "0002012383" }, { name: "Blackstone", cik: "0001393818" },
  { name: "Citadel Advisors", cik: "0001423053" }, { name: "JPMorgan Chase", cik: "0000019617" },
  { name: "Goldman Sachs", cik: "0000886982" }, { name: "Berkshire Hathaway", cik: "0001067983" },
  { name: "Bridgewater", cik: "0001350694" }, { name: "Renaissance Technologies", cik: "0001037389" },
  { name: "Coatue", cik: "0001135730" }, { name: "Tiger Global", cik: "0001167483" },
];
type SecRecent = { form: string[]; accessionNumber: string[]; primaryDocument: string[]; filingDate: string[]; reportDate: string[] };
type SecSubmissionFile = { name?: string; filingFrom?: string; filingTo?: string };
type SecSubmission = { name?: string; filings?: { recent?: SecRecent; files?: SecSubmissionFile[] } };
type SecIndex = { directory?: { item?: Array<{ name?: string }> } };
type FilingRow = { accession: string; primary: string; filingDate: string; reportDate: string };
type Holding = { issuer: string; value: number; shares: number };
function xmlTag(xml: string, tag: string): string | null { const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i")); return m?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null; }
function decodeXml(v: string) { return v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'); }
function decodeDocumentText(value: string) {
  return decodeXml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/tr|\/td|\/li|\/h\d)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}
function cleanReportingPerson(value: string): string | null {
  const cleaned = value.replace(/^\s*[:;,.\-–—]+\s*/, "").replace(/^This Statement is being filed by\s+/i, "").replace(/\s+\d{2}-\d{7}\b.*$/, "").replace(/\s+\((?:each|collectively)\b.*$/i, "").replace(/\s+\d+\s*\([a-z]\)\s*$/i, "").replace(/\s+[-–—]\s*$/, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 180 || /^(?:check|sec use|address|item\s+\d|i\.?r\.?s\.? identification)/i.test(cleaned)) return null;
  return cleaned;
}
function reportingPersonName(document: string): string | null {
  for (const tag of ["reportingPersonName", "nameOfReportingPerson"]) { const tagged = xmlTag(document, tag); const cleaned = tagged ? cleanReportingPerson(decodeDocumentText(tagged)) : null; if (cleaned) return cleaned; }
  const text = decodeDocumentText(document); const flat = text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ");
  const personFiling = flat.match(/Name of person filing\s*:?\s*(.+?)(?=\s+\(?b\)?\s*(?:Address|Principal business)|\s+Address or principal|\s+Citizenship|\s+Item\s+3\b)/i)?.[1];
  const filingName = personFiling ? cleanReportingPerson(personFiling) : null; if (filingName) return filingName;
  const coverName = flat.match(/NAMES? OF REPORTING PERSONS?(?:\s+I\.?R\.?S\.? IDENTIFICATION NO\.? OF ABOVE PERSONS\s*\(ENTITIES ONLY\))?\s+(.+?)(?=\s+(?:2\.?\s*)?CHECK THE APPROPRIATE BOX)/i)?.[1];
  return coverName ? cleanReportingPerson(coverName) : null;
}
function normalizeIssuer(value: string) { return value.toLowerCase().replace(/&/g, "and").replace(/\b(incorporated|inc|corp|corporation|company|co|plc|ltd|class|holdings|holding|technologies|technology)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim(); }
async function secJson<T>(url: string): Promise<T> { const r = await fetch(url, { headers: secHeaders }); if (!r.ok) throw new Error(`SEC ${r.status}`); return await r.json() as T; }
type SecFilingsView = { state: "available" | "no_data"; note: string; asOf: string | null; items: Array<{ form: string; filedDate: string; acceptedDate: string | null; accession: string; url: string; source: string }> };
const secTickerCache: { expiresAt: number; value: Record<string, { cik_str: number; ticker: string }> | null } = { expiresAt: 0, value: null };
const secFilingsCache = new Map<string, { expiresAt: number; value: SecFilingsView }>();
function emptySecFilings(note: string): SecFilingsView { return { state: "no_data", note, asOf: null, items: [] }; }
async function cachedSecTickerMap() {
  if (secTickerCache.value && secTickerCache.expiresAt > Date.now()) return secTickerCache.value;
  const value = await secJson<Record<string, { cik_str: number; ticker: string }>>("https://www.sec.gov/files/company_tickers.json");
  secTickerCache.value = value; secTickerCache.expiresAt = Date.now() + 24 * 60 * 60_000; return value;
}
async function recentSecFilings(symbol: string): Promise<SecFilingsView> {
  const normalized = symbol.toUpperCase(); const cached = secFilingsCache.get(normalized); if (cached && cached.expiresAt > Date.now()) return cached.value;
  let value: SecFilingsView;
  try {
    const map = await cachedSecTickerMap(); const issuer = Object.values(map).find((row) => row.ticker.toUpperCase() === normalized);
    if (!issuer) value = emptySecFilings(`No SEC CIK mapping exists for ${normalized}; ETFs and non-US listings may not have issuer submissions.`);
    else {
      const cik10 = String(issuer.cik_str).padStart(10, "0"); const submission = await secJson<SecSubmission>(`https://data.sec.gov/submissions/CIK${cik10}.json`); const recent = submission.filings?.recent;
      const items = recent ? recent.form.flatMap((form, index) => { const accession = recent.accessionNumber[index] ?? ""; const filedDate = recent.filingDate[index] ?? ""; if (!form || !accession || !filedDate) return []; const accessionPath = accession.replace(/-/g, ""); return [{ form, filedDate, acceptedDate: null, accession, url: `https://www.sec.gov/Archives/edgar/data/${issuer.cik_str}/${accessionPath}/`, source: "SEC EDGAR" }]; }).slice(0, 5) : [];
      value = items.length ? { state: "available", note: `Five most recent issuer submissions from SEC EDGAR for ${normalized}.`, asOf: new Date().toISOString(), items } : emptySecFilings(`SEC EDGAR returned no recent issuer filings for ${normalized}.`);
    }
  } catch { value = emptySecFilings(`SEC EDGAR was unreachable for ${normalized}; no filing rows are inferred.`); }
  secFilingsCache.set(normalized, { expiresAt: Date.now() + 15 * 60_000, value }); return value;
}
async function secText(url: string): Promise<string> { const r = await fetch(url, { headers: secHeaders }); if (!r.ok) throw new Error(`SEC ${r.status}`); return await r.text(); }
function filingRows(recent: SecRecent | undefined, form: string): FilingRow[] { if (!recent) return []; const out: FilingRow[] = []; recent.form.forEach((f, i) => { if (f === form) out.push({ accession: recent.accessionNumber[i] ?? "", primary: recent.primaryDocument[i] ?? "", filingDate: recent.filingDate[i] ?? "", reportDate: recent.reportDate[i] ?? "" }); }); return out; }
function newestFirst(rows: FilingRow[]) {
  const unique = new Map<string, FilingRow>(); for (const row of rows) if (row.accession && !unique.has(row.accession)) unique.set(row.accession, row);
  return [...unique.values()].sort((a, b) => b.reportDate.localeCompare(a.reportDate) || b.filingDate.localeCompare(a.filingDate));
}
async function latest13FFilings(manager: { cik: string }, count = 2): Promise<FilingRow[]> {
  const submission = await secJson<SecSubmission>(`https://data.sec.gov/submissions/CIK${manager.cik}.json`); let rows = filingRows(submission.filings?.recent, "13F-HR");
  if (rows.length < count) {
    const files = [...(submission.filings?.files ?? [])].sort((a, b) => (b.filingTo ?? "").localeCompare(a.filingTo ?? ""));
    for (const file of files) {
      if (!file.name) continue;
      try { rows = rows.concat(filingRows(await secJson<SecRecent>(`https://data.sec.gov/submissions/${encodeURIComponent(file.name)}`), "13F-HR")); } catch { /* A missing archive must not make an older recent filing look current. */ }
      if (newestFirst(rows).length >= count) break;
    }
  }
  return newestFirst(rows).slice(0, count);
}
async function infoTable(cik: string, accession: string): Promise<{ holdings: Holding[]; url: string }> {
  const accessionPlain = accession.replace(/-/g, ""); const cikPlain = String(Number(cik));
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikPlain}/${accessionPlain}/index.json`;
  const index = await secJson<SecIndex>(indexUrl); const files = index.directory?.item ?? [];
  const file = files.find((x) => x.name?.toLowerCase().endsWith(".xml") && !x.name.toLowerCase().includes("primary") && !x.name.toLowerCase().includes("xsl"));
  if (!file?.name) throw new Error("13F information table not found");
  const url = `https://www.sec.gov/Archives/edgar/data/${cikPlain}/${accessionPlain}/${file.name}`; const xml = await secText(url);
  const blocks = xml.match(/<(?:\w+:)?infoTable\b[\s\S]*?<\/(?:\w+:)?infoTable>/gi) ?? [];
  const holdings = blocks.map((b) => ({ issuer: decodeXml(xmlTag(b, "nameOfIssuer") ?? ""), value: Number(xmlTag(b, "value") ?? 0), shares: Number(xmlTag(b, "sshPrnamt") ?? 0) })).filter((h) => h.issuer && Number.isFinite(h.value));
  return { holdings, url };
}
async function managerHolding(manager: { name: string; cik: string }, issuerName: string) {
  const filings = await latest13FFilings(manager); const currentFiling = filings[0]; const previousFiling = filings[1]; if (!currentFiling) return null;
  const latest = await infoTable(manager.cik, currentFiling.accession); const previous = previousFiling ? await infoTable(manager.cik, previousFiling.accession).catch(() => null) : null;
  const needle = normalizeIssuer(issuerName); const lead = needle.split(" ").slice(0, 2).join(" ");
  const match = (rows: Holding[]) => rows.filter((h) => { const n = normalizeIssuer(h.issuer); return n === needle || n.startsWith(lead) || needle.startsWith(n); }).reduce((a, h) => ({ issuer: h.issuer, value: a.value + h.value, shares: a.shares + h.shares }), { issuer: "", value: 0, shares: 0 });
  const current = match(latest.holdings); const prior = previous ? match(previous.holdings) : { issuer: "", value: 0, shares: 0 }; if (!current.value && !prior.value) return null;
  const total = latest.holdings.reduce((s, h) => s + h.value, 0); const change = prior.shares === 0 && current.shares > 0 ? "New stake" : current.shares === 0 && prior.shares > 0 ? "Exited" : current.shares > prior.shares ? "Added" : current.shares < prior.shares ? "Trimmed" : "Unchanged";
  const changePct = prior.shares > 0 ? ((current.shares / prior.shares) - 1) * 100 : null;
  return { manager: manager.name, reportDate: currentFiling.reportDate, filingDate: currentFiling.filingDate, value: current.value, shares: current.shares, portfolioPct: total ? (current.value / total) * 100 : null, change, changePct: finite(changePct), sourceUrl: latest.url };
}
async function insiderRows(cik: string) {
  const sub = await secJson<SecSubmission>(`https://data.sec.gov/submissions/CIK${cik}.json`); const filings = filingRows(sub.filings?.recent, "4").slice(0, 12);
  const rows = await Promise.all(filings.map(async (f) => { try { const cikPlain = String(Number(cik)); const url = `https://www.sec.gov/Archives/edgar/data/${cikPlain}/${f.accession.replace(/-/g, "")}/${f.primary.split("/").pop() ?? f.primary}`; const xml = await secText(url); const owner = decodeXml(xmlTag(xml, "rptOwnerName") ?? "Unknown insider"); const title = decodeXml(xmlTag(xml, "officerTitle") ?? (xmlTag(xml, "isDirector") === "1" ? "Director" : "Insider")); const txBlocks = xml.match(/<(?:\w+:)?nonDerivativeTransaction\b[\s\S]*?<\/(?:\w+:)?nonDerivativeTransaction>/gi) ?? []; const tx = txBlocks.map((b) => ({ code: xmlTag(b, "transactionCode") ?? "", date: xmlTag(b, "transactionDate") ?? f.filingDate, shares: Number(xmlTag(b, "transactionShares") ?? 0), price: Number(xmlTag(b, "transactionPricePerShare") ?? 0), acquired: xmlTag(b, "transactionAcquiredDisposedCode") ?? "" })).find((x) => x.code === "P" || x.code === "S"); if (!tx) return null; return { owner, title, date: tx.date, type: tx.code === "P" ? "Buy" as const : "Sell" as const, shares: tx.shares, price: finite(tx.price), sourceUrl: url }; } catch { return null; } }));
  return rows.filter((r): r is NonNullable<typeof r> => r != null);
}

function agreementBand(value: number) { const magnitude = Math.abs(value); return magnitude >= 80 ? "80–100 alignment" : magnitude >= 65 ? "65–79 alignment" : "0–64 alignment"; }
type SignalSettlementRun = {
  updatedRows: number;
  filledHorizons: number;
  pendingRows: number;
  failures: string[];
};
async function scoreTrackedSignals(ctx: Ctx): Promise<SignalSettlementRun> {
  // Phase 1.1 freezes the legacy 5/14/30 columns. They mixed estimands and used
  // date-only alignment. Versioned reconciliation is now the only settlement
  // writer; this compatibility result keeps the scheduled snapshot action stable.
  const rows = await ctx.db<typeof schema>().select({ id: schema.trackedSignals.id }).from(schema.trackedSignals);
  return { updatedRows: 0, filledHorizons: 0, pendingRows: rows.length, failures: [] };
}


type LiveTrackerState = { trackedCount: number; openCount: number; settledCount: number; ambiguousCount: number; unverifiedCount: number; settledIds: Set<number>; current: Map<string, typeof schema.signalEvaluationRevisions.$inferSelect> };
export async function readLiveTrackerState(ctx: Ctx): Promise<LiveTrackerState> {
  const db = ctx.db<typeof schema>();
  const [allSignals, revisions] = await Promise.all([
    db.select().from(schema.trackedSignals),
    db.select().from(schema.signalEvaluationRevisions).orderBy(asc(schema.signalEvaluationRevisions.id)),
  ]);
  const signals = allSignals.filter((signal) => signal.strategyId === SIGNAL_STRATEGY_ID && signal.strategyVersion === SIGNAL_STRATEGY_VERSION && signal.parameterHash === SIGNAL_PARAMETER_HASH && signal.primaryHorizon === 30 && signal.horizonUnit === "trading_sessions" && signal.priceBasis === cohortDescriptor.priceConvention && signal.entryRule === "Reference entry equals the completed adjusted daily close; paper execution is not claimed");
  const current = acceptedEvaluationRevisionsForCohort(revisions, activeCohortKeys);
  const setupRows = signals.map((signal) => current.get(`${signal.id}|trade_setup`));
  const settledIds = new Set(setupRows.filter((row) => row && (row.verdict === "HIT" || row.verdict === "MISS" || row.verdict === "TIME_EXIT")).map((row) => row?.signalId).filter((id): id is number => id != null));
  const ambiguousCount = setupRows.filter((row) => row?.verdict === "AMBIGUOUS").length;
  const unverifiedCount = setupRows.filter((row) => row?.verdict === "UNVERIFIED").length;
  const openCount = setupRows.filter((row) => !row || row.verdict === "OPEN").length;
  return { trackedCount: signals.length, openCount, settledCount: settledIds.size, ambiguousCount, unverifiedCount, settledIds, current };
}
function withLiveTrackerCounts(_summary: string, state: LiveTrackerState): string {
  return `${state.trackedCount} issued: ${state.openCount} open, ${state.settledCount} resolved, ${state.ambiguousCount} ambiguous, ${state.unverifiedCount} unverified under evaluator ${SIGNAL_EVALUATOR_VERSION}. Daily proximity counts and interim marks are non-settling diagnostics; legacy 5/14/30-session settlement text is intentionally not carried into this read model.`;
}
async function insertAlert(ctx: Ctx, symbol: string, kind: string, message: string, day: string, sourceUrl: string | null = null, fingerprintOverride?: string) {
  const fingerprint = fingerprintOverride ?? `${symbol}|${kind}|${day}`;
  await ctx.db<typeof schema>().insert(schema.alerts).values({ symbol, kind, message, sourceUrl, fingerprint }).onConflictDoNothing({ target: schema.alerts.fingerprint });
  return 1;
}


const pageRequestFields = { limit: z.number().int().min(1).max(100).optional(), cursor: z.number().int().min(0).nullable().optional() };
function pageSlice<T>(items: T[], limit = 20, cursor: number | null | undefined = null): { items: T[]; nextCursor: number | null } {
  const start = cursor ?? 0; const page = items.slice(start, start + limit); const next = start + page.length;
  return { items: page, nextCursor: next < items.length ? next : null };
}

const sourceTierSchema = z.enum(["PRIMARY", "STANDARD", "LOW_TIER"]);
type SourceTier = z.infer<typeof sourceTierSchema>;
const LOW_TIER_DOMAINS = ["walletinvestor.com", "thecerbatgem.com", "americanbankingnews.com", "defenseworld.net", "etfdailynews.com", "stockinvest.us"];
function sourceTier(url: string, text = ""): SourceTier {
  let host = ""; try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "LOW_TIER"; }
  if (LOW_TIER_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return "LOW_TIER";
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (/##|\b(?:price prediction|stock forecast)\b.*\b(?:2030|2040|2050)\b|(?:\$[A-Z]{1,6}){4,}/i.test(normalizedText)) return "LOW_TIER";
  if (/^(?:www\.)?(?:sec\.gov|data\.sec\.gov)$/i.test(host)) return "PRIMARY";
  return "STANDARD";
}
function sortNewsItems<T extends { publishedAt: string; tier: SourceTier }>(items: T[]): T[] {
  const rank: Record<SourceTier, number> = { PRIMARY: 0, STANDARD: 1, LOW_TIER: 2 };
  return [...items].sort((a, b) => rank[a.tier] - rank[b.tier] || (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
}
function companyMatchText(companyName: string): string[] {
  const normalized = companyName.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const generic = new Set(["inc", "incorporated", "corp", "corporation", "company", "co", "plc", "ltd", "limited", "holdings", "holding", "group", "the", "class"]);
  const tokens = normalized.split(" ").filter((token) => token.length >= 3 && !generic.has(token));
  return [...new Set([normalized, tokens.slice(0, 2).join(" "), tokens[0] ?? ""].filter((value) => value.length >= 3))];
}
function expectedExchangePattern(symbol: string): string {
  if (/\.AX$/i.test(symbol)) return "ASX";
  if (/\.TO$/i.test(symbol)) return "TSX";
  if (/\.V$/i.test(symbol)) return "TSXV";
  if (/\.L$/i.test(symbol)) return "LSE";
  return "(?:NYSE|NASDAQ|AMEX|ARCA|BATS|CBOE)";
}
function webResultMatchesCompany(title: string, snippet: string, companyName: string, symbol: string): boolean {
  const haystack = `${title} ${snippet}`.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9:]+/g, " ");
  if (companyMatchText(companyName).some((variant) => haystack.includes(variant))) return true;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${expectedExchangePattern(symbol)}\\s*:?\\s*${escaped}\\b`, "i").test(`${title} ${snippet}`);
}
const newsItemSchema = z.object({ id: z.string(), title: z.string(), url: z.string(), source: z.string(), publishedAt: z.string(), timestampKind: z.enum(["published", "retrieved"]), tier: sourceTierSchema, whyItMatters: z.string(), ripples: z.array(z.string()), confirmation: z.string() });
const cachedNewsSchema = z.object({ retrievedAt: z.string(), items: z.array(newsItemSchema) });
type SecSearchPayload = { hits?: { hits?: Array<{ _id?: string; _source?: { entity_name?: string; file_date?: string; root_forms?: string[]; display_names?: string[] } }> } };
async function secFullTextEvidence(symbol: string, retrievedAt: string) {
  const end = retrievedAt.slice(0, 10); const start = new Date(Date.parse(`${end}T00:00:00Z`) - 45 * 86400000).toISOString().slice(0, 10);
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${symbol}"`)}&dateRange=custom&startdt=${start}&enddt=${end}&forms=8-K,10-K,SC%2013D,SC%2013D%2FA`;
  try {
    const response = await fetch(url, { headers: secHeaders }); if (!response.ok) return [];
    const payload = await response.json() as SecSearchPayload;
    return (payload.hits?.hits ?? []).slice(0, 4).flatMap((hit) => {
      const source = hit._source; const form = source?.root_forms?.[0] ?? "SEC filing"; const filed = source?.file_date ?? retrievedAt; const issuer = source?.entity_name ?? source?.display_names?.[0] ?? symbol;
      return hit._id ? [{ id: `sec-${hit._id}`, title: `${form} · ${issuer}`, url, source: "SEC EDGAR full-text", publishedAt: filed, timestampKind: "published" as const, whyItMatters: `Primary filing matched ${symbol}; open the SEC result before treating a narrative claim as confirmed.`, ripples: [symbol, form], tier: "PRIMARY" as const, confirmation: "Primary-source filing · claim-level corroboration still required" }] : [];
    });
  } catch { return []; }
}
async function marketNews(ctx: Ctx, view: "symbol" | "discovery", symbol: string | null, companyName: string | null = null) {
  const db = ctx.db<typeof schema>(); const cacheKey = `${view}:${symbol?.trim().toUpperCase() ?? "market"}:${companyName?.trim().toLowerCase() ?? ""}`; const now = new Date();
  const finnhubSymbols = view === "symbol" && symbol ? [symbol.toUpperCase(), "MARKET"] : ["MARKET"];
  const finnhubSnapshots = await latestFreshFinnhubNews(ctx, finnhubSymbols);
  const finnhubItems = finnhubSnapshots.flatMap((snapshot) => parseFinnhubNews(snapshot.articlesJson).map((article, index) => ({ id: `finnhub-${snapshot.ticker}-${index}-${article.url}`, title: article.headline, url: article.url, source: "Finnhub", publishedAt: article.publishedAt, timestampKind: "published" as const, whyItMatters: article.summary || "Open the linked article for context.", ripples: snapshot.ticker === "MARKET" ? [] : [snapshot.ticker], tier: "STANDARD" as const, confirmation: `Primary Finnhub news source · snapshot as of ${snapshot.asOf} · publisher ${article.source}` })));
  const cached = (await db.select().from(schema.sharedNewsCache).where(eq(schema.sharedNewsCache.cacheKey, cacheKey)))[0];
  if (cached && cached.expiresAt.getTime() > now.getTime()) { const parsed = cachedNewsSchema.safeParse(JSON.parse(cached.payloadJson)); if (parsed.success) return { view, symbol, ...parsed.data, items: sortNewsItems([...finnhubItems, ...parsed.data.items.filter((item) => !finnhubItems.some((fresh) => fresh.url === item.url))]).slice(0, 16) }; }
  const retrievedAt = now.toISOString(); const day = retrievedAt.slice(0, 10);
  const query = view === "symbol" ? `${symbol ?? "market"} ${companyName ?? ""} latest company stock commodity news ${day}` : `${day} key market developments macro earnings biggest movers commodities`;
  const [search, secRows] = await Promise.all([ctx.tool.web_search(query), view === "symbol" && symbol ? secFullTextEvidence(symbol.toUpperCase(), retrievedAt) : Promise.resolve([])]);
  const sourceRows = (search.content?.results ?? []).filter((x) => !x.is_index_page && x.url).filter((x) => view !== "symbol" || (!!symbol && !!companyName && webResultMatchesCompany(x.title, x.snippet ?? "", companyName, symbol))).slice(0, 8);
  const compact = sourceRows.map((row, index) => `[${index + 1}] ${row.title}\nSource: ${row.source ?? "Unknown source"}\nPublished: ${row.published_at ?? "not supplied"}\nSnippet: ${row.snippet ?? ""}`).join("\n\n");
  let interpretations: Array<{ index: number; why: string; ripples: string[] }> = [];
  if (compact) try {
    interpretations = await ctx.inference.complete(`For each market-news result below, write one restrained sentence explaining why it matters to an investor, using only the supplied title and snippet. Add up to four concise ripple tags naming affected listed symbols, commodities, macro variables, or sectors. Do not add facts.\n\n${compact}`, { schema: z.array(z.object({ index: z.number().int().min(1), why: z.string(), ripples: z.array(z.string()).max(4) })) });
  } catch { /* source rows remain useful without generated interpretation */ }
  const webItems = sourceRows.map((row, index) => { const interpreted = interpretations.find((x) => x.index === index + 1); return { id: `${view}-${index}-${row.url}`, title: row.title, url: row.url ?? "", source: row.source ?? "Unknown source", publishedAt: row.published_at ?? retrievedAt, timestampKind: row.published_at ? "published" as const : "retrieved" as const, whyItMatters: interpreted?.why ?? "Interpretation unavailable; open the source for context.", ripples: interpreted?.ripples ?? [], tier: sourceTier(row.url ?? "", `${row.title} ${row.snippet ?? ""}`), confirmation: "Single-source result · unconfirmed" }; });
  const items = sortNewsItems([...finnhubItems, ...secRows, ...webItems.filter((item) => !finnhubItems.some((fresh) => fresh.url === item.url))]).slice(0, 16); const expiresAt = new Date(now.getTime() + 15 * 60_000);
  await db.insert(schema.sharedNewsCache).values({ cacheKey, view, symbol: symbol?.toUpperCase() ?? null, payloadJson: JSON.stringify({ retrievedAt, items }), retrievedAt: now, expiresAt }).onConflictDoUpdate({ target: schema.sharedNewsCache.cacheKey, set: { payloadJson: JSON.stringify({ retrievedAt, items }), retrievedAt: now, expiresAt } });
  return { view, symbol, retrievedAt, items };
}

const predictionInput = z.object({ ticker: z.string().min(1).max(20), direction: z.enum(["above", "below"]), targetLevel: z.number().positive().nullable(), dueDate: z.string().min(10).max(10) });
const rippleInput = z.object({ from: z.string().min(1).max(80), to: z.string().min(1).max(80), because: z.string().min(1).max(300) });
const theoryInput = z.object({ statement: z.string().min(5).max(1000), horizon: z.enum(["short", "long"]), linkedTickers: z.array(z.string().min(1).max(20)).min(1).max(12), predictions: z.array(predictionInput).min(1).max(20), ripples: z.array(rippleInput).max(20) });
const sentimentArticleInput = z.object({ title: z.string().min(1).max(1000), url: z.string().url(), publishedAt: z.string().min(1).max(80), source: z.string().min(1).max(240), overallScore: z.number().finite(), overallLabel: z.string().min(1).max(120), tickerScore: z.number().finite(), tickerLabel: z.string().min(1).max(120) });
const finnhubNewsArticleInput = z.object({ headline: z.string().min(1).max(1000), summary: z.string().max(8000), url: z.string().url(), source: z.string().min(1).max(240), publishedAt: z.string().min(1).max(80) });
const finnhubInsiderTransactionInput = z.object({ name: z.string().min(1).max(300), share: z.number().finite().nullable(), change: z.number().finite().nullable(), filingDate: z.string().min(1).max(40), transactionDate: z.string().min(1).max(40), transactionPrice: z.number().finite().nullable(), transactionCode: z.string().min(1).max(40) });
const finnhubEarningsEventInput = z.object({ symbol: z.string().min(1).max(30), date: z.string().min(1).max(40), epsEstimate: z.number().finite().nullable(), epsActual: z.number().finite().nullable(), revenueEstimate: z.number().finite().nullable(), revenueActual: z.number().finite().nullable(), quarter: z.number().finite().nullable() });
const finnhubFilingInput = z.object({ form: z.string().min(1).max(80), filedDate: z.string().min(1).max(40), acceptedDate: z.string().min(1).max(80), reportUrl: z.string().url(), accessionNumber: z.string().min(1).max(120) });
type SentimentArticle = z.infer<typeof sentimentArticleInput>;
type FinnhubNewsArticle = z.infer<typeof finnhubNewsArticleInput>;
type FinnhubInsiderTransaction = z.infer<typeof finnhubInsiderTransactionInput>;
type FinnhubEarningsEvent = z.infer<typeof finnhubEarningsEventInput>;
type FinnhubFiling = z.infer<typeof finnhubFilingInput>;
const sentimentEvidenceView = z.object({ id: z.number(), ticker: z.string(), stance: z.enum(["confirming", "challenging", "neutral"]), title: z.string(), source: z.literal("Alpha Vantage"), publisher: z.string(), url: z.string(), publishedAt: z.string(), asOf: z.string(), overallScore: z.number(), overallLabel: z.string(), tickerScore: z.number(), tickerLabel: z.string(), kind: z.literal("sentiment") });
const predictionView = z.object({ id: z.number(), ticker: z.string(), direction: z.enum(["above", "below"]), targetLevel: z.number().nullable(), dueDate: z.string(), snapshotPrice: z.number().nullable(), currentPrice: z.number().nullable(), progress: z.number().nullable(), status: z.enum(["confirming", "challenged", "refuted"]), detail: z.string() });
const theoryView = z.object({ id: z.number(), statement: z.string(), horizon: z.enum(["short", "long"]), linkedTickers: z.array(z.string()), snapshots: z.record(z.string(), z.number().nullable()), status: z.enum(["confirming", "challenged", "refuted"]), predictions: z.array(predictionView), ripples: z.array(z.object({ id: z.number(), from: z.string(), to: z.string(), because: z.string() })), evidence: z.array(z.object({ id: z.number(), stance: z.enum(["confirming", "challenging", "neutral"]), title: z.string(), source: z.string(), publisher: z.string().nullable(), url: z.string(), publishedAt: z.string().nullable(), createdAt: z.string(), asOf: z.string().nullable(), overallScore: z.number().nullable(), overallLabel: z.string().nullable(), tickerScore: z.number().nullable(), tickerLabel: z.string().nullable(), kind: z.enum(["article", "sentiment"]) })), createdAt: z.string(), updatedAt: z.string() });
function jsonStrings(value: string): string[] { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []; } catch { return []; } }
function jsonPrices(value: string): Record<string, number | null> { try { const parsed: unknown = JSON.parse(value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}; const out: Record<string, number | null> = {}; for (const [key, item] of Object.entries(parsed)) out[key] = typeof item === "number" && Number.isFinite(item) ? item : null; return out; } catch { return {}; } }
function parseSentimentArticles(value: string): SentimentArticle[] { try { const parsed = z.array(sentimentArticleInput).safeParse(JSON.parse(value)); return parsed.success ? parsed.data : []; } catch { return []; } }
function parseFinnhubNews(value: string): FinnhubNewsArticle[] { try { const parsed = z.array(finnhubNewsArticleInput).safeParse(JSON.parse(value)); return parsed.success ? parsed.data : []; } catch { return []; } }
function parseFinnhubInsiders(value: string): FinnhubInsiderTransaction[] { try { const parsed = z.array(finnhubInsiderTransactionInput).safeParse(JSON.parse(value)); return parsed.success ? parsed.data : []; } catch { return []; } }
function parseFinnhubEarnings(value: string): FinnhubEarningsEvent[] { try { const parsed = z.array(finnhubEarningsEventInput).safeParse(JSON.parse(value)); return parsed.success ? parsed.data : []; } catch { return []; } }
function parseFinnhubFilings(value: string): FinnhubFiling[] { try { const parsed = z.array(finnhubFilingInput).safeParse(JSON.parse(value)); return parsed.success ? parsed.data : []; } catch { return []; } }
function isFreshWithin48Hours(asOf: string, now = Date.now()): boolean { const timestamp = Date.parse(asOf); return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 48 * 60 * 60 * 1000; }
async function latestFreshFinnhubNews(ctx: Ctx, tickers: string[]): Promise<Array<typeof schema.finnhubNewsSnapshots.$inferSelect>> { const wanted = new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)); if (!wanted.size) return []; const rows = await ctx.db<typeof schema>().select().from(schema.finnhubNewsSnapshots); return rows.filter((row) => wanted.has(row.ticker) && isFreshWithin48Hours(row.asOf)); }
async function finnhubTheorySources(ctx: Ctx, tickers: string[]): Promise<DiscoverySource[]> { const snapshots = await latestFreshFinnhubNews(ctx, tickers); return snapshots.flatMap((snapshot) => parseFinnhubNews(snapshot.articlesJson).map((article) => ({ title: article.headline, url: article.url, source: "Finnhub", snippet: `${article.summary || "Summary unavailable."} Publisher: ${article.source}. Finnhub snapshot as of ${snapshot.asOf}.`, publishedAt: article.publishedAt, retrievedAt: snapshot.asOf, singleSource: true }))); }
async function finnhubDossierContext(ctx: Ctx, ticker: string) {
  const normalized = ticker.trim().toUpperCase(); const db = ctx.db<typeof schema>();
  const [insiderRows, earningRows, filingRows] = await Promise.all([
    db.select().from(schema.finnhubInsiderSnapshots).where(eq(schema.finnhubInsiderSnapshots.ticker, normalized)),
    db.select().from(schema.finnhubEarningsSnapshots).where(eq(schema.finnhubEarningsSnapshots.symbol, normalized)),
    db.select().from(schema.finnhubFilingSnapshots).where(eq(schema.finnhubFilingSnapshots.ticker, normalized)),
  ]);
  const insiderSnapshot = insiderRows[0]; const earningsSnapshot = earningRows[0]; const filingSnapshot = filingRows[0];
  return {
    insiders: insiderSnapshot ? { asOf: insiderSnapshot.asOf, transactions: parseFinnhubInsiders(insiderSnapshot.transactionsJson) } : null,
    earnings: earningsSnapshot ? { asOf: earningsSnapshot.asOf, events: parseFinnhubEarnings(earningsSnapshot.eventsJson) } : null,
    filings: filingSnapshot ? { asOf: filingSnapshot.asOf, filings: parseFinnhubFilings(filingSnapshot.filingsJson) } : null,
  };
}
function emptyFinnhubEarnings(note: string): z.infer<typeof analyzeResponse>["earningsCalendar"] { return { state: "no_data", note, asOf: null, events: [] }; }
function sentimentDirection(label: string): "bullish" | "bearish" | "neutral" { const normalized = label.toLowerCase().replace(/[_-]+/g, " "); if (normalized.includes("bullish")) return "bullish"; if (normalized.includes("bearish")) return "bearish"; return "neutral"; }
function sentimentStance(label: string, direction: "long" | "short" | "none"): "confirming" | "challenging" | "neutral" { const mood = sentimentDirection(label); if (direction === "none" || mood === "neutral") return "neutral"; return (direction === "long" && mood === "bullish") || (direction === "short" && mood === "bearish") ? "confirming" : "challenging"; }
function isFreshSentimentAsOf(asOf: string, now = Date.now()): boolean { return isFreshWithin48Hours(asOf, now); }
async function latestFreshSentiment(ctx: Ctx, tickers: string[]) { const wanted = new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)); if (!wanted.size) return []; const rows = await ctx.db<typeof schema>().select().from(schema.sentimentSnapshots); const now = Date.now(); return rows.filter((row) => wanted.has(row.ticker) && isFreshSentimentAsOf(row.asOf, now)); }
async function syncSentimentEvidence(ctx: Ctx, theoryKind: "user" | "machine", theoryId: number, tickers: string[], direction: "long" | "short" | "none") {
  const db = ctx.db<typeof schema>(); const snapshots = await latestFreshSentiment(ctx, tickers); const values = snapshots.flatMap((snapshot) => parseSentimentArticles(snapshot.articlesJson).map((article) => ({ theoryKind, theoryId, ticker: snapshot.ticker, snapshotAsOf: snapshot.asOf, title: article.title, sourceUrl: article.url, publishedAt: article.publishedAt, publisher: article.source, overallScore: article.overallScore, overallLabel: article.overallLabel, tickerScore: article.tickerScore, tickerLabel: article.tickerLabel, stance: sentimentStance(article.tickerLabel, direction) })));
  await db.delete(schema.theorySentimentEvidence).where(and(eq(schema.theorySentimentEvidence.theoryKind, theoryKind), eq(schema.theorySentimentEvidence.theoryId, theoryId)));
  if (values.length) await db.insert(schema.theorySentimentEvidence).values(values);
  return values;
}
function sentimentEvidenceMap(row: typeof schema.theorySentimentEvidence.$inferSelect): z.infer<typeof sentimentEvidenceView> { return { id: row.id, ticker: row.ticker, stance: row.stance, title: row.title, source: "Alpha Vantage", publisher: row.publisher, url: row.sourceUrl, publishedAt: row.publishedAt, asOf: row.snapshotAsOf, overallScore: row.overallScore, overallLabel: row.overallLabel, tickerScore: row.tickerScore, tickerLabel: row.tickerLabel, kind: "sentiment" }; }
function sentimentLayerNote(rows: Array<typeof schema.theorySentimentEvidence.$inferSelect>): string { if (!rows.length) return "Sentiment: NO_DATA — no Alpha Vantage NEWS_SENTIMENT snapshot at or under 48 hours old. Missing sentiment is not a failure and adds zero to factor agreement."; const confirming = rows.filter((row) => row.stance === "confirming").length; const challenging = rows.filter((row) => row.stance === "challenging").length; const neutral = rows.filter((row) => row.stance === "neutral").length; const asOf = rows.map((row) => row.snapshotAsOf).sort().at(-1) ?? "unavailable"; return `Sentiment: Alpha Vantage NEWS_SENTIMENT as of ${asOf}; ${rows.length} article${rows.length === 1 ? "" : "s"}: ${confirming} confirming, ${challenging} challenging, ${neutral} neutral. Attention/mood context only; adds zero to directional factor agreement and cannot verify the thesis alone.`; }
function withSentimentLayerNote(evidence: string, note: string): string { const base = evidence.replace(/\s*Sentiment context:.*$/s, "").trim().replace(/^FAIL:\s*only (\d+) independent publisher(s?) and\/or unsupported evidence hops; not verified\./i, "NO_DATA: only $1 independent publisher$2 and/or unsupported evidence hops; corroboration is insufficient, not disproof."); return `${base} ${note.replace(/^Sentiment:\s*/, "Sentiment context: ")}`.trim(); }
function theoryDirectionFromPredictions(predictions: Array<typeof schema.theoryPredictions.$inferSelect>): "long" | "short" | "none" { const directions = new Set(predictions.map((prediction) => prediction.direction === "above" ? "long" : "short")); return directions.size === 1 ? ([...directions][0] ?? "none") : "none"; }
async function snapshotTickers(ctx: Ctx, tickers: string[]) { const out: Record<string, number | null> = {}; await Promise.all(tickers.map(async (ticker) => { try { const series = await yahooFullHistory(ctx, ticker); out[ticker] = series.points[series.points.length - 1]?.close ?? null; } catch { out[ticker] = null; } })); return out; }
async function theoryRows(ctx: Ctx): Promise<Array<z.infer<typeof theoryView>>> {
  const db = ctx.db<typeof schema>(); const theoryRows = await db.select().from(schema.theories).orderBy(desc(schema.theories.createdAt)); const allPredictions = await db.select().from(schema.theoryPredictions); const allRipples = await db.select().from(schema.theoryRipples); const allEvidence = await db.select().from(schema.theoryEvidence).orderBy(desc(schema.theoryEvidence.createdAt));
  await Promise.all(theoryRows.map((row) => { const predictions = allPredictions.filter((prediction) => prediction.theoryId === row.id); return syncSentimentEvidence(ctx, "user", row.id, jsonStrings(row.linkedTickersJson), theoryDirectionFromPredictions(predictions)); }));
  const sentimentEvidence = await db.select().from(schema.theorySentimentEvidence).where(eq(schema.theorySentimentEvidence.theoryKind, "user")).orderBy(desc(schema.theorySentimentEvidence.createdAt));
  const tickers = [...new Set(theoryRows.flatMap((row) => jsonStrings(row.linkedTickersJson)))]; const current = await snapshotTickers(ctx, tickers); const today = new Date().toISOString().slice(0, 10);
  return theoryRows.map((row) => {
    const snapshots = jsonPrices(row.snapshotPricesJson); const predictions = allPredictions.filter((p) => p.theoryId === row.id).map((p) => {
      const snapshotPrice = snapshots[p.ticker] ?? null; const currentPrice = current[p.ticker] ?? null; const target = p.targetLevel; const desired = p.direction === "above" ? 1 : -1; let progress: number | null = null; let achieved = false;
      if (currentPrice != null && snapshotPrice != null) {
        achieved = target != null ? (p.direction === "above" ? currentPrice >= target : currentPrice <= target) : desired * (currentPrice - snapshotPrice) > 0;
        if (achieved) progress = 100; else if (target != null && target !== snapshotPrice) progress = round(100 * (currentPrice - snapshotPrice) / (target - snapshotPrice)); else progress = round(desired * ((currentPrice / snapshotPrice) - 1) * 100);
      }
      const expired = today > p.dueDate; const status: "confirming" | "challenged" | "refuted" = expired && !achieved ? "refuted" : achieved || (progress != null && progress > 0) ? "confirming" : "challenged";
      const targetText = target == null ? `${p.direction} creation price` : `${p.direction} ${round(target)}`; const detail = currentPrice == null ? "Current price unavailable" : `${round(currentPrice)} now · prediction ${targetText} by ${p.dueDate}`;
      return { id: p.id, ticker: p.ticker, direction: p.direction, targetLevel: target, dueDate: p.dueDate, snapshotPrice, currentPrice, progress, status, detail };
    });
    const status: "confirming" | "challenged" | "refuted" = predictions.some((p) => p.status === "refuted") ? "refuted" : predictions.length > 0 && predictions.every((p) => p.status === "confirming") ? "confirming" : "challenged";
    return { id: row.id, statement: row.statement, horizon: row.horizon, linkedTickers: jsonStrings(row.linkedTickersJson), snapshots, status, predictions, ripples: allRipples.filter((r) => r.theoryId === row.id).map((r) => ({ id: r.id, from: r.fromLabel, to: r.toLabel, because: r.because })), evidence: [...allEvidence.filter((e) => e.theoryId === row.id).map((e) => ({ id: e.id, stance: e.stance, title: e.title, source: e.source, publisher: null, url: e.sourceUrl, publishedAt: e.publishedAt, createdAt: e.createdAt.toISOString(), asOf: null, overallScore: null, overallLabel: null, tickerScore: null, tickerLabel: null, kind: "article" as const })), ...sentimentEvidence.filter((e) => e.theoryId === row.id).map((e) => ({ id: e.id, stance: e.stance, title: e.title, source: "Alpha Vantage", publisher: e.publisher, url: e.sourceUrl, publishedAt: e.publishedAt, createdAt: e.createdAt.toISOString(), asOf: e.snapshotAsOf, overallScore: e.overallScore, overallLabel: e.overallLabel, tickerScore: e.tickerScore, tickerLabel: e.tickerLabel, kind: "sentiment" as const }))], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  });
}

type DiscoverySource = { title: string; url: string; source: string; snippet: string; publishedAt: string | null; retrievedAt: string; singleSource: boolean };
type LayerVerdict = "agree" | "disagree" | "mixed" | "unavailable" | "no_data";
type TheoryLayerName = "chart" | "math" | "narrative" | "news" | "smart_money" | "crowd_pricing";
type TheoryLayer = { name: TheoryLayerName; verdict: LayerVerdict; evidence: string; weight: number; contribution: number; deduplicated: boolean; deduplicationNote: string | null; sourceKeys: string[] };
type TheoryScore = { layers: TheoryLayer[]; weightedScore: number; measuredLayersWithData: number; evidenceFloorMet: boolean; measuredConflict: boolean; confidenceTier: "high" | "medium" | "low"; directionalPickAllowed: boolean; supportLabel: "directional pick" | "watch only" | "not supported" | "contested" | "insufficient evidence" };
type CandidateHop = { from: string; to: string; mechanism: string; kind: "evidence" | "inference"; sourceIndexes: number[] };
type TheoryHop = CandidateHop & { check: "pass" | "broken"; evidence: Array<{ title: string; url: string; source: string }> };
type CandidateTheory = { title: string; thesis: string; domain: string; horizon: "weeks" | "months" | "quarters"; primarySymbol: string; rivalSymbol: string | null; expectedDirection: "long" | "short" | "none"; causalChain: CandidateHop[]; sectorOutlook: string[]; countercase: string; sourceIndexes: number[] };

const discoverySourceSchema = z.object({ title: z.string(), url: z.string(), source: z.string(), snippet: z.string(), publishedAt: z.string().nullable(), retrievedAt: z.string(), singleSource: z.boolean() });
const theoryLayerSchema = z.object({ name: z.enum(["chart", "math", "narrative", "news", "smart_money", "crowd_pricing"]), verdict: z.enum(["agree", "disagree", "mixed", "unavailable", "no_data"]), evidence: z.string(), weight: z.number(), contribution: z.number(), deduplicated: z.boolean(), deduplicationNote: z.string().nullable(), sourceKeys: z.array(z.string()) });
const theoryLevelSchema = z.object({ level: z.number(), touches: z.number(), lastSeen: z.string(), basis: z.string() });
const theoryEntrySchema = z.object({ low: z.number(), high: z.number(), anchor: z.number(), basis: z.string() });
const theoryPositioningOptionSchema = z.object({ kind: z.enum(["futures", "spot"]), label: z.string(), direction: z.enum(["long", "short"]), timeline: z.string(), aggressiveEntry: theoryEntrySchema.nullable(), patientEntry: theoryEntrySchema.nullable(), invalidation: z.number().nullable(), invalidationBasis: z.string().nullable(), targets: z.array(z.object({ level: z.number(), basis: z.string() })), thesis: z.string().nullable(), tranches: z.array(z.object({ tranche: z.number(), level: z.number(), basis: z.string() })), reliability: z.literal("UNCALIBRATED"), fit: z.string() });
const theoryPositioningSchema = z.object({ state: z.enum(["available", "no_position"]), symbol: z.string(), direction: z.enum(["long", "short", "none"]), horizon: z.enum(["weeks", "months", "quarters"]), reliability: z.literal("UNCALIBRATED"), probability: z.null(), source: z.string().nullable(), barCount: z.number(), firstBar: z.string().nullable(), lastBar: z.string().nullable(), currentPrice: z.number().nullable(), supports: z.array(theoryLevelSchema), resistances: z.array(theoryLevelSchema), liquidityZones: z.array(z.object({ low: z.number(), high: z.number(), center: z.number(), volumeSharePct: z.number(), basis: z.string() })), volatility: z.object({ regime: z.enum(["compression", "normal", "expansion", "unavailable"]), annualizedPct: z.number().nullable(), percentile: z.number().nullable(), samples: z.number(), window: z.string() }).nullable(), options: z.array(theoryPositioningOptionSchema).max(3), reason: z.string().nullable(), methodology: z.string() });
const machineTheoryView = z.object({
  id: z.number(), origin: z.enum(["machine-found", "market-synthesis"]), title: z.string(), thesis: z.string(), domain: z.string(), horizon: z.enum(["weeks", "months", "quarters"]), weightedScore: z.number(), measuredLayersWithData: z.number(), evidenceFloorMet: z.boolean(), supportLabel: z.enum(["directional pick", "watch only", "not supported", "contested", "insufficient evidence"]), status: z.enum(["live", "contested", "invalidated", "degraded"]), confidenceTier: z.enum(["high", "medium", "low"]), confidenceNote: z.string(), directionalPick: z.enum(["long", "short", "none"]), expectedDirection: z.enum(["long", "short", "none"]), primarySymbol: z.string(), rivalSymbol: z.string().nullable(), causalChain: z.array(z.object({ from: z.string(), to: z.string(), mechanism: z.string(), kind: z.enum(["evidence", "inference"]), sourceIndexes: z.array(z.number()), check: z.enum(["pass", "broken"]), evidence: z.array(z.object({ title: z.string(), url: z.string(), source: z.string() })) })), sectorOutlook: z.array(z.string()), layers: z.array(theoryLayerSchema), sources: z.array(discoverySourceSchema), sentimentEvidence: z.array(sentimentEvidenceView), sourceIntegrity: z.enum(["multi_source", "single_source"]), independentSourceCount: z.number(), integrityNote: z.string(), countercase: z.string(), invalidation: z.string(), tripwire: z.object({ symbol: z.string(), operator: z.enum(["above", "below"]), level: z.number(), creationPrice: z.number(), direction: z.enum(["long", "short"]), validatedAtCreation: z.literal(true) }).nullable(), positioning: theoryPositioningSchema, foundAt: z.string(), checkedAt: z.string(), socialEvidenceState: z.string() });
function parseJsonArray(value: string): unknown[] { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function asStringArray(value: string): string[] { return parseJsonArray(value).filter((item): item is string => typeof item === "string"); }
function parseExclusions(value: string): Array<{ symbol: string; reason: string }> { return parseJsonArray(value).flatMap((item) => { if (!item || typeof item !== "object") return []; const row = item as Record<string, unknown>; return typeof row.symbol === "string" && typeof row.reason === "string" ? [{ symbol: row.symbol, reason: row.reason }] : []; }); }
function parseScanDimensions(value: string): ScanDimension[] { return parseJsonArray(value).flatMap((item) => { if (!item || typeof item !== "object") return []; const row = item as Record<string, unknown>; return typeof row.name === "string" && (row.status === "supports" || row.status === "conflicts" || row.status === "research") && typeof row.detail === "string" ? [{ name: row.name, status: row.status, detail: row.detail }] : []; }); }
function parseScanFactors(value: string): Array<{ name: string; weight: number; score: -1 | 0 | 1; contribution: number; reading: string }> { return parseJsonArray(value).flatMap((item) => { if (!item || typeof item !== "object") return []; const row = item as Record<string, unknown>; return typeof row.name === "string" && typeof row.weight === "number" && (row.score === -1 || row.score === 0 || row.score === 1) && typeof row.contribution === "number" && typeof row.reading === "string" ? [{ name: row.name, weight: row.weight, score: row.score, contribution: row.contribution, reading: row.reading }] : []; }); }
function theoryLayerWeight(name: TheoryLayerName): number { return name === "chart" || name === "math" ? 3 : name === "news" || name === "smart_money" ? 2 : name === "narrative" ? 1 : 0; }
function makeTheoryLayer(name: TheoryLayerName, verdict: LayerVerdict, evidence: string, sourceKeys: string[] = []): TheoryLayer { const weight = theoryLayerWeight(name); return { name, verdict: verdict === "unavailable" ? "no_data" : verdict, evidence, weight, contribution: verdict === "agree" ? weight : verdict === "disagree" ? -2 * weight : 0, deduplicated: false, deduplicationNote: null, sourceKeys: [...new Set(sourceKeys.filter(Boolean))] }; }
function parseLayers(value: string): TheoryLayer[] { return parseJsonArray(value).flatMap((item) => { if (!item || typeof item !== "object") return []; const row = item as Record<string, unknown>; const name = row.name; const rawVerdict = row.verdict; const evidence = row.evidence; const verdict: LayerVerdict | null = rawVerdict === "pass" ? "agree" : rawVerdict === "fail" ? "disagree" : rawVerdict === "agree" || rawVerdict === "disagree" || rawVerdict === "mixed" || rawVerdict === "unavailable" || rawVerdict === "no_data" ? rawVerdict : null; if (!((name === "chart" || name === "math" || name === "narrative" || name === "news" || name === "smart_money" || name === "crowd_pricing") && verdict && typeof evidence === "string")) return []; const weight = theoryLayerWeight(name); const contribution = typeof row.contribution === "number" ? row.contribution : verdict === "agree" ? weight : verdict === "disagree" ? -2 * weight : 0; const sourceKeys = Array.isArray(row.sourceKeys) ? row.sourceKeys.filter((key): key is string => typeof key === "string" && key.length > 0) : []; return [{ name, verdict: verdict === "unavailable" ? "no_data" : verdict, evidence, weight, contribution, deduplicated: row.deduplicated === true, deduplicationNote: typeof row.deduplicationNote === "string" ? row.deduplicationNote : null, sourceKeys }]; }); }
function materiallyOverlappingSources(a: string[], b: string[]): boolean { if (!a.length || !b.length) return false; const left = new Set(a); const overlap = b.filter((key) => left.has(key)).length; return overlap / Math.min(left.size, new Set(b).size) >= 0.5; }
function scoreTheoryLayers(input: TheoryLayer[]): TheoryScore {
  const layers: TheoryLayer[] = input.map((layer) => { const verdict = layer.verdict === "unavailable" ? "no_data" as const : layer.verdict; const weight = theoryLayerWeight(layer.name); return { ...layer, verdict, weight, contribution: verdict === "agree" ? weight : verdict === "disagree" ? -2 * weight : 0, deduplicated: false, deduplicationNote: null }; });
  const agreeing = layers.map((layer, index) => ({ layer, index })).filter(({ layer }) => layer.verdict === "agree" && layer.weight > 0).sort((a, b) => b.layer.weight - a.layer.weight || a.index - b.index);
  const kept: TheoryLayer[] = [];
  for (const { layer } of agreeing) { const shared = kept.find((higher) => materiallyOverlappingSources(higher.sourceKeys, layer.sourceKeys)); if (shared) { layer.contribution = 0; layer.deduplicated = true; layer.deduplicationNote = `deduplicated (shared sources with ${shared.name === "chart" ? "chart science" : shared.name === "math" ? "factor agreement" : shared.name.replaceAll("_", " ")})`; } else kept.push(layer); }
  const weightedScore = layers.reduce((sum, layer) => sum + layer.contribution, 0); const measured = layers.filter((layer) => layer.name === "chart" || layer.name === "math"); const measuredLayersWithData = measured.filter((layer) => layer.verdict !== "no_data").length; const evidenceFloorMet = measuredLayersWithData >= 2; const measuredConflict = measured.some((layer) => layer.verdict === "disagree"); const directionalPickAllowed = evidenceFloorMet && !measuredConflict && weightedScore >= 4;
  const confidenceTier: TheoryScore["confidenceTier"] = weightedScore >= 8 ? "high" : weightedScore >= 4 ? "medium" : "low"; const supportLabel: TheoryScore["supportLabel"] = !evidenceFloorMet ? "insufficient evidence" : measuredConflict ? "contested" : directionalPickAllowed ? "directional pick" : weightedScore >= 1 ? "watch only" : "not supported";
  return { layers, weightedScore, measuredLayersWithData, evidenceFloorMet, measuredConflict, confidenceTier, directionalPickAllowed, supportLabel };
}
function parseSources(value: string): DiscoverySource[] { return parseJsonArray(value).flatMap((item) => { if (!item || typeof item !== "object") return []; const row = item as Record<string, unknown>; if (typeof row.title !== "string" || typeof row.url !== "string" || typeof row.source !== "string" || typeof row.retrievedAt !== "string") return []; return [{ title: row.title, url: row.url, source: row.source, snippet: typeof row.snippet === "string" ? row.snippet : "", publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : null, retrievedAt: row.retrievedAt, singleSource: row.singleSource !== false }]; }); }
function sourceIdentity(source: DiscoverySource): string {
  const named = source.source.trim().toLowerCase().replace(/^www\./, "");
  if (named && named !== "unknown source") return named;
  try { return new URL(source.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return source.url.trim().toLowerCase(); }
}
function independentSourceCount(sources: DiscoverySource[]): number { return new Set(sources.map(sourceIdentity).filter(Boolean)).size; }
function sourceKeyFromUrl(url: string | null | undefined, fallback: string): string { try { return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : fallback; } catch { return fallback; } }
function parseTheoryHops(value: string, sources: DiscoverySource[]): TheoryHop[] { return parseJsonArray(value).flatMap((item, index) => { if (typeof item === "string") return [{ from: index === 0 ? "Observed event" : `Hop ${index}`, to: `Hop ${index + 1}`, mechanism: item, kind: "inference" as const, sourceIndexes: [], check: "pass" as const, evidence: [] }]; if (!item || typeof item !== "object") return []; const row = item as Record<string, unknown>; if (typeof row.from !== "string" || typeof row.to !== "string" || typeof row.mechanism !== "string" || (row.kind !== "evidence" && row.kind !== "inference")) return []; const sourceIndexes = Array.isArray(row.sourceIndexes) ? row.sourceIndexes.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n <= sources.length) : []; const evidenceSources = sourceIndexes.flatMap((n) => sources[n - 1] ? [sources[n - 1]!] : []); const evidence = evidenceSources.map((source) => ({ title: source.title, url: source.url, source: source.source })); const corroborated = independentSourceCount(evidenceSources) >= 2; const check = row.kind === "inference" || corroborated ? "pass" as const : "broken" as const; return [{ from: row.from, to: row.to, mechanism: row.mechanism, kind: row.kind, sourceIndexes, check, evidence }]; }); }
type TheoryPositioning = z.infer<typeof theoryPositioningSchema>;
type TheoryLevel = z.infer<typeof theoryLevelSchema>;
function theoryPivotLevels(points: Point[], current: number, kind: "support" | "resistance"): TheoryLevel[] {
  const radius = points.length >= 1500 ? 10 : points.length >= 500 ? 7 : 4; const tolerance = 0.018; const raw: Array<{ level: number; date: string }> = [];
  for (let index = radius; index < points.length - radius; index++) {
    const point = points[index]; if (!point) continue; const level = kind === "support" ? (point.low ?? point.close) : (point.high ?? point.close);
    if (!(level > current * 0.18 && level < current * 5.5)) continue;
    const neighborhood = points.slice(index - radius, index + radius + 1); const pivot = kind === "support" ? neighborhood.every((row) => (row.low ?? row.close) >= level) : neighborhood.every((row) => (row.high ?? row.close) <= level);
    if (pivot) raw.push({ level, date: point.date });
  }
  const clusters: Array<{ sum: number; level: number; touches: number; lastSeen: string }> = [];
  for (const point of raw.sort((a, b) => a.level - b.level)) { const cluster = clusters.find((row) => Math.abs(row.level - point.level) / point.level <= tolerance); if (cluster) { cluster.sum += point.level; cluster.touches += 1; cluster.level = cluster.sum / cluster.touches; if (point.date > cluster.lastSeen) cluster.lastSeen = point.date; } else clusters.push({ sum: point.level, level: point.level, touches: 1, lastSeen: point.date }); }
  return clusters.filter((row) => kind === "support" ? row.level < current * 0.998 : row.level > current * 1.002).sort((a, b) => (Math.abs(Math.log(a.level / current)) - Math.min(a.touches, 8) * 0.006) - (Math.abs(Math.log(b.level / current)) - Math.min(b.touches, 8) * 0.006)).slice(0, 4).sort((a, b) => kind === "support" ? b.level - a.level : a.level - b.level).map((row) => ({ level: round(row.level), touches: row.touches, lastSeen: row.lastSeen, basis: `${row.touches} clustered full-history swing ${kind === "support" ? "low" : "high"}${row.touches === 1 ? "" : "s"}; 1.8% clustering tolerance.` }));
}
function theoryLiquidityZones(points: Point[]): TheoryPositioning["liquidityZones"] {
  const usable = points.filter((point) => point.close > 0 && point.volume != null && point.volume > 0); if (usable.length < 30) return [];
  const prices = usable.map((point) => point.close); const minPrice = Math.min(...prices); const maxPrice = Math.max(...prices); if (!(maxPrice > minPrice)) return [];
  const bins = Math.min(56, Math.max(24, Math.round(Math.sqrt(usable.length)))); const logMin = Math.log(minPrice); const logSpan = Math.log(maxPrice) - logMin; if (!(logSpan > 0)) return [];
  const volumes = Array<number>(bins).fill(0); let totalVolume = 0;
  for (const point of usable) { const volume = point.volume ?? 0; const index = Math.max(0, Math.min(bins - 1, Math.floor(((Math.log(point.close) - logMin) / logSpan) * bins))); volumes[index] = (volumes[index] ?? 0) + volume; totalVolume += volume; }
  const ranked = volumes.map((volume, index) => ({ index, volume })).sort((a, b) => b.volume - a.volume); const selected: Array<{ index: number; volume: number }> = [];
  for (const row of ranked) { if (row.volume <= 0 || selected.some((item) => Math.abs(item.index - row.index) <= 1)) continue; selected.push(row); if (selected.length === 4) break; }
  return selected.map((row) => { const low = Math.exp(logMin + (row.index / bins) * logSpan); const high = Math.exp(logMin + ((row.index + 1) / bins) * logSpan); const share = totalVolume > 0 ? row.volume / totalVolume * 100 : 0; return { low: round(low), high: round(high), center: round(Math.sqrt(low * high)), volumeSharePct: round(share), basis: `Full-history log-price volume bin; ${round(share)}% of observed source volume.` }; }).sort((a, b) => a.center - b.center);
}
function buildTheoryPositioning(series: YahooSeries | null, row: typeof schema.machineTheories.$inferSelect): TheoryPositioning {
  const symbol = row.primarySymbol.toUpperCase(); const points = series?.points ?? []; const currentPoint = points.at(-1); const current = currentPoint?.close ?? null; const base = { symbol, direction: row.directionalPick, horizon: row.horizon, reliability: "UNCALIBRATED" as const, probability: null, source: series?.sourceUrl ?? null, barCount: points.length, firstBar: points[0]?.date ?? null, lastBar: currentPoint?.date ?? null };
  if (current == null || points.length < 90) return { ...base, state: "no_position", currentPrice: current, supports: [], resistances: [], liquidityZones: [], volatility: null, options: [], reason: points.length ? `No positioning: only ${points.length} full-history daily bars are available; at least 90 are required.` : "No positioning: full-history price data is unavailable for this ticker.", methodology: "No technical level is emitted without usable full-history price data." };
  const closes = points.map((point) => point.close); const dailyReturns = closes.slice(1).flatMap((value, index) => { const prior = closes[index]; return prior && prior > 0 ? [Math.log(value / prior)] : []; }); const rollingVol: number[] = [];
  for (let index = 20; index <= dailyReturns.length; index++) { const window = dailyReturns.slice(index - 20, index); const mean = average(window); if (mean == null) continue; const deviation = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length); rollingVol.push(deviation * Math.sqrt(252) * 100); }
  const latestVol = rollingVol.at(-1) ?? null; const volPercentile = percentileRank(rollingVol, latestVol); const volatilityRegime = volPercentile == null ? "unavailable" : volPercentile >= 75 ? "expansion" : volPercentile <= 25 ? "compression" : "normal";
  const currentAtr = atr(points.slice(-60)); const supports = theoryPivotLevels(points, current, "support"); const resistances = theoryPivotLevels(points, current, "resistance"); const liquidityZones = theoryLiquidityZones(points);
  const uniqueLevels = (items: Array<{ level: number; label: string }>) => items.sort((a, b) => a.level - b.level).filter((item, index, all) => index === 0 || Math.abs(item.level - (all[index - 1]?.level ?? item.level)) / item.level > 0.01);
  const lower = uniqueLevels([...supports.map((item) => ({ level: item.level, label: `support (${item.touches} swing${item.touches === 1 ? "" : "s"})` })), ...liquidityZones.filter((item) => item.center < current).map((item) => ({ level: item.center, label: `high-volume zone (${item.volumeSharePct}%)` }))]).filter((item) => item.level < current).sort((a, b) => b.level - a.level);
  const upper = uniqueLevels([...resistances.map((item) => ({ level: item.level, label: `resistance (${item.touches} swing${item.touches === 1 ? "" : "s"})` })), ...liquidityZones.filter((item) => item.center > current).map((item) => ({ level: item.center, label: `high-volume zone (${item.volumeSharePct}%)` }))]).filter((item) => item.level > current).sort((a, b) => a.level - b.level);
  const zone = (item: { level: number; label: string }) => { const width = Math.max(item.level * 0.008, (currentAtr ?? item.level * 0.02) * 0.35); return { low: round(Math.max(0, item.level - width)), high: round(item.level + width), anchor: round(item.level), basis: `${item.label}; band width is max(0.8% of anchor, 0.35× latest 14-session ATR).` }; };
  const options: TheoryPositioning["options"] = []; const directional = row.status === "live" && row.sourceIntegrity === "multi_source" && row.directionalPick !== "none";
  if (directional && row.horizon !== "quarters" && volPercentile !== null && volPercentile < 90) { const optionDirection: "long" | "short" = row.directionalPick === "long" ? "long" : "short"; const entries = optionDirection === "long" ? lower.slice(0, 2).map(zone) : upper.slice(0, 2).map(zone); const targets = optionDirection === "long" ? upper.slice(0, 2) : lower.slice(0, 2); if (entries.length && targets.length) { const deepest = entries.at(-1); const atrValue = currentAtr ?? current * 0.02; const invalidation = deepest ? round(optionDirection === "long" ? Math.max(0, deepest.low - atrValue) : deepest.high + atrValue) : null; options.push({ kind: "futures", label: `${optionDirection === "long" ? "Long" : "Short"} futures framing`, direction: optionDirection, timeline: row.horizon === "weeks" ? "1–6 weeks; reassess at each weekly close" : "1–2 quarters; reassess monthly", aggressiveEntry: entries[0] ?? null, patientEntry: entries[1] ?? null, invalidation, invalidationBasis: deepest ? `One latest 14-session ATR beyond the ${deepest.basis}` : null, targets: targets.map((item) => ({ level: round(item.level), basis: item.label })), thesis: null, tranches: [], reliability: "UNCALIBRATED", fit: `${row.horizon}-horizon directional theory with entries and opposing full-history levels available; realized volatility is below its 90th historical percentile.` }); } }
  if (directional && row.directionalPick === "long" && row.horizon !== "weeks" && lower.length) { const trancheRows = lower.slice(0, 3); options.push({ kind: "spot", label: "Spot hold / DCA framing", direction: "long", timeline: row.horizon === "quarters" ? "2–4 quarters; re-check thesis and invalidation monthly" : "2–6 months; re-check thesis and invalidation weekly", aggressiveEntry: null, patientEntry: null, invalidation: supports.at(-1)?.level ?? null, invalidationBasis: supports.length ? "Deepest displayed full-history swing support; thesis falsification still governs." : null, targets: [], thesis: row.thesis, tranches: trancheRows.map((item, index) => ({ tranche: index + 1, level: round(item.level), basis: item.label })), reliability: "UNCALIBRATED", fit: `${row.horizon}-horizon bullish theory with one or more full-history accumulation levels.` }); }
  const reason = options.length ? null : !directional ? `No positioning: theory status is ${row.status.toUpperCase()}${row.sourceIntegrity === "single_source" ? " and key premises remain SINGLE SOURCE" : " or it has no directional pick"}.` : volPercentile != null && volPercentile >= 90 && row.horizon !== "quarters" ? `No positioning: 20-session realized volatility is in the ${round(volPercentile, 1)}th historical percentile, so a leveraged framing is withheld.` : row.horizon === "quarters" && row.directionalPick === "short" ? "No positioning: a quarters-long bearish thesis does not support a responsible leveraged or spot-hold framing." : "No positioning: full history did not provide both a defensible entry anchor and an opposing target level.";
  return { ...base, state: options.length ? "available" : "no_position", currentPrice: round(current), supports, resistances, liquidityZones, volatility: { regime: volatilityRegime, annualizedPct: latestVol == null ? null : round(latestVol), percentile: volPercentile, samples: rollingVol.length, window: "20-session annualized realized volatility across full daily history" }, options, reason, methodology: `Support and resistance are clustered local OHLC swing points across ${points.length} full-history daily bars. Liquidity zones are historical high-volume log-price bins, not live order-book liquidity. Entry bands and invalidations are deterministic ATR offsets from observed levels.` };
}
async function machineTheoryPositioning(ctx: Ctx, rows: Array<typeof schema.machineTheories.$inferSelect>): Promise<Map<number, TheoryPositioning>> { const symbols = [...new Set(rows.map((row) => row.primarySymbol.toUpperCase()).filter(Boolean))]; const seriesRows = await Promise.all(symbols.map(async (symbol) => { try { return [symbol, await yahooFullHistory(ctx, symbol)] as const; } catch { return [symbol, null] as const; } })); const bySymbol = new Map(seriesRows); return new Map(rows.map((row) => [row.id, buildTheoryPositioning(bySymbol.get(row.primarySymbol.toUpperCase()) ?? null, row)])); }
const VERIFIED_FED_HOLD_MARKET_URL = "https://polymarket.com/market/will-there-be-no-change-in-fed-interest-rates-after-the-october-2026-meeting-20260617190324031";
function repairCrowdPriceUnits(text: string) { return text.replace(/(implied crowd price)\s+\$(?=\d)/gi, "$1 "); }
function repairedPolymarketSource(source: DiscoverySource): DiscoverySource {
  const repaired = source.source === "Polymarket" ? { ...source, snippet: repairCrowdPriceUnits(source.snippet) } : source;
  if (repaired.source === "Polymarket" && repaired.url.startsWith("https://gamma-api.polymarket.com/") && repaired.title === "Will there be no change in Fed interest rates after the October 2026 meeting?") return { ...repaired, url: VERIFIED_FED_HOLD_MARKET_URL };
  return repaired;
}
async function repairStoredTheoryEvidence(ctx: Ctx, rows: Array<typeof schema.machineTheories.$inferSelect>) {
  const db = ctx.db<typeof schema>();
  const storedTheoryText = (row: typeof schema.machineTheories.$inferSelect) => `${row.title} ${row.thesis} ${row.causalChainJson} ${row.sectorOutlookJson} ${row.countercase}`;
  const requestedBlsIds = [...new Set(rows.flatMap((row) => blsSeriesIdsForText(storedTheoryText(row))))];
  const needsTnx = rows.some((row) => row.domain === "rates" || /\b(rates?|yields?|treasur(?:y|ies)|fed|fomc|duration)\b/i.test(storedTheoryText(row)));
  const [allBls, tnx] = await Promise.all([requestedBlsIds.length ? blsMacroEvidence(ctx, requestedBlsIds).catch(() => []) : [], needsTnx ? tnxMacroEvidence(ctx).catch(() => []) : []]);
  return await Promise.all(rows.map(async (row) => {
    const text = storedTheoryText(row);
    const rowBlsIds = blsSeriesIdsForText(text); const bls = allBls.filter((source) => rowBlsIds.some((seriesId) => source.title.includes(seriesId)));
    const macro = rowBlsIds.length > 0;
    const rateClaim = row.domain === "rates" || /\b(rates?|yields?|treasur(?:y|ies)|fed|fomc|duration)\b/i.test(text);
    const prior = parseSources(row.sourcesJson).map(repairedPolymarketSource).filter((source) => source.source !== "U.S. Bureau of Labor Statistics" && !(source.source === "Yahoo Finance" && source.title.includes("^TNX")));
    const sources = [...prior, ...bls, ...(rateClaim ? tnx : [])];
    const layers = parseLayers(row.layersJson).map((layer) => {
      let evidence = repairCrowdPriceUnits(layer.evidence);
      if (layer.name !== "narrative") return { ...layer, evidence };
      evidence = evidence.replace(/\s*BLS macro anchor attached with \d+ monthly series[^.]*\./gi, "").replace(/\s*BLS macro data unavailable;[^.]*\./gi, "").trim();
      if (macro) evidence += ` ${bls.length ? `BLS macro anchor attached with ${bls.length} claim-mapped monthly series, each carrying print-vs-prior, print-vs-trend, as-of month, and series ID; unemployment/CPI rows also carry OLS slopes, acceleration, and the 24-month ±1σ inflection gate. Level-3 evidence only; zero factor-score weight unless it separately passes the standard factor gates.` : "BLS macro data unavailable; mapped labor or inflation claims remain unverified."}`;
      if (rateClaim && !evidence.includes("^TNX rate anchor")) evidence += ` ${tnx.length ? "^TNX rate anchor attached with latest daily 10-year Treasury yield and 1-month change, both dated and source-linked." : "^TNX rate anchor unavailable; rate/yield claims retain no Treasury-yield confirmation."}`;
      return { ...layer, evidence };
    });
    const sourcesJson = JSON.stringify(sources); const layersJson = JSON.stringify(layers); if (sourcesJson !== row.sourcesJson || layersJson !== row.layersJson) await db.update(schema.machineTheories).set({ sourcesJson, layersJson }).where(eq(schema.machineTheories.id, row.id));
    return { ...row, sourcesJson, layersJson };
  }));
}
function mapMachineTheory(row: typeof schema.machineTheories.$inferSelect, positioning: TheoryPositioning, sentimentRows: Array<typeof schema.theorySentimentEvidence.$inferSelect> = []): z.infer<typeof machineTheoryView> {
  const sources = parseSources(row.sourcesJson); const creationPrice = row.invalidationCreationPrice; const direction = row.expectedDirection;
  const tripwire = row.invalidationSymbol && row.invalidationOperator && row.invalidationLevel != null && creationPrice != null && direction !== "none" && ((direction === "long" && row.invalidationOperator === "below" && row.invalidationLevel < creationPrice) || (direction === "short" && row.invalidationOperator === "above" && row.invalidationLevel > creationPrice)) ? { symbol: row.invalidationSymbol, operator: row.invalidationOperator, level: row.invalidationLevel, creationPrice, direction, validatedAtCreation: true as const } : null;
  const score = scoreTheoryLayers(parseLayers(row.layersJson));
  return { id: row.id, origin: row.theoryKey.startsWith("synthesis-") ? "market-synthesis" : "machine-found", title: row.title, thesis: row.thesis, domain: row.domain, horizon: row.horizon, weightedScore: score.weightedScore, measuredLayersWithData: score.measuredLayersWithData, evidenceFloorMet: score.evidenceFloorMet, supportLabel: row.status === "invalidated" ? "not supported" : score.supportLabel, status: row.status, confidenceTier: score.confidenceTier, confidenceNote: "Confidence tier is an evidence-quality label from the weighted score, never a probability. A low or negative score means not supported; only positive disproof can invalidate a theory.", directionalPick: score.directionalPickAllowed && row.status !== "invalidated" ? row.directionalPick : "none", expectedDirection: row.expectedDirection, primarySymbol: row.primarySymbol, rivalSymbol: row.rivalSymbol, causalChain: parseTheoryHops(row.causalChainJson, sources), sectorOutlook: asStringArray(row.sectorOutlookJson), layers: score.layers, sources, sentimentEvidence: sentimentRows.map(sentimentEvidenceMap), sourceIntegrity: row.sourceIntegrity, independentSourceCount: row.independentSourceCount, integrityNote: row.integrityNote, countercase: row.countercase, invalidation: row.invalidationText, tripwire, positioning, foundAt: row.foundAt.toISOString(), checkedAt: row.checkedAt.toISOString(), socialEvidenceState: "Stocktwits + Reddit chatter, refreshed per ticker. X isn't included — it needs paid API access." };
}
const candidateHopSchema = z.object({ from: z.string(), to: z.string(), mechanism: z.string(), kind: z.enum(["evidence", "inference"]), sourceIndexes: z.array(z.number().int().min(1)).max(4) });
const candidateSchema = z.array(z.object({ title: z.string(), thesis: z.string(), domain: z.enum(["macro regime", "energy", "metals/minerals", "rates", "sector rotation", "AI/robotics supply chain", "geopolitics/war", "semiconductors"]), horizon: z.enum(["weeks", "months", "quarters"]), primarySymbol: z.string().min(1).max(20), rivalSymbol: z.string().max(20).nullable(), expectedDirection: z.enum(["long", "short", "none"]), causalChain: z.array(candidateHopSchema).min(3).max(7), sectorOutlook: z.array(z.string()).min(1).max(5), countercase: z.string(), sourceIndexes: z.array(z.number().int().min(1)).min(1).max(8) })).max(5);
function theoryKey(candidate: CandidateTheory) { return cleanKey(`${candidate.domain}|${candidate.primarySymbol}|${candidate.rivalSymbol ?? "none"}`); }
function chartSummary(result: z.infer<typeof analyzeResponse> | null) { if (!result?.instrument || !result.factorModel) return null; return { symbol: result.instrument.symbol, price: result.instrument.price, score: result.factorModel.score, ret15: getMetric(result.returns, "15d"), ret30: getMetric(result.returns, "30d"), ret90: getMetric(result.returns, "90d"), rsi: getMetric(result.indicators, "RSI 14"), volumeZ: getMetric(result.indicators, "Volume z"), sma50Vote: result.factorModel.factors.find((item) => item.name === "Price vs SMA 50")?.score ?? 0, asOf: result.instrument.asOf, levels: result.levels }; }
function directionFromOperator(operator: "above" | "below" | null): "long" | "short" | "none" { return operator === "below" ? "long" : operator === "above" ? "short" : "none"; }
function tripwireForDirection(primary: ReturnType<typeof chartSummary>, direction: "long" | "short" | "none"): { level: number; operator: "above" | "below"; creationPrice: number; method: string } | null {
  if (!primary) return null;
  const price = primary.price;
  if (direction === "none" || price == null || !Number.isFinite(price) || price <= 0) return null;
  const matchingLevel = primary.levels?.direction === direction ? primary.levels.invalidation : null;
  const matchingIsValid = matchingLevel != null && Number.isFinite(matchingLevel) && (direction === "long" ? matchingLevel < price : matchingLevel > price);
  const inheritedDistance = primary.levels ? Math.abs(price - primary.levels.invalidation) : 0;
  const distance = Math.max(inheritedDistance, price * 0.03, 0.01);
  const level = round(matchingIsValid ? matchingLevel : direction === "long" ? price - distance : price + distance);
  if (!(level > 0) || (direction === "long" ? level >= price : level <= price)) return null;
  return { level, operator: direction === "long" ? "below" : "above", creationPrice: round(price), method: matchingIsValid ? "same-direction technical level" : "direction-specific volatility distance" };
}
type SmartMoneyAssessment = { verdict: LayerVerdict; evidence: string; sources: DiscoverySource[] };
async function issuerCik(symbol: string): Promise<string | null> {
  const map = await cachedSecTickerMap();
  const match = Object.values(map).find((row) => row.ticker.toUpperCase() === symbol.toUpperCase());
  return match ? String(match.cik_str).padStart(10, "0") : null;
}
type BlsPoint = { asOf: string; value: number };
type BlsTrendAnalysis = {
  state: "available" | "no_data";
  slope3m: number | null;
  slope6m: number | null;
  priorSlope3m: number | null;
  acceleration: number | null;
  noiseSigma24m: number | null;
  latestDelta: number | null;
  versusTrend: number | null;
  inflection: boolean | null;
  reason: string | null;
};
type BlsObservation = { seriesId: string; label: string; latest: number; prior: number; asOf: string; priorAsOf: string; detail: string; points: BlsPoint[]; trend: BlsTrendAnalysis | null };
type BlsCachePayload = { version: 2; retrievedAt: string; observations: BlsObservation[] };
const BLS_SOURCE_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const BLS_SERIES = { payrolls: "CES0000000001", unemployment: "LNS14000000", cpi: "CUUR0000SA0" } as const;
const BLS_LABELS: Record<string, string> = { [BLS_SERIES.payrolls]: "Total nonfarm payrolls", [BLS_SERIES.unemployment]: "Unemployment rate", [BLS_SERIES.cpi]: "CPI-U all items" };
function olsMonthlySlope(points: BlsPoint[]): number | null {
  if (points.length < 2) return null;
  const meanX = (points.length - 1) / 2; const meanY = average(points.map((point) => point.value));
  if (meanY == null) return null;
  let numerator = 0; let denominator = 0;
  for (let index = 0; index < points.length; index++) { const point = points[index]; if (!point) continue; const centeredX = index - meanX; numerator += centeredX * (point.value - meanY); denominator += centeredX ** 2; }
  return denominator > 0 ? numerator / denominator : null;
}
function populationStd(values: number[]): number | null {
  const mean = average(values); if (mean == null || values.length < 2) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}
function blsTrendAnalysis(pointsAscending: BlsPoint[]): BlsTrendAnalysis {
  // The 24-month noise gate needs 25 observations to form 24 monthly deltas.
  if (pointsAscending.length < 25) return { state: "no_data", slope3m: null, slope6m: null, priorSlope3m: null, acceleration: null, noiseSigma24m: null, latestDelta: null, versusTrend: null, inflection: null, reason: `NO_DATA: ${pointsAscending.length} monthly observations; at least 25 are required for the 24-month rolling noise gate.` };
  const latestSix = pointsAscending.slice(-6); const latestThree = pointsAscending.slice(-3); const priorThree = pointsAscending.slice(-6, -3);
  const slope3m = olsMonthlySlope(latestThree); const slope6m = olsMonthlySlope(latestSix); const priorSlope3m = olsMonthlySlope(priorThree);
  const deltas = pointsAscending.slice(1).map((point, index) => point.value - (pointsAscending[index]?.value ?? point.value)); const latest24Deltas = deltas.slice(-24); const noiseSigma24m = populationStd(latest24Deltas); const latestDelta = deltas.at(-1) ?? null;
  if (slope3m == null || slope6m == null || priorSlope3m == null || noiseSigma24m == null || latestDelta == null) return { state: "no_data", slope3m: null, slope6m: null, priorSlope3m: null, acceleration: null, noiseSigma24m: null, latestDelta: null, versusTrend: null, inflection: null, reason: "NO_DATA: the cached monthly series did not contain enough finite values for all slope and noise calculations." };
  const signFlip = (slope3m > 0 && priorSlope3m < 0) || (slope3m < 0 && priorSlope3m > 0); const beyondNoise = noiseSigma24m > 0 && Math.abs(latestDelta) > noiseSigma24m;
  return { state: "available", slope3m, slope6m, priorSlope3m, acceleration: slope3m - priorSlope3m, noiseSigma24m, latestDelta, versusTrend: latestDelta - slope6m, inflection: signFlip && beyondNoise, reason: null };
}
function signed(value: number, places = 2): string { return `${value >= 0 ? "+" : ""}${round(value, places)}`; }
function blsTrendDetail(seriesId: string, label: string, pointsAscending: BlsPoint[], analysis: BlsTrendAnalysis): string {
  const latest = pointsAscending.at(-1); const prior = pointsAscending.at(-2); if (!latest || !prior) return `NO_DATA: ${label} lacks two monthly observations. Source BLS ${seriesId}.`;
  if (analysis.state === "no_data") return `${label} ${latest.value} as of ${latest.asOf}; prior ${prior.value} as of ${prior.asOf}. ${analysis.reason ?? "NO_DATA: trend calculation unavailable."} Source BLS ${seriesId}; as of ${latest.asOf}.`;
  const unit = seriesId === BLS_SERIES.unemployment ? "pp" : "index points"; const monthlyPct = seriesId === BLS_SERIES.cpi && prior.value !== 0 ? ` (${signed((latest.value / prior.value - 1) * 100)}%)` : "";
  const accelerationWord = (analysis.acceleration ?? 0) > 0 ? "accelerating" : (analysis.acceleration ?? 0) < 0 ? "decelerating" : "unchanged";
  const signFlip = analysis.slope3m != null && analysis.priorSlope3m != null && ((analysis.slope3m > 0 && analysis.priorSlope3m < 0) || (analysis.slope3m < 0 && analysis.priorSlope3m > 0));
  const inflectionText = analysis.inflection ? `Inflection YES: the 3m slope changed sign and the latest monthly move ${signed(analysis.latestDelta ?? 0)} ${unit} exceeded the 24m noise threshold ±${round(analysis.noiseSigma24m ?? 0, 3)} ${unit}.` : `Inflection no: ${signFlip ? "slope sign flipped, but" : "no slope sign flip and"} the ±1σ gate was not fully cleared (latest move ${signed(analysis.latestDelta ?? 0)} ${unit}; 24m σ ${round(analysis.noiseSigma24m ?? 0, 3)} ${unit}).`;
  return `${label} ${latest.value} as of ${latest.asOf}; prior ${prior.value} as of ${prior.asOf}; print vs prior ${signed(analysis.latestDelta ?? 0)} ${unit}${monthlyPct}; print vs 6m trend ${signed(analysis.versusTrend ?? 0)} ${unit}. 3m OLS slope ${signed(analysis.slope3m ?? 0)} ${unit}/mo; 6m OLS slope ${signed(analysis.slope6m ?? 0)} ${unit}/mo; ${accelerationWord} vs prior 3m (${signed(analysis.acceleration ?? 0)} ${unit}/mo; prior slope ${signed(analysis.priorSlope3m ?? 0)}). ${inflectionText} Source BLS ${seriesId}; as of ${latest.asOf}. This is print-vs-prior and print-vs-trend evidence, not surprise-vs-consensus and not a forecast.`;
}
function parseBlsCachePayload(value: string): BlsCachePayload | null {
  try { const parsed = JSON.parse(value) as Partial<BlsCachePayload>; return parsed.version === 2 && Array.isArray(parsed.observations) && typeof parsed.retrievedAt === "string" ? parsed as BlsCachePayload : null; } catch { return null; }
}
function blsSeriesIdsForText(value: string): string[] {
  const text = value.toLowerCase(); const ids: string[] = [];
  if (/\b(payrolls?|nonfarm|jobs?|employment|labor market|labour market)\b/.test(text)) ids.push(BLS_SERIES.payrolls);
  if (/\b(unemployment|jobless(?:ness)?|labor slack|labour slack)\b/.test(text)) ids.push(BLS_SERIES.unemployment);
  if (/\b(cpi|inflation|consumer prices?|price pressures?|disinflation)\b/.test(text)) ids.push(BLS_SERIES.cpi);
  return [...new Set(ids)];
}
async function blsMacroEvidence(ctx: Ctx, requestedSeriesIds?: string[]): Promise<DiscoverySource[]> {
  const month = new Date().toISOString().slice(0, 7); const db = ctx.db<typeof schema>(); const cached = (await db.select().from(schema.blsMonthlyCache).where(eq(schema.blsMonthlyCache.cacheMonth, month)).limit(1))[0];
  let payload: BlsCachePayload | null = cached ? parseBlsCachePayload(cached.payloadJson) : null;
  if (!payload) {
    const endYear = new Date().getUTCFullYear(); const startYear = endYear - 3; const response = await fetch(BLS_SOURCE_URL, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Muse Equity Analyzer support@meta.com" }, body: JSON.stringify({ seriesid: Object.values(BLS_SERIES), startyear: String(startYear), endyear: String(endYear) }) });
    if (!response.ok) return [];
    const raw = await response.json() as { status?: string; Results?: { series?: Array<{ seriesID?: string; data?: Array<{ year?: string; period?: string; value?: string }> }> } };
    if (raw.status !== "REQUEST_SUCCEEDED") return [];
    const observations: BlsObservation[] = [];
    for (const series of raw.Results?.series ?? []) {
      const seriesId = series.seriesID ?? ""; const label = BLS_LABELS[seriesId]; if (!label) continue;
      const points = (series.data ?? []).flatMap((row) => { const value = Number(row.value); const period = row.period ?? ""; const monthNumber = Number(period.slice(1)); return row.year && /^M(0[1-9]|1[0-2])$/.test(period) && Number.isFinite(value) ? [{ value, asOf: `${row.year}-${String(monthNumber).padStart(2, "0")}` }] : []; }).sort((a, b) => a.asOf.localeCompare(b.asOf));
      const latest = points.at(-1); const prior = points.at(-2); if (!latest || !prior) continue;
      const trend = seriesId === BLS_SERIES.unemployment || seriesId === BLS_SERIES.cpi ? blsTrendAnalysis(points) : null;
      let detail = `${label} ${latest.value} as of ${latest.asOf}; prior ${prior.value} as of ${prior.asOf}.`;
      if (seriesId === BLS_SERIES.payrolls) { const thirdPrior = points.at(-4); detail += thirdPrior ? ` Three-month change ${signed(latest.value - thirdPrior.value, 1)} thousand from ${thirdPrior.asOf}. Source BLS ${seriesId}; as of ${latest.asOf}.` : ` NO_DATA: three-month change unavailable. Source BLS ${seriesId}; as of ${latest.asOf}.`; }
      else if (trend) detail = blsTrendDetail(seriesId, label, points, trend);
      observations.push({ seriesId, label, latest: latest.value, prior: prior.value, asOf: latest.asOf, priorAsOf: prior.asOf, detail, points, trend });
    }
    payload = { version: 2, retrievedAt: new Date().toISOString(), observations };
    await db.insert(schema.blsMonthlyCache).values({ cacheMonth: month, payloadJson: JSON.stringify(payload), retrievedAt: new Date() }).onConflictDoUpdate({ target: schema.blsMonthlyCache.cacheMonth, set: { payloadJson: JSON.stringify(payload), retrievedAt: new Date() } });
  }
  const wanted = requestedSeriesIds ? new Set(requestedSeriesIds) : null;
  return payload.observations.filter((row) => !wanted || wanted.has(row.seriesId)).map((row) => ({ title: `${row.label} · ${row.seriesId}`, url: BLS_SOURCE_URL, source: "U.S. Bureau of Labor Statistics", snippet: `${row.detail} Monthly observations; retrieved ${payload!.retrievedAt}.`, publishedAt: row.asOf, retrievedAt: payload!.retrievedAt, singleSource: false }));
}
function blsSeriesIdsForCandidate(candidate: CandidateTheory): string[] { return blsSeriesIdsForText(candidateTheoryText(candidate)); }
function macroTheoryNeedsBls(candidate: CandidateTheory): boolean { return blsSeriesIdsForCandidate(candidate).length > 0; }
function macroTheoryNeedsTnx(candidate: CandidateTheory): boolean { const text = candidateTheoryText(candidate); return candidate.domain === "rates" || /\b(rates?|yields?|treasur(?:y|ies)|fed|fomc|duration)\b/.test(text); }
async function tnxMacroEvidence(ctx: Ctx): Promise<DiscoverySource[]> {
  const series = await yahooFullHistory(ctx, "^TNX");
  const latest = series.points.at(-1); const oneMonthPrior = series.points.at(-22);
  if (!latest || !oneMonthPrior) return [];
  const changePoints = latest.close - oneMonthPrior.close;
  const retrievedAt = new Date().toISOString();
  return [{
    title: "U.S. 10-year Treasury yield · ^TNX",
    url: series.sourceUrl,
    source: "Yahoo Finance",
    snippet: `^TNX daily close ${round(latest.close, 3)}% as of ${latest.date}; 1-month change ${changePoints >= 0 ? "+" : ""}${round(changePoints, 3)} percentage points (${changePoints >= 0 ? "+" : ""}${round(changePoints * 100, 1)} bps) since ${oneMonthPrior.date}. Source: Yahoo Finance chart.`,
    publishedAt: latest.date,
    retrievedAt,
    singleSource: false,
  }];
}
async function congressionalDisclosureRows(ctx: Ctx, symbol: string) {
  const result = await ctx.tool.web_search(`${symbol} congressional stock trade disclosure House Senate periodic transaction report`);
  return (result.content?.results ?? []).filter((row) => !row.is_index_page && row.url).slice(0, 6).map((row) => ({ title: row.title, source: row.source ?? "Unknown source", snippet: row.snippet ?? "", publishedAt: row.published_at, url: row.url ?? "" }));
}
async function assessSmartMoney(ctx: Ctx, symbol: string, issuerName: string, direction: "long" | "short" | "none"): Promise<SmartMoneyAssessment> {
  const retrievedAt = new Date(); const sources: DiscoverySource[] = []; const notes: string[] = [];
  let insiders: Awaited<ReturnType<typeof insiderRows>> = []; let holdings: NonNullable<Awaited<ReturnType<typeof managerHolding>>>[] = []; let congressional: Awaited<ReturnType<typeof congressionalDisclosureRows>> = [];
  try { const cik = await issuerCik(symbol); if (cik) insiders = await insiderRows(cik); else notes.push("SEC issuer mapping unavailable"); } catch { notes.push("Form 4 unavailable"); }
  try { const settled = await Promise.allSettled(managers.map((manager) => managerHolding(manager, issuerName))); holdings = settled.flatMap((row) => row.status === "fulfilled" && row.value ? [row.value] : []); } catch { notes.push("13F watchlist unavailable"); }
  try { congressional = await congressionalDisclosureRows(ctx, symbol); } catch { notes.push("congressional disclosures unavailable"); }
  const cutoff = Date.now() - 30 * 86400000; const recentInsiders = insiders.filter((row) => Number.isFinite(Date.parse(row.date)) && Date.parse(row.date) >= cutoff);
  const buyers = new Set(recentInsiders.filter((row) => row.type === "Buy").map((row) => row.owner)); const sellers = new Set(recentInsiders.filter((row) => row.type === "Sell").map((row) => row.owner));
  for (const row of recentInsiders.slice(0, 4)) sources.push({ title: `Form 4 · ${row.owner} · ${row.type}`, url: row.sourceUrl, source: "SEC EDGAR", snippet: `${row.type} ${row.shares} shares on ${row.date}`, publishedAt: row.date, retrievedAt: retrievedAt.toISOString(), singleSource: true });
  const hasBuyCluster = buyers.size >= 2; const hasSellCluster = sellers.size >= 2;
  if (hasBuyCluster || hasSellCluster) {
    const supports = direction === "long" ? hasBuyCluster : direction === "short" ? hasSellCluster : false; const opposes = direction === "long" ? hasSellCluster : direction === "short" ? hasBuyCluster : false;
    if (supports && opposes) return { verdict: "mixed", evidence: `Form 4 precedence: both ${buyers.size}-insider buying and ${sellers.size}-insider selling clusters occurred within 30 days.`, sources };
    return { verdict: opposes ? "disagree" : supports ? "agree" : "mixed", evidence: `Form 4 precedence: ${buyers.size} distinct buyers and ${sellers.size} distinct sellers within 30 days.${opposes ? " Insider cluster opposes the thesis; hard FAIL." : ""}`, sources };
  }
  const congressionalText = congressional.map((row) => `${row.title} ${row.snippet}`).join(" ").toLowerCase(); const congressBuy = /\b(buy|bought|purchase|purchased|acquired)\b/.test(congressionalText); const congressSell = /\b(sell|sold|sale|disposed)\b/.test(congressionalText);
  for (const row of congressional.slice(0, 3)) sources.push({ title: row.title, url: row.url, source: row.source, snippet: row.snippet, publishedAt: row.publishedAt, retrievedAt: retrievedAt.toISOString(), singleSource: true });
  if (congressBuy || congressSell) { const supports = direction === "long" ? congressBuy && !congressSell : direction === "short" ? congressSell && !congressBuy : false; const opposes = direction === "long" ? congressSell && !congressBuy : direction === "short" ? congressBuy && !congressSell : false; return { verdict: supports ? "agree" : opposes ? "disagree" : "mixed", evidence: `Congressional-disclosure precedence: ${congressBuy ? "buy language present" : "no buy language"}; ${congressSell ? "sell language present" : "no sell language"}. Disclosures are delayed and source-linked.`, sources }; }
  const recentHoldings = holdings.sort((a, b) => b.reportDate.localeCompare(a.reportDate)); const exits = recentHoldings.filter((row) => row.change === "Exited"); const adds = recentHoldings.filter((row) => row.change === "New stake" || row.change === "Added");
  for (const row of recentHoldings.slice(0, 5)) sources.push({ title: `13F-HR · ${row.manager} · ${row.change}`, url: row.sourceUrl, source: "SEC EDGAR", snippet: `${row.change}; report ${row.reportDate}; filed ${row.filingDate}`, publishedAt: row.filingDate, retrievedAt: retrievedAt.toISOString(), singleSource: true });
  if (recentHoldings.length) { const opposes = direction === "long" ? exits.length > adds.length : direction === "short" ? adds.length > exits.length : false; const supports = direction === "long" ? adds.length > exits.length : direction === "short" ? exits.length > adds.length : false; return { verdict: opposes ? "disagree" : supports ? "agree" : "mixed", evidence: `13F precedence (45+ day lag; never sufficient alone for a weeks-horizon thesis): ${adds.length} additions/new stakes and ${exits.length} exits across the whale watchlist.${opposes && exits.length ? " Net exits oppose the thesis; hard FAIL." : ""}`, sources }; }
  return { verdict: "unavailable", evidence: `NO_DATA: no matching Form 4 cluster, congressional disclosure, or 13F whale position. ${notes.join("; ") || "Feeds returned no relevant rows"}. Confidence is capped.`, sources };
}
function chartLayerVerdict(direction: "long" | "short" | "none", score: number | null): LayerVerdict {
  if (score == null || direction === "none") return score == null ? "unavailable" : "mixed";
  const signed = direction === "long" ? score : -score;
  return signed >= 50 ? "agree" : signed <= -50 ? "disagree" : "mixed";
}
function candidateTheoryText(candidate: CandidateTheory): string {
  const chain = candidate.causalChain.flatMap((hop) => [hop.from, hop.to, hop.mechanism]).join(" ");
  return `${candidate.title} ${candidate.thesis} ${chain}`.toLowerCase();
}
function theoryPolymarketQueries(candidate: CandidateTheory): string[] {
  const specific = candidate.title.replace(/[^a-zA-Z0-9\s-]/g, " ").replace(/\s+/g, " ").trim(); const topic = marketKeywords(`${candidate.title} ${candidate.thesis} ${candidate.domain}`).slice(0, 6).join(" ");
  return [...new Set([specific, `${candidate.domain} ${candidate.primarySymbol}`, topic].map((value) => value.trim()).filter(Boolean))].slice(0, 3);
}
function needsMacroAnchorMarkets(candidate: CandidateTheory): boolean {
  const domain = String(candidate.domain).toLowerCase(); const theory = candidateTheoryText(candidate);
  return ["rates", "macro regime", "monetary policy", "sector rotation"].includes(domain) || /\b(fed|fomc|federal reserve|interest rates?|cpi|inflation|treasury yields?)\b/.test(theory);
}
function nearestUpcomingFedMarketSet(rows: PolymarketSearchMarket[]): PolymarketSearchMarket[] {
  const relevant = rows.filter((row) => /\b(fed|fomc|federal reserve|interest rates?)\b/i.test(`${row.eventTitle ?? ""} ${row.question}`));
  const dated = relevant.map((row) => ({ row, end: row.eventEndDate ? Date.parse(row.eventEndDate) : NaN })).filter((item) => Number.isFinite(item.end) && item.end >= Date.now()).sort((a, b) => a.end - b.end);
  const nearest = dated[0];
  if (!nearest) return relevant;
  if (nearest.row.eventTitle) return dated.filter((item) => item.row.eventTitle === nearest.row.eventTitle).map((item) => item.row);
  return dated.filter((item) => item.end === nearest.end).map((item) => item.row);
}
function explicitTheoryWantsYes(candidate: CandidateTheory, question: string): boolean | null {
  const theory = candidateTheoryText(candidate); const asked = question.toLowerCase();
  const fedCut = /\b(fed|fomc|rates?|monetary policy)\b.{0,45}\b(cut|cuts|cutting|decrease|decreases|lower|lowers|easing|dovish)\b|\b(rate cuts?|monetary easing)\b/.test(theory);
  const fedHike = /\b(fed|fomc|rates?|monetary policy)\b.{0,45}\b(hike|hikes|hiking|increase|increases|raise|raises|higher|tightening|hawkish)\b|\b(rate hikes?|monetary tightening|higher for longer)\b/.test(theory);
  const fedHold = /\b(fed|fomc|rates?|monetary policy)\b.{0,45}\b(hold|holds|pause|pauses|unchanged|no change)\b|\b(higher for longer|no rate (cut|cuts|hike|hikes))\b/.test(theory);
  if (/\b(fed|fomc|federal reserve|interest rates?)\b/.test(asked)) {
    if (/\b(increase|hike|raise|higher)\b/.test(asked)) { if (fedHike) return true; if (fedCut || fedHold) return false; }
    if (/\b(decrease|cut|lower)\b/.test(asked)) { if (fedCut) return true; if (fedHike || fedHold) return false; }
    if (/\b(no change|unchanged|hold)\b/.test(asked)) { if (fedHold) return true; if (fedCut || fedHike) return false; }
  }
  const inflationHigher = /\b(inflation|cpi)\b.{0,45}\b(rise|rises|rising|increase|increases|higher|above|hot|hotter|accelerate|accelerates|sticky)\b|\b(higher|hotter|accelerating|sticky)\b.{0,30}\b(inflation|cpi)\b/.test(theory);
  const inflationLower = /\b(inflation|cpi)\b.{0,45}\b(fall|falls|falling|decrease|decreases|lower|below|cool|cools|cooling|decelerate|decelerates|disinflation)\b|\b(lower|cooling|decelerating)\b.{0,30}\b(inflation|cpi)\b/.test(theory);
  if (/\b(cpi|consumer price|inflation)\b/.test(asked)) {
    const asksHigher = /\b(above|over|higher|at least|exceed|rise|increase)\b/.test(asked); const asksLower = /\b(below|under|lower|at most|fall|decrease)\b/.test(asked);
    if (asksHigher && !asksLower) { if (inflationHigher) return true; if (inflationLower) return false; }
    if (asksLower && !asksHigher) { if (inflationLower) return true; if (inflationHigher) return false; }
  }
  const yieldsHigher = /\b(treasury yields?|yields?)\b.{0,35}\b(rise|rises|rising|increase|higher|above|steepen|steepening)\b|\b(higher|rising)\b.{0,20}\b(treasury yields?|yields?)\b/.test(theory);
  const yieldsLower = /\b(treasury yields?|yields?)\b.{0,35}\b(fall|falls|falling|decrease|lower|below|decline|declining)\b|\b(lower|falling)\b.{0,20}\b(treasury yields?|yields?)\b/.test(theory);
  if (/\b(treasury|yield)\b/.test(asked)) {
    const asksHigher = /\b(above|over|higher|at least|exceed|rise|increase)\b/.test(asked); const asksLower = /\b(below|under|lower|at most|fall|decrease)\b/.test(asked);
    if (asksHigher && !asksLower) { if (yieldsHigher) return true; if (yieldsLower) return false; }
    if (asksLower && !asksHigher) { if (yieldsLower) return true; if (yieldsHigher) return false; }
  }
  if (/recession/.test(asked)) { if (/no recession|avoid.{0,20}recession|soft landing/.test(theory)) return false; if (/recession|hard landing/.test(theory)) return true; }
  if (/bitcoin|ethereum|crypto/.test(asked)) { if (/approve|approval|launch|adopt/.test(asked) && /approve|approval|launch|adopt/.test(theory)) return true; if (/reject|delay|ban/.test(theory)) return false; }
  return null;
}
async function crowdPricingLayer(candidate: CandidateTheory): Promise<{ layer: TheoryLayer; source: DiscoverySource | null }> {
  const keywordQueries = theoryPolymarketQueries(candidate); const anchorQueries = needsMacroAnchorMarkets(candidate) ? ["fed decision", "CPI", "inflation"] : []; const allQueries = [...keywordQueries, ...anchorQueries];
  const results = await Promise.all(allQueries.map((query) => fetchPolymarketSearch(query))); const keywordResults = results.slice(0, keywordQueries.length); const anchorResults = results.slice(keywordQueries.length); const topic = `${candidate.title} ${candidate.thesis} ${candidate.domain}`;
  const keywordRanked = [...new Map(keywordResults.flatMap((result) => result.rows).map((row) => [row.slug, row])).values()].map((row) => ({ row, score: keywordOverlapScore(topic, row.question, row.eventTitle), wantsYes: explicitTheoryWantsYes(candidate, row.question), anchor: false })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.row.volume24hr - a.row.volume24hr);
  const fedAnchors = nearestUpcomingFedMarketSet(anchorResults[0]?.rows ?? []); const inflationAnchors = [...(anchorResults[1]?.rows ?? []), ...(anchorResults[2]?.rows ?? [])].filter((row) => /\b(cpi|consumer price|inflation)\b/i.test(`${row.eventTitle ?? ""} ${row.question}`));
  const anchorRanked = [...new Map([...fedAnchors, ...inflationAnchors].map((row) => [row.slug, row])).values()].map((row) => ({ row, score: keywordOverlapScore(topic, row.question, row.eventTitle), wantsYes: explicitTheoryWantsYes(candidate, row.question), anchor: true })).sort((a, b) => Number(b.wantsYes != null) - Number(a.wantsYes != null) || b.score - a.score || b.row.volume24hr - a.row.volume24hr);
  const best = anchorRanked.find((item) => item.wantsYes != null) ?? keywordRanked.find((item) => item.wantsYes != null) ?? keywordRanked[0] ?? anchorRanked[0];
  if (!best) { const failures = results.map((result) => result.error).filter((value): value is string => !!value); return { layer: makeTheoryLayer("crowd_pricing", "no_data", `NO_DATA: searched ${allQueries.map((query) => `“${query}”`).join(", ")}; ${failures[0] ?? "no active relevant market passed the $1k 24-hour volume and $1k liquidity gate"}. Context only; zero score weight and never a veto.`), source: null }; }
  const market = best.row; const wantsYes = best.wantsYes; const alignedCrowdPrice = wantsYes == null ? null : wantsYes ? market.yesImpliedCrowdPrice : market.noImpliedCrowdPrice; const verdict: LayerVerdict = alignedCrowdPrice == null ? "mixed" : alignedCrowdPrice > 0.6 ? "agree" : alignedCrowdPrice < 0.4 ? "disagree" : "mixed";
  const directionalNote = wantsYes == null ? `${best.anchor ? "Standing macro anchor market" : "Relevant market"}; informational hint only because the theory does not map explicitly to this market's Yes/No direction.` : `${best.anchor ? "Standing macro anchor market. " : ""}The theory explicitly maps to the ${wantsYes ? "Yes" : "No"} outcome; its implied crowd price ${alignedCrowdPrice?.toFixed(4) ?? "unavailable"} ${verdict === "agree" ? "aligns" : verdict === "disagree" ? "contradicts" : "is not decisive for"} that directional assumption.`;
  const evidence = `Polymarket: ${market.question} Yes implied crowd price ${market.yesImpliedCrowdPrice.toFixed(4)}; No implied crowd price ${market.noImpliedCrowdPrice.toFixed(4)}; 24h volume $${Math.round(market.volume24hr).toLocaleString("en-US")}; liquidity $${Math.round(market.liquidity).toLocaleString("en-US")}; as of ${market.asOf}. ${directionalNote}`;
  return { layer: makeTheoryLayer("crowd_pricing", verdict, `${evidence} Context only; zero score weight and never a veto.`, ["polymarket"]), source: { title: market.question, url: market.marketUrl, source: "Polymarket", snippet: evidence, publishedAt: null, retrievedAt: market.asOf, singleSource: false } };
}
async function verifyCandidate(ctx: Ctx, candidate: CandidateTheory, sources: DiscoverySource[], analyses: Map<string, z.infer<typeof analyzeResponse>>, socialBySymbol: Map<string, SocialChatter>, smart: SmartMoneyAssessment): Promise<{ row: Omit<typeof schema.machineTheories.$inferInsert, "id" | "foundAt" | "checkedAt">; surfaced: boolean }> {
  const primary = chartSummary(analyses.get(candidate.primarySymbol) ?? null); const rival = candidate.rivalSymbol ? chartSummary(analyses.get(candidate.rivalSymbol) ?? null) : null;
  const globalSourceIndexes = [...new Set(candidate.sourceIndexes)].filter((index) => !!sources[index - 1]);
  const crowd = await crowdPricingLayer(candidate);
  const freshSentimentSnapshots = await latestFreshSentiment(ctx, [candidate.primarySymbol, ...(candidate.rivalSymbol ? [candidate.rivalSymbol] : [])]);
  const freshSentimentArticles = freshSentimentSnapshots.flatMap((snapshot) => parseSentimentArticles(snapshot.articlesJson).map((article) => ({ snapshot, article, stance: sentimentStance(article.tickerLabel, candidate.expectedDirection) })));
  const sentimentAsOf = freshSentimentSnapshots.map((snapshot) => snapshot.asOf).sort().at(-1) ?? null; const sentimentConfirming = freshSentimentArticles.filter((item) => item.stance === "confirming").length; const sentimentChallenging = freshSentimentArticles.filter((item) => item.stance === "challenging").length; const sentimentNeutral = freshSentimentArticles.filter((item) => item.stance === "neutral").length;
  const sentimentNote = sentimentAsOf ? ` Sentiment context: Alpha Vantage NEWS_SENTIMENT as of ${sentimentAsOf}; ${freshSentimentArticles.length} article${freshSentimentArticles.length === 1 ? "" : "s"}: ${sentimentConfirming} confirming, ${sentimentChallenging} challenging, ${sentimentNeutral} neutral. This is attention/mood context only, adds zero to directional factor agreement, and cannot verify the thesis alone.` : " Sentiment context: NO_DATA — no Alpha Vantage NEWS_SENTIMENT snapshot at or under 48 hours old. Missing sentiment is not a failure and is not scored.";
  const blsSeriesIds = blsSeriesIdsForCandidate(candidate); const needsBls = macroTheoryNeedsBls(candidate); const needsTnx = macroTheoryNeedsTnx(candidate);
  const [blsSources, tnxSources, finnhubSources] = await Promise.all([needsBls ? blsMacroEvidence(ctx, blsSeriesIds).catch(() => []) : [], needsTnx ? tnxMacroEvidence(ctx).catch(() => []) : [], finnhubTheorySources(ctx, [candidate.primarySymbol, ...(candidate.rivalSymbol ? [candidate.rivalSymbol] : []), "MARKET"])]);
  const narrativeSources = [...globalSourceIndexes.flatMap((index) => sources[index - 1] ? [sources[index - 1]!] : []), ...finnhubSources]; const linkedSources = [...narrativeSources, ...smart.sources, ...blsSources, ...tnxSources, ...(crowd.source ? [crowd.source] : [])];
  const localIndex = new Map(globalSourceIndexes.map((value, index) => [value, index + 1]));
  const social = socialBySymbol.get(candidate.primarySymbol); const socialConflict = social?.theoryRead === "challenges";
  const desiredSign = candidate.expectedDirection === "short" ? -1 : 1; const spread30 = primary?.ret30 != null && rival?.ret30 != null ? primary.ret30 - rival.ret30 : null;
  let unsupportedEvidenceHops = 0; let corroboratedEvidenceHops = 0;
  const verifiedHops: CandidateHop[] = candidate.causalChain.map((hop) => { if (hop.kind === "inference") return { ...hop, sourceIndexes: [] }; const resolved = [...new Set(hop.sourceIndexes)].flatMap((index) => sources[index - 1] ? [sources[index - 1]!] : []); const corroborated = independentSourceCount(resolved) >= 2; if (!corroborated) { unsupportedEvidenceHops += 1; return { ...hop, kind: "inference" as const, sourceIndexes: [] }; } corroboratedEvidenceHops += 1; return { ...hop, sourceIndexes: hop.sourceIndexes.flatMap((index) => localIndex.get(index) ? [localIndex.get(index)!] : []) }; });
  const sourceCount = independentSourceCount(narrativeSources); const sourceIntegrity: "multi_source" | "single_source" = sourceCount >= 2 && corroboratedEvidenceHops > 0 && unsupportedEvidenceHops === 0 ? "multi_source" : "single_source";
  const chartVerdict = chartLayerVerdict(candidate.expectedDirection, primary?.score ?? null); const mathVerdict: LayerVerdict = primary?.ret15 == null || primary.ret30 == null || primary.ret90 == null || (candidate.rivalSymbol && spread30 == null) ? "unavailable" : candidate.expectedDirection === "none" ? "mixed" : desiredSign * primary.ret30 <= -5 || (spread30 != null && desiredSign * spread30 <= -5) ? "disagree" : desiredSign * primary.ret30 >= 5 && (spread30 == null || desiredSign * spread30 > 0) ? "agree" : "mixed";
  const narrativeVerdict: LayerVerdict = candidate.causalChain.length < 3 || candidate.sectorOutlook.length === 0 ? "disagree" : needsBls && blsSources.length === 0 ? "unavailable" : unsupportedEvidenceHops > 0 || socialConflict ? "mixed" : corroboratedEvidenceHops > 0 ? "agree" : "unavailable";
  const newsVerdict: LayerVerdict = sourceIntegrity === "multi_source" ? "agree" : "no_data";
  const chartEvidence = primary ? `${primary.symbol}: factor agreement ${primary.score >= 0 ? "+" : ""}${primary.score}; 15-session ${pctText(primary.ret15)}; 30-session ${pctText(primary.ret30)}; Wilder RSI ${numText(primary.rsi)}; volume z ${numText(primary.volumeZ)}σ${rival ? `. ${rival.symbol}: ${rival.score >= 0 ? "+" : ""}${rival.score} agreement; 30-session spread ${pctText(spread30)}` : ""}.` : "Price/volume/TA unavailable for the primary symbol.";
  const chartSourceKeys = (analyses.get(candidate.primarySymbol)?.instrument?.sources ?? []).map((source) => sourceKeyFromUrl(source.url, source.title.toLowerCase()));
  const narrativeSourceKeys = narrativeSources.map(sourceIdentity); const smartSourceKeys = smart.sources.map(sourceIdentity);
  const scored = scoreTheoryLayers([
    makeTheoryLayer("chart", chartVerdict, chartEvidence, chartSourceKeys),
    makeTheoryLayer("math", mathVerdict, mathVerdict === "unavailable" ? "NO_DATA: required 15/30/90-session return windows or rival comparison are incomplete." : `Exact 15/30/90-session returns: ${pctText(primary?.ret15 ?? null)}, ${pctText(primary?.ret30 ?? null)}, ${pctText(primary?.ret90 ?? null)}${spread30 == null ? "" : `; primary-minus-rival spread ${pctText(spread30)}`}.`, chartSourceKeys),
    makeTheoryLayer("narrative", narrativeVerdict, `${candidate.causalChain.length}-hop chain; ${corroboratedEvidenceHops} corroborated evidence hops; ${unsupportedEvidenceHops} unsupported claims relabeled inference.${needsBls ? blsSources.length ? ` BLS macro anchor attached with ${blsSources.length} claim-mapped monthly series, each labeled by observation month and series ID. Unemployment/CPI evidence includes OLS slopes, acceleration, and the 24-month ±1σ inflection gate; level-3 evidence has zero factor-score weight unless it separately passes the standard factor gates.` : " BLS macro data unavailable; labor, inflation, and rates claims remain unverified." : ""}${needsTnx ? tnxSources.length ? " ^TNX rate anchor attached with latest daily 10-year Treasury yield and 1-month change, both dated and source-linked." : " ^TNX rate anchor unavailable; rate/yield claims retain no Treasury-yield confirmation." : ""}${social?.theoryReadNote ? ` Public chatter: ${social.theoryReadNote}` : ""}`, narrativeSourceKeys),
    makeTheoryLayer("news", newsVerdict, `${sourceIntegrity === "multi_source" ? `${sourceCount} independent publishers corroborate each factual evidence hop.` : narrativeSources.length ? `NO_DATA: ${sourceCount} independent publisher${sourceCount === 1 ? "" : "s"} and/or unsupported evidence hops; corroboration is insufficient, not disproof.` : "NO_DATA: no current linked news sources."}${finnhubSources.length ? ` Finnhub contributed ${finnhubSources.length} fresh article${finnhubSources.length === 1 ? "" : "s"}, each attached with title, summary, URL, publisher, and snapshot as-of; only snapshots at or under 48 hours old count.` : " Finnhub: NO_DATA — no company or market news snapshot at or under 48 hours old; stale evidence was skipped, not scored."}${sentimentNote}`, narrativeSourceKeys),
    makeTheoryLayer("smart_money", smart.verdict, smart.evidence, smartSourceKeys),
    crowd.layer,
  ]);
  // Semantic fail-safe: explicit positive disproof becomes DISAGREE; missing evidence remains NO_DATA.
  for (const layer of scored.layers) if (layer.verdict === "agree" && /\b(disagree|opposes?|against thesis|hard FAIL|factor agreement -\d+)/i.test(layer.evidence)) layer.verdict = "disagree";
  const rescored = scoreTheoryLayers(scored.layers); const layers = rescored.layers; const surfaced = rescored.evidenceFloorMet; const status: "live" | "contested" | "degraded" = !rescored.evidenceFloorMet ? "degraded" : rescored.measuredConflict ? "contested" : "live"; const directionalPick: "long" | "short" | "none" = rescored.directionalPickAllowed ? candidate.expectedDirection : "none";
  const confidenceTier = rescored.confidenceTier;
  const tripwire = sourceIntegrity === "multi_source" && directionalPick !== "none" ? tripwireForDirection(primary, candidate.expectedDirection) : null;
  const invalidationText = tripwire ? `Invalidate on a daily close ${tripwire.operator} ${tripwire.level} in ${candidate.primarySymbol}, combined with a 30-session relative-strength reversal${candidate.rivalSymbol ? ` versus ${candidate.rivalSymbol}` : ""}. Creation quote ${tripwire.creationPrice}; tripwire verified unbreached and computed for the ${candidate.expectedDirection} thesis.` : `No price tripwire is active. Thesis falsification conditions: ${candidate.countercase}`;
  const agreeCount = layers.filter((layer) => layer.verdict === "agree").length; const dedupedCount = layers.filter((layer) => layer.deduplicated).length; const integrityPrefix = sourceIntegrity === "multi_source" ? `MULTI-SOURCE: ${sourceCount} independent publishers.` : "SINGLE SOURCE: key factual claims do not all have two independent publishers.";
  const integrityNote = `${integrityPrefix} Weighted evidence ${rescored.weightedScore >= 0 ? "+" : ""}${rescored.weightedScore}; ${agreeCount} agree, ${layers.filter((layer) => layer.verdict === "disagree").length} disagree, ${layers.filter((layer) => layer.verdict === "mixed").length} mixed, ${layers.filter((layer) => layer.verdict === "no_data").length} NO_DATA${dedupedCount ? `, ${dedupedCount} deduplicated for shared sources` : ""}. ${rescored.supportLabel.toUpperCase()}. Confidence is an evidence-quality tier, never a probability.`;
  return { surfaced, row: { theoryKey: theoryKey(candidate), title: candidate.title, thesis: candidate.thesis, domain: candidate.domain, horizon: candidate.horizon, status, confidenceTier, directionalPick, primarySymbol: candidate.primarySymbol, rivalSymbol: candidate.rivalSymbol, causalChainJson: JSON.stringify(verifiedHops), sectorOutlookJson: JSON.stringify(candidate.sectorOutlook), layersJson: JSON.stringify(layers), sourcesJson: JSON.stringify(linkedSources), countercase: candidate.countercase, invalidationText, invalidationSymbol: tripwire ? candidate.primarySymbol : null, invalidationOperator: tripwire?.operator ?? null, invalidationLevel: tripwire?.level ?? null, expectedDirection: candidate.expectedDirection, invalidationCreationPrice: tripwire?.creationPrice ?? null, sourceIntegrity, independentSourceCount: sourceCount, integrityNote, integrityAuditedAt: new Date(), originatingScanRunId: null } };
}
function pctText(value: number | null) { return value == null ? "unavailable" : `${value >= 0 ? "+" : ""}${round(value)}%`; }
function numText(value: number | null) { return value == null ? "unavailable" : String(round(value)); }
type TheoryIntegrityAudit = { audited: number; singleSourceFlagged: number; bornBreachedFound: number; invalidatedReverted: number; tripwiresCorrected: number; tripwiresRemoved: number };
function rawAuditHops(value: string, sources: DiscoverySource[]): { hops: CandidateHop[]; corroborated: number; unsupported: number } {
  let corroborated = 0, unsupported = 0;
  const hops = parseJsonArray(value).flatMap((item, index): CandidateHop[] => {
    if (typeof item === "string") return [{ from: index === 0 ? "Observed event" : `Hop ${index}`, to: `Hop ${index + 1}`, mechanism: item, kind: "inference", sourceIndexes: [] }];
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.from !== "string" || typeof row.to !== "string" || typeof row.mechanism !== "string" || (row.kind !== "evidence" && row.kind !== "inference")) return [];
    if (row.kind === "inference") return [{ from: row.from, to: row.to, mechanism: row.mechanism, kind: "inference", sourceIndexes: [] }];
    const indexes = Array.isArray(row.sourceIndexes) ? [...new Set(row.sourceIndexes.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n <= sources.length))] : [];
    const evidenceSources = indexes.flatMap((sourceIndex) => sources[sourceIndex - 1] ? [sources[sourceIndex - 1]!] : []);
    if (independentSourceCount(evidenceSources) < 2) { unsupported += 1; return [{ from: row.from, to: row.to, mechanism: row.mechanism, kind: "inference", sourceIndexes: [] }]; }
    corroborated += 1; return [{ from: row.from, to: row.to, mechanism: row.mechanism, kind: "evidence", sourceIndexes: indexes }];
  });
  return { hops, corroborated, unsupported };
}
async function integritySeries(ctx: Ctx, symbol: string): Promise<YahooSeries | null> { const cached = await cachedHistoryOnly(ctx, symbol); if (cached) return cached; try { return await yahooFullHistory(ctx, symbol); } catch { return null; } }
function historicalTripwire(series: YahooSeries | null, foundAt: Date, direction: "long" | "short" | "none") {
  if (!series || direction === "none") return null;
  const day = foundAt.toISOString().slice(0, 10); const history = series.points.filter((point) => point.date <= day); const creation = history[history.length - 1];
  if (!creation || !(creation.close > 0)) return null;
  const volatility = atr(history.slice(-40)) ?? creation.close * 0.03; const distance = Math.max(volatility * 1.25, creation.close * 0.03, 0.01); const level = round(direction === "long" ? creation.close - distance : creation.close + distance);
  if (!(level > 0) || (direction === "long" ? level >= creation.close : level <= creation.close)) return null;
  return { level, operator: direction === "long" ? "below" as const : "above" as const, creationPrice: round(creation.close) };
}
async function auditExistingTheoryIntegrity(ctx: Ctx, force = false): Promise<TheoryIntegrityAudit> {
  const db = ctx.db<typeof schema>(); const rows = await db.select().from(schema.machineTheories); const summary: TheoryIntegrityAudit = { audited: 0, singleSourceFlagged: 0, bornBreachedFound: 0, invalidatedReverted: 0, tripwiresCorrected: 0, tripwiresRemoved: 0 };
  for (const row of rows) {
    if (!force && row.integrityAuditedAt) continue;
    summary.audited += 1; const storedSources = parseSources(row.sourcesJson); const finnhubSources = await finnhubTheorySources(ctx, [row.primarySymbol, ...(row.rivalSymbol ? [row.rivalSymbol] : []), "MARKET"]); const sources = [...storedSources.filter((source) => source.source !== "Finnhub"), ...finnhubSources]; const sourceCount = independentSourceCount(sources.filter((source) => source.source !== "Polymarket" && source.source !== "Alpha Vantage")); const auditedHops = rawAuditHops(row.causalChainJson, sources);
    const sourceIntegrity: "multi_source" | "single_source" = sourceCount >= 2 && auditedHops.corroborated > 0 && auditedHops.unsupported === 0 ? "multi_source" : "single_source";
    if (sourceIntegrity === "single_source") summary.singleSourceFlagged += 1;
    const expectedDirection = row.expectedDirection !== "none" ? row.expectedDirection : directionFromOperator(row.invalidationOperator);
    await syncSentimentEvidence(ctx, "machine", row.id, [row.primarySymbol, ...(row.rivalSymbol ? [row.rivalSymbol] : [])], expectedDirection);
    const sentimentRows = await db.select().from(schema.theorySentimentEvidence).where(and(eq(schema.theorySentimentEvidence.theoryKind, "machine"), eq(schema.theorySentimentEvidence.theoryId, row.id)));
    let series: YahooSeries | null = null; if (row.primarySymbol) series = await integritySeries(ctx, row.primarySymbol);
    const day = row.foundAt.toISOString().slice(0, 10); const creationPoint = series?.points.filter((point) => point.date <= day).at(-1) ?? null; const creationPrice = creationPoint?.close ?? row.invalidationCreationPrice;
    const bornBreached = row.invalidationLevel != null && creationPrice != null && row.invalidationOperator != null && (row.invalidationOperator === "below" ? creationPrice <= row.invalidationLevel : creationPrice >= row.invalidationLevel);
    if (bornBreached) summary.bornBreachedFound += 1;
    let tripwire = sourceIntegrity === "multi_source" ? historicalTripwire(series, row.foundAt, expectedDirection) : null;
    if (row.invalidationLevel != null && !tripwire) summary.tripwiresRemoved += 1;
    if (bornBreached && tripwire) summary.tripwiresCorrected += 1;
    const crowd = await crowdPricingLayer({ title: row.title, thesis: row.thesis, domain: row.domain, horizon: row.horizon, primarySymbol: row.primarySymbol, rivalSymbol: row.rivalSymbol, expectedDirection, causalChain: [], sectorOutlook: asStringArray(row.sectorOutlookJson), countercase: row.countercase, sourceIndexes: [] });
    const finnhubNote = finnhubSources.length ? ` Finnhub re-verification attached ${finnhubSources.length} fresh article${finnhubSources.length === 1 ? "" : "s"} with snapshot as-of; only snapshots at or under 48 hours old count.` : " Finnhub re-verification: NO_DATA — no company or market news snapshot at or under 48 hours old; stale evidence was skipped, not scored.";
    const layerInput = [...parseLayers(row.layersJson).filter((layer) => layer.name !== "crowd_pricing").map((layer) => layer.name === "news" ? { ...layer, verdict: layer.verdict === "disagree" && /only \d+ independent publisher|no current linked news/i.test(layer.evidence) ? "no_data" as const : layer.verdict, evidence: `${withSentimentLayerNote(layer.evidence.replace(/ Finnhub re-verification:[\s\S]*$/, ""), sentimentLayerNote(sentimentRows))}${finnhubNote}` } : layer), crowd.layer]; const scored = scoreTheoryLayers(layerInput); const layers = scored.layers; const updatedSources = [...sources.filter((source) => source.source !== "Polymarket" && source.source !== "Alpha Vantage"), ...(crowd.source ? [crowd.source] : [])];
    let status: "live" | "contested" | "invalidated" | "degraded" = row.status; let directionalPick: "long" | "short" | "none" = row.directionalPick;
    if (row.status !== "invalidated" || bornBreached) { status = !scored.evidenceFloorMet ? "degraded" : scored.measuredConflict ? "contested" : "live"; directionalPick = scored.directionalPickAllowed ? expectedDirection : "none"; if (row.status === "invalidated" && bornBreached) summary.invalidatedReverted += 1; }
    else directionalPick = "none";
    if (sourceIntegrity === "single_source" || directionalPick === "none") tripwire = null;
    const invalidationText = tripwire ? `Invalidate on a daily close ${tripwire.operator} ${tripwire.level} in ${row.primarySymbol}, combined with a 30-session relative-strength reversal${row.rivalSymbol ? ` versus ${row.rivalSymbol}` : ""}. Creation quote ${tripwire.creationPrice}; tripwire verified unbreached and computed for the ${expectedDirection} thesis.` : `No price tripwire is active. Thesis falsification conditions: ${row.countercase}`;
    const integrityNote = `${sourceIntegrity === "multi_source" ? `MULTI-SOURCE: ${sourceCount} independent publishers.` : "SINGLE SOURCE: at least one key factual claim lacks two independent publishers."} Weighted evidence ${scored.weightedScore >= 0 ? "+" : ""}${scored.weightedScore}; ${scored.supportLabel.toUpperCase()}. Confidence is an evidence-quality tier, never a probability.${tripwire ? ` Price tripwire verified unbreached at ${tripwire.creationPrice}.` : " No active price tripwire."}`;
    await db.update(schema.machineTheories).set({ causalChainJson: JSON.stringify(auditedHops.hops), layersJson: JSON.stringify(layers), sourcesJson: JSON.stringify(updatedSources), status, confidenceTier: scored.confidenceTier, directionalPick, expectedDirection, invalidationText, invalidationSymbol: tripwire ? row.primarySymbol : null, invalidationOperator: tripwire?.operator ?? null, invalidationLevel: tripwire?.level ?? null, invalidationCreationPrice: tripwire?.creationPrice ?? null, sourceIntegrity, independentSourceCount: sourceCount, integrityNote, integrityAuditedAt: new Date(), checkedAt: new Date() }).where(eq(schema.machineTheories.id, row.id));
  }
  return summary;
}
async function refreshInvalidations(ctx: Ctx) {
  await auditExistingTheoryIntegrity(ctx); const db = ctx.db<typeof schema>(); const rows = await db.select().from(schema.machineTheories);
  const checks = rows.filter((row) => row.status !== "invalidated" && row.sourceIntegrity === "multi_source" && row.invalidationSymbol && row.invalidationLevel != null && row.invalidationOperator && row.invalidationCreationPrice != null && row.expectedDirection !== "none").map(async (row) => {
    const geometryValid = row.expectedDirection === "long" ? row.invalidationOperator === "below" && row.invalidationLevel! < row.invalidationCreationPrice! : row.invalidationOperator === "above" && row.invalidationLevel! > row.invalidationCreationPrice!;
    if (!geometryValid) return;
    try { const series = await yahooFullHistory(ctx, row.invalidationSymbol!); const close = series.points[series.points.length - 1]?.close; if (close == null) return; const crossed = row.invalidationOperator === "above" ? close > row.invalidationLevel! : close < row.invalidationLevel!; if (crossed) await db.update(schema.machineTheories).set({ status: "invalidated", directionalPick: "none", checkedAt: new Date() }).where(eq(schema.machineTheories.id, row.id)); } catch { /* keep prior state and timestamp when the check cannot run */ }
  });
  await Promise.all(checks);
}
type StocktwitsPayload = { messages?: Array<{ id?: string | number; body?: string; created_at?: string; user?: { username?: string }; entities?: { sentiment?: { basic?: string } }; likes?: { total?: number } }> };
type SocialChatter = {
  status: "ok" | "partial" | "unavailable";
  ticker: string;
  note: string;
  fetchedAt: string;
  xTimelineState: string;
  stocktwits: { status: "ok" | "unavailable"; bullish: number; bearish: number; untagged: number; bullishPct: number | null; note: string };
  reddit: { status: "ok" | "unavailable"; discussions: number; note: string };
  messages: Array<{ id: string; source: "Stocktwits" | "Reddit"; handle: string | null; sentiment: "bullish" | "bearish" | "untagged" | "discussion"; text: string; createdAt: string | null; sourceUrl: string | null; engagement: number | null }>;
  theoryRead: "supports" | "challenges" | "mixed" | "unavailable";
  theoryReadNote: string;
};
const socialChatterResponse = z.object({
  status: z.enum(["ok", "partial", "unavailable"]), ticker: z.string(), note: z.string(), fetchedAt: z.string(), xTimelineState: z.string(),
  stocktwits: z.object({ status: z.enum(["ok", "unavailable"]), bullish: z.number(), bearish: z.number(), untagged: z.number(), bullishPct: z.number().nullable(), note: z.string() }),
  reddit: z.object({ status: z.enum(["ok", "unavailable"]), discussions: z.number(), note: z.string() }),
  messages: z.array(z.object({ id: z.string(), source: z.enum(["Stocktwits", "Reddit"]), handle: z.string().nullable(), sentiment: z.enum(["bullish", "bearish", "untagged", "discussion"]), text: z.string(), createdAt: z.string().nullable(), sourceUrl: z.string().nullable(), engagement: z.number().nullable() })),
  theoryRead: z.enum(["supports", "challenges", "mixed", "unavailable"]), theoryReadNote: z.string(),
});
const tapeSignalSchema = z.object({ id: z.string(), name: z.string(), direction: z.enum(["bullish", "bearish"]), active: z.boolean(), aligned: z.number(), conflicts: z.number(), measured: z.number(), evidenceTier: z.enum(["thin", "moderate", "strong"]), alignmentScore: z.number().nullable(), alignmentLabel: z.enum(["HIGH", "MEDIUM", "LOW", "NO RATING"]), checks: z.array(z.object({ label: z.string(), status: z.enum(["supports", "conflicts", "unavailable"]) })).length(5), empiricalRead: z.string(), thesis: z.string(), failure: z.string(), entryLow: z.number().nullable(), entryHigh: z.number().nullable(), invalidation: z.number().nullable(), target1: z.number().nullable(), target2: z.number().nullable(), invalidationBasis: z.string().nullable(), unavailableReason: z.string().nullable() });
function decodeXmlText(value: string): string { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim(); }
async function fetchSocialChatter(tickerInput: string, theoryDirection: "long" | "short" | "none" = "none"): Promise<SocialChatter> {
  const ticker = tickerInput.replace(/^\$/, "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 20); const fetchedAt = new Date().toISOString();
  if (!ticker) return { status: "unavailable", ticker: tickerInput.toUpperCase(), note: "A valid ticker is required.", fetchedAt, xTimelineState: "X timelines are not queried: automated X access requires a paid API. Individual posts are not inferred.", stocktwits: { status: "unavailable", bullish: 0, bearish: 0, untagged: 0, bullishPct: null, note: "Invalid ticker." }, reddit: { status: "unavailable", discussions: 0, note: "Invalid ticker." }, messages: [], theoryRead: "unavailable", theoryReadNote: "No social evidence was available." };
  const stocktwitsUrl = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(ticker)}.json`;
  const redditUrl = new URL("https://www.reddit.com/search.rss"); redditUrl.searchParams.set("q", ticker); redditUrl.searchParams.set("sort", "new");
  const [stockResult, redditResult] = await Promise.allSettled([
    fetch(stocktwitsUrl, { headers: { "User-Agent": "Muse Equity Analyzer/1.0" } }),
    fetch(redditUrl, { headers: { "User-Agent": "Muse Equity Analyzer/1.0" } }),
  ]);
  let stocktwits: SocialChatter["stocktwits"] = { status: "unavailable", bullish: 0, bearish: 0, untagged: 0, bullishPct: null, note: "Stocktwits public stream was unavailable." }; const messages: SocialChatter["messages"] = [];
  if (stockResult.status === "fulfilled" && stockResult.value.ok) {
    try { const payload = await stockResult.value.json() as StocktwitsPayload; const rows = payload.messages ?? []; let bullish = 0, bearish = 0, untagged = 0; for (const row of rows.slice(0, 30)) { const basic = row.entities?.sentiment?.basic?.toLowerCase(); const sentiment = basic === "bullish" ? "bullish" as const : basic === "bearish" ? "bearish" as const : "untagged" as const; if (sentiment === "bullish") bullish++; else if (sentiment === "bearish") bearish++; else untagged++; messages.push({ id: `stocktwits-${String(row.id ?? messages.length)}`, source: "Stocktwits", handle: row.user?.username ?? null, sentiment, text: row.body ?? "", createdAt: row.created_at ?? null, sourceUrl: stocktwitsUrl, engagement: typeof row.likes?.total === "number" ? row.likes.total : null }); } const tagged = bullish + bearish; stocktwits = { status: "ok", bullish, bearish, untagged, bullishPct: tagged ? round(bullish / tagged * 100) : null, note: rows.length ? `${rows.length} recent public messages; only author-applied Bullish/Bearish tags are counted.` : "The public stream returned no recent messages." }; } catch { stocktwits.note = "Stocktwits returned an unreadable public response."; }
  } else if (stockResult.status === "fulfilled") stocktwits.note = `Stocktwits public stream returned HTTP ${stockResult.value.status}.`;
  let reddit: SocialChatter["reddit"] = { status: "unavailable", discussions: 0, note: "Reddit public search was unavailable." };
  if (redditResult.status === "fulfilled" && redditResult.value.ok) {
    try { const xml = await redditResult.value.text(); const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 12); for (const [index, match] of entries.entries()) { const chunk = match[1] ?? ""; const title = decodeXmlText(chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? ""); const author = decodeXmlText(chunk.match(/<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/)?.[1] ?? ""); const createdAt = decodeXmlText(chunk.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1] ?? ""); const sourceUrl = chunk.match(/<link[^>]+href=["']([^"']+)["']/)?.[1] ?? null; if (title) messages.push({ id: `reddit-${index}-${createdAt}`, source: "Reddit", handle: author || null, sentiment: "discussion", text: title, createdAt: createdAt || null, sourceUrl, engagement: null }); } reddit = { status: "ok", discussions: entries.length, note: entries.length ? `${entries.length} recent public search results; Reddit does not supply a verified trade direction here.` : "Reddit public search returned no recent discussions." }; } catch { reddit.note = "Reddit returned an unreadable public response."; }
  } else if (redditResult.status === "fulfilled") reddit.note = `Reddit public search returned HTTP ${redditResult.value.status}.`;
  const available = [stocktwits.status, reddit.status].filter((status) => status === "ok").length; const bullishPct = stocktwits.bullishPct; let theoryRead: SocialChatter["theoryRead"] = "unavailable"; let theoryReadNote = "No direction-tagged public chatter was available.";
  if (bullishPct != null) { if (theoryDirection === "none") { theoryRead = "mixed"; theoryReadNote = `${round(bullishPct)}% of ${stocktwits.bullish + stocktwits.bearish} direction-tagged Stocktwits messages are bullish; no directional theory pick is being tested.`; } else { const supports = theoryDirection === "long" ? bullishPct >= 55 : bullishPct <= 45; const challenges = theoryDirection === "long" ? bullishPct <= 35 : bullishPct >= 65; theoryRead = supports ? "supports" : challenges ? "challenges" : "mixed"; theoryReadNote = `${round(bullishPct)}% bullish across ${stocktwits.bullish + stocktwits.bearish} direction-tagged Stocktwits messages versus the theory's ${theoryDirection.toUpperCase()} direction.`; } }
  return { status: available === 2 ? "ok" : available === 1 ? "partial" : "unavailable", ticker, note: available === 2 ? "Stocktwits + Reddit chatter refreshed." : available === 1 ? "One public social source refreshed; the other is explicitly unavailable." : "Public social sources were unavailable; no chatter was fabricated.", fetchedAt, xTimelineState: "X isn't included — it needs paid API access. Stocktwits + Reddit are included.", stocktwits, reddit, messages, theoryRead, theoryReadNote };
}
const eventMapResponse = z.object({ status: z.enum(["ok", "contested", "degraded"]), scenario: z.string(), weightedScore: z.number(), measuredLayersWithData: z.number(), evidenceFloorMet: z.boolean(), supportLabel: z.string(), confidenceTier: z.enum(["high", "medium", "low"]), confidenceNote: z.string(), directionalPick: z.enum(["long", "short", "none"]), verifiedPremises: z.array(z.object({ statement: z.string(), sourceIndexes: z.array(z.number()) })), inferences: z.array(z.string()), legs: z.array(z.object({ from: z.string(), to: z.string(), mechanism: z.string(), kind: z.enum(["verified", "inference"]), sourceIndexes: z.array(z.number()), check: z.enum(["pass", "broken"]), evidence: z.array(z.object({ title: z.string(), url: z.string(), source: z.string() })) })), layers: z.array(theoryLayerSchema), sources: z.array(discoverySourceSchema), countercase: z.string(), invalidation: z.string(), fallback: z.string().nullable() });
function eventMapFallback(scenario: string, sources: DiscoverySource[], fallback: string): z.infer<typeof eventMapResponse> { const score = scoreTheoryLayers([makeTheoryLayer("chart", "no_data", "NO_DATA: no instrument set could be verified."), makeTheoryLayer("math", "no_data", "NO_DATA: numeric consistency could not be checked."), makeTheoryLayer("narrative", "no_data", "NO_DATA: no causal inference was produced."), makeTheoryLayer("news", sources.length ? "agree" : "no_data", sources.length ? `${sources.length} linked source items were retained.` : "NO_DATA: source retrieval returned no usable rows.", sources.map(sourceIdentity)), makeTheoryLayer("smart_money", "no_data", "NO_DATA: this event mapper did not receive smart-money evidence."), makeTheoryLayer("crowd_pricing", "no_data", "NO_DATA: no crowd-pricing context was attached. Context only; zero score weight and never a veto.")]); return { status: "degraded", scenario, weightedScore: score.weightedScore, measuredLayersWithData: score.measuredLayersWithData, evidenceFloorMet: score.evidenceFloorMet, supportLabel: score.supportLabel, confidenceTier: score.confidenceTier, confidenceNote: "Confidence tier is an evidence-quality label from the weighted score, never a probability.", directionalPick: "none", verifiedPremises: [], inferences: [], legs: [], layers: score.layers, sources, countercase: "Unavailable while verification inputs are incomplete.", invalidation: "No directional pick or price tripwire is active.", fallback }; }
const eventInferenceSchema = z.object({ verifiedPremises: z.array(z.object({ statement: z.string(), sourceIndexes: z.array(z.number().int().min(1)) })).max(6), inferences: z.array(z.string()).max(6), legs: z.array(z.object({ from: z.string(), to: z.string(), mechanism: z.string(), kind: z.enum(["verified", "inference"]), sourceIndexes: z.array(z.number().int().min(1)).max(4) })).min(2).max(8), tickers: z.array(z.string()).max(6), directionalPick: z.enum(["long", "short", "none"]), countercase: z.string(), invalidation: z.string() });
async function buildEventMap(ctx: Ctx, scenario: string): Promise<z.infer<typeof eventMapResponse>> {
  const retrievedAt = new Date().toISOString(); let rows: DiscoverySource[] = [];
  try { const searches = await Promise.all([ctx.tool.web_search(`${scenario} market industry latest evidence`), ctx.tool.web_search(`${scenario} listed companies supply chain impact`)]); rows = [...new Map(searches.flatMap((search) => (search.content?.results ?? []).filter((item) => !item.is_index_page && item.url).slice(0, 8).map((item) => ({ title: item.title, url: item.url ?? "", source: item.source ?? "Unknown source", snippet: item.snippet ?? "", publishedAt: item.published_at, retrievedAt, singleSource: true }))).map((row) => [row.url || cleanKey(row.title), row])).values()]; } catch { return eventMapFallback(scenario, [], "degraded output · source retrieval failed"); }
  const compact = rows.slice(0, 20).map((row, index) => `[${index + 1}] ${row.title}\n${row.source} · ${row.snippet}`).join("\n\n"); let mapped: z.infer<typeof eventInferenceSchema>;
  try { mapped = await ctx.inference.complete(`Map this scenario into a falsifiable market event/action chain. Separate premises directly established by source excerpts from inference. Use only cited facts; label each chain leg verified or inference. Every verified leg must cite its exact source indexes; every inference leg must have an empty sourceIndexes array. Build at least two hops from event through geopolitical/alliance or industry shift to sector consequence and market impact. Identify up to six liquid listed tickers needed for chart checks. Use no directional pick if evidence supports opposing forks. Scenario: ${scenario}\n\n${compact}`, { schema: eventInferenceSchema }); } catch { return eventMapFallback(scenario, rows, "inference unavailable · source rows preserved"); }
  const tickerRows = await Promise.all([...new Set(mapped.tickers.map((ticker) => ticker.toUpperCase()))].map(async (ticker) => [ticker, await analyze(ctx, ticker, false)] as const)); const summaries = tickerRows.map(([ticker, result]) => ({ ticker, summary: chartSummary(result) })).filter((row) => row.summary); const scores = summaries.map((row) => row.summary?.score ?? 0); const conflict = mapped.directionalPick === "none" || (scores.some((score) => score >= 20) && scores.some((score) => score <= -20)); const legs = mapped.legs.map((leg) => { const evidence = leg.sourceIndexes.flatMap((index) => rows[index - 1] ? [{ title: rows[index - 1]!.title, url: rows[index - 1]!.url, source: rows[index - 1]!.source }] : []); const check = leg.kind === "inference" || evidence.length > 0 ? "pass" as const : "broken" as const; return { ...leg, check, evidence }; }); const brokenLegs = legs.filter((leg) => leg.check === "broken"); const citedIndexes = [...new Set([...mapped.verifiedPremises.flatMap((premise) => premise.sourceIndexes), ...mapped.legs.flatMap((leg) => leg.sourceIndexes)])]; const cited = citedIndexes.flatMap((index) => rows[index - 1] ? [rows[index - 1]!] : []); const directionalSign = mapped.directionalPick === "short" ? -1 : mapped.directionalPick === "long" ? 1 : 0; const alignedChartScores = directionalSign ? scores.map((score) => directionalSign * score) : []; const chartVerdict: LayerVerdict = !summaries.length ? "no_data" : !directionalSign ? "mixed" : alignedChartScores.every((score) => score <= -20) ? "disagree" : alignedChartScores.some((score) => score >= 20) ? "agree" : "mixed"; const measuredReturns = summaries.flatMap((row) => row.summary?.ret30 == null ? [] : [directionalSign * row.summary.ret30]); const mathVerdict: LayerVerdict = !measuredReturns.length ? "no_data" : !directionalSign ? "mixed" : measuredReturns.every((value) => value <= -5) ? "disagree" : measuredReturns.some((value) => value >= 5) ? "agree" : "mixed"; const chartSourceKeys = tickerRows.flatMap(([, result]) => result.instrument?.sources.map((source) => sourceKeyFromUrl(source.url, source.title.toLowerCase())) ?? []); const scored = scoreTheoryLayers([makeTheoryLayer("chart", chartVerdict, summaries.length ? summaries.map((row) => `${row.ticker} ${row.summary!.score >= 0 ? "+" : ""}${row.summary!.score} factor agreement`).join("; ") : "NO_DATA: no selected ticker returned usable OHLCV.", chartSourceKeys), makeTheoryLayer("math", mathVerdict, summaries.length ? `${summaries.map((row) => `${row.ticker} 30-session ${pctText(row.summary!.ret30)}`).join("; ")}. Returns use exact trading-session closes.` : "NO_DATA: no numeric series to test.", chartSourceKeys), makeTheoryLayer("narrative", mapped.legs.length < 2 || brokenLegs.length ? "disagree" : mapped.verifiedPremises.length ? "agree" : "mixed", `${mapped.legs.length} mapped hops; ${mapped.verifiedPremises.length} verified premises, ${mapped.inferences.length} explicit inferences, and ${brokenLegs.length} broken hop${brokenLegs.length === 1 ? "" : "s"}.`, cited.map(sourceIdentity)), makeTheoryLayer("news", cited.length ? "agree" : "no_data", cited.length ? `${cited.length} linked, indexed source items.` : "NO_DATA: no premise has linked source evidence.", cited.map(sourceIdentity)), makeTheoryLayer("smart_money", "no_data", "NO_DATA: this event mapper did not receive smart-money evidence."), makeTheoryLayer("crowd_pricing", "no_data", "NO_DATA: no crowd-pricing context was attached. Context only; zero score weight and never a veto.")]); const contested = conflict || scored.measuredConflict; const directionalPick = scored.evidenceFloorMet && !contested && scored.weightedScore >= 4 ? mapped.directionalPick : "none"; return { status: !scored.evidenceFloorMet ? "degraded" : contested ? "contested" : "ok", scenario, weightedScore: scored.weightedScore, measuredLayersWithData: scored.measuredLayersWithData, evidenceFloorMet: scored.evidenceFloorMet, supportLabel: contested ? "contested" : scored.supportLabel, confidenceTier: scored.confidenceTier, confidenceNote: "Confidence tier is an evidence-quality label from the weighted score, never a probability. Missing layers remain NO_DATA; a low score is not a FAIL.", directionalPick, verifiedPremises: mapped.verifiedPremises, inferences: mapped.inferences, legs, layers: scored.layers, sources: cited, countercase: mapped.countercase, invalidation: directionalPick === "none" ? `NO DIRECTIONAL PICK. ${mapped.invalidation}` : mapped.invalidation, fallback: scored.evidenceFloorMet ? brokenLegs.length ? "degraded output · broken causal hop" : null : "insufficient evidence · fewer than two measured layers have data" };
}

const entryCheckSchema = z.object({ category: z.string(), status: z.enum(["supports", "caution", "conflicts", "unavailable"]), value: z.string(), detail: z.string(), sourceUrl: z.string().nullable() });
const entryTimingResponse = z.object({ verdict: z.enum(["good", "caution", "bad", "unavailable"]), headline: z.string(), symbol: z.string(), direction: z.enum(["long", "short"]), plannedEntry: z.number(), invalidationLevel: z.number(), targetLevel: z.number(), rewardRisk: z.number(), asymmetricPayoff: z.boolean(), currentPrice: z.number().nullable(), score: z.number().nullable(), reasons: z.array(z.string()), checks: z.array(entryCheckSchema), disclaimer: z.string(), checkedAt: z.string() });
const silentHintSchema = z.object({ type: z.enum(["vc_raise", "corporate_venture", "early_13f", "activist", "insider_cluster", "market_maker"]), label: z.string(), detail: z.string(), confidence: z.enum(["high", "medium", "low"]), confidenceNote: z.string(), observedAt: z.string().nullable(), sourceTitle: z.string(), sourceUrl: z.string() });
type SilentHint = z.infer<typeof silentHintSchema>;

async function checkEntryTiming(ctx: Ctx, args: { ticker: string; direction: "long" | "short"; entryPrice: number; invalidationLevel: number; targetLevel: number }): Promise<z.infer<typeof entryTimingResponse>> {
  const checkedAt = new Date().toISOString();
  const disclaimer = "Timing verdicts summarize current evidence, not the probability of profit and never a guarantee. Recheck before placing or changing an order.";
  const risk = Math.abs(args.entryPrice - args.invalidationLevel); const reward = Math.abs(args.targetLevel - args.entryPrice); const rewardRisk = risk > 0 ? reward / risk : 0; const asymmetricPayoff = rewardRisk >= 5;
  const invalidationGeometryValid = args.direction === "long" ? args.entryPrice > args.invalidationLevel : args.entryPrice < args.invalidationLevel;
  if (!invalidationGeometryValid) { const reason = "entry is beyond invalidation — trade is dead on arrival."; return { verdict: "bad", headline: "Trade is dead on arrival", symbol: args.ticker.toUpperCase(), direction: args.direction, plannedEntry: args.entryPrice, invalidationLevel: args.invalidationLevel, targetLevel: args.targetLevel, rewardRisk: round(rewardRisk), asymmetricPayoff, currentPrice: null, score: null, reasons: [reason], checks: [{ category: "Dead-on-arrival validation", status: "conflicts", value: `entry ${round(args.entryPrice)} · invalidation ${round(args.invalidationLevel)}`, detail: reason, sourceUrl: null }], disclaimer, checkedAt }; }
  const [result, spy] = await Promise.all([analyze(ctx, args.ticker, false, false), analyze(ctx, "SPY", false, false).catch(() => null)]);
  if (result.status !== "ok" || !result.instrument || !result.factorModel || result.instrument.price == null) return { verdict: "unavailable", headline: "Timing evidence is unavailable", symbol: args.ticker.toUpperCase(), direction: args.direction, plannedEntry: args.entryPrice, invalidationLevel: args.invalidationLevel, targetLevel: args.targetLevel, rewardRisk, asymmetricPayoff, currentPrice: null, score: null, reasons: [result.error ?? "The quote or technical series could not be loaded."], checks: [], disclaimer, checkedAt };
  const instrument = result.instrument; const current = instrument.price; if (current == null) return { verdict: "unavailable", headline: "Timing evidence is unavailable", symbol: instrument.symbol, direction: args.direction, plannedEntry: args.entryPrice, invalidationLevel: args.invalidationLevel, targetLevel: args.targetLevel, rewardRisk, asymmetricPayoff, currentPrice: null, score: null, reasons: ["The current quote is unavailable."], checks: [], disclaimer, checkedAt }; const directionSign = args.direction === "long" ? 1 : -1; const checks: Array<z.infer<typeof entryCheckSchema>> = []; let score = 0;
  const atrNow = getMetric(result.indicators, "ATR 14"); const rsiNow = getMetric(result.indicators, "RSI 14"); const volumeZ = getMetric(result.indicators, "Volume z"); const gap = directionSign * (args.entryPrice - current); const gapAtr = atrNow && atrNow > 0 ? gap / atrNow : null; const quoteUrl = instrument.sources[0]?.url ?? null;
  const geometryValid = args.direction === "long" ? args.targetLevel > args.entryPrice : args.targetLevel < args.entryPrice; checks.push({ category: "Published level-set R:R", status: geometryValid ? "supports" : "conflicts", value: `${round(rewardRisk)}:1 computed`, detail: `Entry ${round(args.entryPrice)}, invalidation ${round(args.invalidationLevel)}, target ${round(args.targetLevel)}. This reports the level geometry; it does not judge the dossier reference set against the separate 5:1 gate.`, sourceUrl: null }); const rrStatus = geometryValid && asymmetricPayoff ? "supports" as const : "conflicts" as const; if (rrStatus === "supports") score += 2; else score -= 6; checks.push({ category: "5:1 reward/risk gate", status: rrStatus, value: `${round(rewardRisk)}:1 computed vs 5:1 minimum · invalidation ${round(args.invalidationLevel)} · target ${round(args.targetLevel)}`, detail: !geometryValid ? "Target and invalidation are not on the correct sides of entry for this direction." : asymmetricPayoff ? "Defined risk is close enough for the planned trade target to offer at least five units of upside per unit at risk." : "HARD GATE FAILED: expected reward is below five times defined risk. Do not call this an asymmetric setup.", sourceUrl: null });
  const gapStatus: "supports" | "caution" | "conflicts" = gapAtr == null ? (Math.abs(gap / current) <= 0.01 ? "supports" : gap > 0 ? "conflicts" : "caution") : gapAtr > 1 ? "conflicts" : gapAtr < -2 ? "caution" : "supports"; score += gapStatus === "supports" ? 2 : gapStatus === "conflicts" ? -2 : -1;
  checks.push({ category: "Price vs plan", status: gapStatus, value: `${round(current)} now · ${round(args.entryPrice)} planned`, detail: gapAtr == null ? "ATR comparison unavailable; evaluated from percentage distance." : `The planned order is ${round(Math.abs(gapAtr))} ATR ${gap >= 0 ? "past" : "before"} the current quote in the trade direction.`, sourceUrl: quoteUrl });
  if (rsiNow == null) checks.push({ category: "RSI state", status: "unavailable", value: "Unavailable", detail: "RSI 14 could not be computed from the returned series.", sourceUrl: quoteUrl }); else { const aligned = args.direction === "long" ? rsiNow >= 40 && rsiNow <= 68 : rsiNow >= 32 && rsiNow <= 60; const crowded = args.direction === "long" ? rsiNow > 72 : rsiNow < 28; const status = crowded ? "conflicts" as const : aligned ? "supports" as const : "caution" as const; score += status === "supports" ? 1 : status === "conflicts" ? -2 : 0; checks.push({ category: "RSI state", status, value: `RSI 14 ${round(rsiNow)}`, detail: crowded ? "Momentum is stretched against a fresh entry at this price." : aligned ? "Momentum is not at the directional extreme this setup tries to avoid." : "Momentum is neutral-to-misaligned for the proposed direction.", sourceUrl: quoteUrl }); }
  if (atrNow == null) checks.push({ category: "ATR regime", status: "unavailable", value: "Unavailable", detail: "ATR 14 could not be computed.", sourceUrl: quoteUrl }); else { const atrPct = atrNow / current * 100; const status = atrPct >= 6 ? "caution" as const : "supports" as const; score += status === "supports" ? 1 : -1; checks.push({ category: "ATR regime", status, value: `${round(atrNow)} · ${round(atrPct)}% of price`, detail: atrPct >= 6 ? "The current daily range is wide; entry and invalidation need extra room." : "The current range is within the normal sizing band used by this checker.", sourceUrl: quoteUrl }); }
  if (volumeZ == null) checks.push({ category: "Volume / positioning", status: "unavailable", value: "Unavailable", detail: "Volume z-score could not be computed.", sourceUrl: quoteUrl }); else { const factorAligned = result.factorModel.direction === args.direction; const status = volumeZ >= 1 && factorAligned ? "supports" as const : volumeZ >= 1 && !factorAligned ? "conflicts" as const : "caution" as const; score += status === "supports" ? 1 : status === "conflicts" ? -1 : 0; checks.push({ category: "Volume / positioning", status, value: `${round(volumeZ)}σ volume · ${result.factorModel.label}`, detail: volumeZ >= 1 ? `Elevated volume ${factorAligned ? "backs" : "runs against"} the proposed direction.` : "Volume is not elevated enough to add conviction to the entry.", sourceUrl: quoteUrl }); }
  const signals = buildSignalTape(result, spy); const active = signals.filter((signal) => signal.active); const wanted = args.direction === "long" ? "bullish" : "bearish"; const alignedSignals = active.filter((signal) => signal.direction === wanted); const conflictingSignals = active.filter((signal) => signal.direction !== wanted); const signalStatus = alignedSignals.length > conflictingSignals.length ? "supports" as const : conflictingSignals.length > alignedSignals.length ? "conflicts" as const : "caution" as const; score += signalStatus === "supports" ? 2 : signalStatus === "conflicts" ? -2 : 0;
  checks.push({ category: "Open signal alignment", status: signalStatus, value: `${alignedSignals.length} aligned · ${conflictingSignals.length} conflicting`, detail: active.length ? active.map((signal) => signal.name).join(" · ") : "No setup cleared its activation rules.", sourceUrl: quoteUrl });
  let earningsDate: string | null = null; let earningsUrl: string | null = null; let nearbyNews = 0;
  try { const [earningsSearch, news] = await Promise.all([ctx.tool.web_search(`${instrument.symbol} ${instrument.name} next earnings date investor relations`), marketNews(ctx, "symbol", instrument.symbol, instrument.name)]); const rows = (earningsSearch.content?.results ?? []).filter((row) => !row.is_index_page && row.url).slice(0, 6); if (rows.length) { const compact = rows.map((row, index) => `[${index + 1}] ${row.title}: ${row.snippet ?? ""}`).join("\n"); const found = await ctx.inference.complete(`Today is ${checkedAt.slice(0, 10)}. Extract one clearly stated future earnings date for ${instrument.symbol} from these snippets. Return null unless exact.\n${compact}`, { schema: z.object({ date: z.string().nullable(), sourceIndex: z.number().int().nullable() }) }); const source = found.sourceIndex == null ? undefined : rows[found.sourceIndex - 1]; if (found.date && source?.url) { earningsDate = found.date; earningsUrl = source.url; } } nearbyNews = news.items.filter((item) => { const time = Date.parse(item.publishedAt); return Number.isFinite(time) && Date.now() - time <= 72 * 3600000 && Date.now() >= time; }).length; } catch { /* visible unavailable event check below */ }
  const futureEvents = result.events.filter((event) => event.date >= checkedAt.slice(0, 10)).slice(0, 3); const earningsDays = earningsDate ? Math.ceil((Date.parse(`${earningsDate}T00:00:00Z`) - Date.parse(`${checkedAt.slice(0, 10)}T00:00:00Z`)) / 86400000) : null; const eventNear = earningsDays != null && earningsDays >= 0 && earningsDays <= 10; const eventStatus = eventNear ? "caution" as const : (earningsDate || futureEvents.length || nearbyNews) ? "supports" as const : "unavailable" as const; if (eventNear) score -= 2;
  checks.push({ category: "Event / news proximity", status: eventStatus, value: eventNear ? `Earnings ${earningsDate} · ${earningsDays}d` : `${earningsDate ? `Earnings ${earningsDate}` : "No exact earnings date"} · ${nearbyNews} news item${nearbyNews === 1 ? "" : "s"} ≤72h`, detail: eventNear ? "A scheduled catalyst is inside the 10-day caution window; gap risk can dominate technical timing." : futureEvents.length ? `Upcoming chart events: ${futureEvents.map((event) => `${event.type} ${event.date}`).join(" · ")}.` : nearbyNews ? "Recent single-source news exists; review it before entry." : "No exact upcoming event was established by the available sources.", sourceUrl: earningsUrl });
  const verdict: "good" | "caution" | "bad" = !geometryValid || !asymmetricPayoff ? "bad" : score <= -3 ? "bad" : score >= 3 && gapStatus === "supports" && !eventNear ? "good" : "caution"; const targetStatus = verdict === "good" ? "supports" : verdict === "bad" ? "conflicts" : "caution"; const reasons = checks.filter((check) => check.status === targetStatus || (verdict === "caution" && check.status === "conflicts")).slice(0, 4).map((check) => `${check.category}: ${check.detail}`);
  return { verdict, headline: verdict === "good" ? "Timing evidence is supportive" : verdict === "bad" ? "Timing evidence argues against this entry" : "Timing needs caution", symbol: instrument.symbol, direction: args.direction, plannedEntry: args.entryPrice, invalidationLevel: args.invalidationLevel, targetLevel: args.targetLevel, rewardRisk, asymmetricPayoff, currentPrice: current, score, reasons, checks, disclaimer, checkedAt };
}

const completePictureSourceSchema = z.object({ id: z.string(), title: z.string(), detail: z.string(), kind: z.enum(["market", "terminal", "news", "filing", "theory", "context"]), url: z.string().nullable(), asOf: z.string().nullable() });
const completePictureClaimSchema = z.object({ text: z.string(), sourceIds: z.array(z.string()) });
const dossierSynthesisResponse = z.object({
  status: z.enum(["ok", "degraded"]), generatedAt: z.string(), symbol: z.string(), headline: z.string(), summary: z.string(), keyTension: z.string().nullable(),
  calibration: z.object({ label: z.enum(["MEASURED", "UNCALIBRATED"]), closedSignals: z.number(), note: z.string() }),
  sections: z.array(z.object({ key: z.enum(["direction", "signals", "news", "smart_money", "theories", "competition", "sector", "supply_chain", "macro", "risks"]), title: z.string(), state: z.enum(["available", "no_data"]), note: z.string(), claims: z.array(completePictureClaimSchema) })),
  sources: z.array(completePictureSourceSchema), gaps: z.array(z.string()),
});
const dossierMemo = new Map<string, { expiresAt: number; value: z.infer<typeof dossierSynthesisResponse> }>();
type CompletePictureSource = z.infer<typeof completePictureSourceSchema>;
type CompletePictureClaim = z.infer<typeof completePictureClaimSchema>;
const completePictureInferenceSchema = z.object({
  headline: z.string(), summary: z.string(), keyTension: z.string(),
  externalClaims: z.array(z.object({ lane: z.enum(["competition", "sector", "supply_chain", "macro", "risks"]), text: z.string(), sourceIndexes: z.array(z.number().int().min(1)).max(5) })).max(18),
  peerCandidates: z.array(z.object({ symbol: z.string().max(20), name: z.string(), why: z.string(), sourceIndexes: z.array(z.number().int().min(1)).max(4) })).max(4),
});

const universeUrls = {
  sp100: "https://en.wikipedia.org/wiki/S&P_100",
  sp500: "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
} as const;
type UniverseProfile = { symbol: string; name: string; sector: string };
function htmlText(value: string) { return decodeDocumentText(value).replace(/\[[0-9]+\]/g, "").trim(); }
function tableRows(html: string): string[][] {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  const table = tables.find((item) => /\bAAPL\b/i.test(item) && /\bMSFT\b/i.test(item)) ?? "";
  return (table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []).map((row) => (row.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []).map(htmlText));
}
async function loadScanUniverse(scope: "sp100" | "sp500"): Promise<{ profiles: UniverseProfile[]; sourceUrl: string }> {
  const [targetResponse, sectorResponse] = await Promise.all([
    fetch(universeUrls[scope], { headers: { "User-Agent": "Muse Equity Analyzer/1.0" } }),
    scope === "sp100" ? fetch(universeUrls.sp500, { headers: { "User-Agent": "Muse Equity Analyzer/1.0" } }) : Promise.resolve(null),
  ]);
  if (!targetResponse.ok) throw new Error(`Universe source returned HTTP ${targetResponse.status}.`);
  const targetRows = tableRows(await targetResponse.text());
  let sectorMap = new Map<string, { name: string; sector: string }>();
  if (sectorResponse?.ok) {
    sectorMap = new Map(tableRows(await sectorResponse.text()).flatMap((cells) => {
      const raw = (cells[0] ?? "").trim();
      return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(raw) ? [[raw.replace(/\./g, "-"), { name: cells[1] ?? raw, sector: cells[2] ?? "Unclassified" }] as const] : [];
    }));
  }
  const profiles = targetRows.flatMap((cells) => {
    const raw = (cells[0] ?? "").trim();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(raw)) return [];
    const symbol = raw.replace(/\./g, "-"); const mapped = sectorMap.get(symbol);
    return [{ symbol, name: cells[1] ?? mapped?.name ?? symbol, sector: (scope === "sp500" ? cells[2] : mapped?.sector) ?? "Unclassified" }];
  });
  return { profiles: [...new Map(profiles.map((profile) => [profile.symbol, profile])).values()], sourceUrl: universeUrls[scope] };
}
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length); let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; const item = items[index]; if (item !== undefined) out[index] = await fn(item); }
  });
  await Promise.all(workers); return out;
}
type YahooSparkResponse = { spark?: { result?: Array<{ symbol?: string; response?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }>; adjclose?: Array<{ adjclose?: Array<number | null> }> } }> }> } };
async function velocityScreen(profiles: UniverseProfile[]): Promise<Map<string, number>> {
  const output = new Map<string, number>();
  for (let start = 0; start < profiles.length; start += 50) {
    const chunk = profiles.slice(start, start + 50); if (!chunk.length) continue;
    const symbols = chunk.map((profile) => profile.symbol).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols)}&range=1mo&interval=1d`;
    try {
      const response = await pacedYahooFetch(url, "background"); if (!response.ok) continue;
      const payload = await response.json() as YahooSparkResponse;
      for (const item of payload.spark?.result ?? []) {
        const symbol = item.symbol?.toUpperCase(); const chart = item.response?.[0];
        const raw = chart?.indicators?.adjclose?.[0]?.adjclose ?? chart?.indicators?.quote?.[0]?.close ?? [];
        const closes = raw.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
        const latest = closes.at(-1); const prior = closes.at(-6); if (!symbol || latest == null || prior == null || prior <= 0) continue;
        output.set(symbol, round((latest / prior - 1) * 100, 4));
      }
    } catch { /* a missing cheap-screen batch cannot promote qualifiers; the bounded top-tier pass still runs */ }
  }
  return output;
}
function fullScoringProfiles(topTier: UniverseProfile[], allProfiles: UniverseProfile[], velocityBySymbol: Map<string, number>) {
  const topTierSymbols = new Set(topTier.map((profile) => profile.symbol));
  const qualifiers = allProfiles.filter((profile) => !topTierSymbols.has(profile.symbol) && (velocityBySymbol.get(profile.symbol) ?? -Infinity) >= 10);
  return { qualifiers, profiles: [...topTier, ...qualifiers] };
}
const sectorImpactGenerated = z.array(z.object({ sector: z.string(), direction: z.enum(["positive", "negative", "mixed"]), evidenceScore: z.number().int().min(-100).max(100), headline: z.string(), reason: z.string(), sourceCount: z.number().int().min(0) })).max(12);
const scanDimensionSchema = z.object({ name: z.string(), status: z.enum(["supports", "conflicts", "research"]), detail: z.string() });
const scanFactorSchema = z.object({ name: z.string(), weight: z.number(), score: z.union([z.literal(-1), z.literal(0), z.literal(1)]), contribution: z.number(), reading: z.string() });
type ScanDimension = z.infer<typeof scanDimensionSchema>;
type ScanConfidence = "high" | "medium" | "low";
function fiveDimensionGate(result: z.infer<typeof analyzeResponse>, _spy: z.infer<typeof analyzeResponse> | null): { dimensions: ScanDimension[]; confidenceTier: ScanConfidence; researchRequired: string[]; ratingScore: number | null; ratingDirection: "long" | "short" | null } {
  if (!result.instrument || !result.factorModel) return { dimensions: [], confidenceTier: "low", researchRequired: ["Usable instrument history"], ratingScore: null, ratingDirection: null };
  const ratingDirection = result.factorModel.direction === "mixed" ? null : result.factorModel.direction;
  const bullish = ratingDirection !== "short"; const sign = bullish ? 1 : -1;
  const factor = (id: string) => result.factorModel?.factors.find((row) => factorId(row.name) === id)?.score ?? 0;
  const classifyVotes = (name: string, votes: Array<number | null>, detail: string): ScanDimension => {
    const measured = votes.filter((value): value is number => value != null && value !== 0); const aligned = measured.filter((value) => sign * value > 0).length; const opposed = measured.filter((value) => sign * value < 0).length;
    return { name, status: measured.length < 2 || aligned === opposed ? "research" : aligned > opposed ? "supports" : "conflicts", detail };
  };
  const maVotes = [factor("price_vs_sma20"), factor("price_vs_sma50"), factor("price_vs_sma200")];
  const dimensions: ScanDimension[] = [classifyVotes("Trend regime", maVotes, `${maVotes.filter((value) => sign * value > 0).length}/3 moving-average votes align with the candidate direction.`)];
  const rsiScore = factor("rsi14_wilder"); const macdScore = factor("macd_12_26"); const returnScore = factor("atr_adjusted_trend30");
  dimensions.push(classifyVotes("Momentum", [rsiScore, macdScore, returnScore], `Wilder RSI-14 vote ${rsiScore}, MACD 12–26 vote ${macdScore}, and ATR-adjusted 30-session trend vote ${returnScore}; zero is neutral.`));
  const chart = result.chart; const last = chart[chart.length - 1]; const atrNow = getMetric(result.indicators, "ATR 14"); const bandwidths = chart.map((_point, index) => { if (index < 19) return null; const closes = chart.slice(index - 19, index + 1).map((point) => point.close); const mean = average(closes); if (mean == null || mean === 0) return null; const deviation = Math.sqrt(closes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / closes.length); return 4 * deviation / mean * 100; }).filter((value): value is number => value != null); const currentBandwidth = bandwidths[bandwidths.length - 1] ?? null; const priorBandwidth = bandwidths[bandwidths.length - 6] ?? null; const atrPct = last && atrNow != null && last.close !== 0 ? atrNow / last.close * 100 : null;
  const volatilityStatus: ScanDimension["status"] = currentBandwidth == null || priorBandwidth == null || atrPct == null ? "research" : currentBandwidth > priorBandwidth && atrPct >= 0.5 && atrPct <= 8 ? "supports" : atrPct > 10 ? "conflicts" : "research";
  dimensions.push({ name: "Volatility", status: volatilityStatus, detail: currentBandwidth == null || priorBandwidth == null || atrPct == null ? "Bollinger bandwidth expansion or Wilder ATR-14 is incomplete." : `20-session bandwidth ${round(currentBandwidth)}% vs ${round(priorBandwidth)}% five sessions earlier; Wilder ATR-14 is ${round(atrPct)}% of price.` });
  const volumeZ = getMetric(result.indicators, "Volume z"); const ret7 = getMetric(result.returns, "7d"); const volumeStatus: ScanDimension["status"] = volumeZ == null || ret7 == null || volumeZ < 1 ? "research" : sign * ret7 > 0 ? "supports" : "conflicts";
  dimensions.push({ name: "Volume", status: volumeStatus, detail: volumeZ == null ? "Volume history is unavailable." : `${round(volumeZ)}σ latest volume; directional confirmation requires ≥1σ and an aligned 7-session return.` });
  dimensions.push({ name: "Positioning / sentiment", status: "research", detail: "The broad chart feed has no standardized current short-interest, options-positioning, or verified sentiment series. This family is not imputed from price or volume." });
  const supports = dimensions.filter((row) => row.status === "supports").length; const conflicts = dimensions.filter((row) => row.status === "conflicts").length; const measured = dimensions.length - dimensions.filter((row) => row.status === "research").length;
  const ratingScore = measured >= 4 && ratingDirection ? sign * Math.round((supports - conflicts) / measured * 100) : null;
  const confidenceTier: ScanConfidence = ratingScore != null && measured === 5 && supports === 5 && conflicts === 0 ? "high" : ratingScore != null && supports >= 3 && conflicts <= 1 ? "medium" : "low";
  return { dimensions, confidenceTier, researchRequired: dimensions.filter((row) => row.status === "research").map((row) => row.name), ratingScore, ratingDirection };
}
const radarResponse = z.object({ items: z.array(z.object({ id: z.number(), origin: z.enum(["scan", "tracker"]), runId: z.number().nullable(), universe: z.enum(["sp100", "sp500"]).nullable(), scanCreatedAt: z.string(), symbol: z.string(), name: z.string(), sector: z.string().nullable(), direction: z.enum(["long", "short", "mixed"]), agreementScore: z.number(), rawScore: z.number().nullable(), redundancyAdjustment: z.number().nullable(), confidenceTier: z.enum(["high", "medium", "low"]), invalidationLevel: z.number().nullable(), sourceAsOf: z.string().nullable(), sourceUrl: z.string().nullable(), factors: z.array(scanFactorSchema), formula: z.string() })), universe: z.object({ name: z.enum(["sp100", "sp500"]), status: z.enum(["ok", "partial", "degraded", "failed"]), note: z.string(), requestedCount: z.number(), scannedCount: z.number(), availableCount: z.number(), signalCount: z.number(), excludedCount: z.number(), exclusions: z.array(z.object({ symbol: z.string(), reason: z.string() })) }).nullable(), threshold: z.number(), omittedUnverifiable: z.number(), omissionRule: z.string() });
const universeTierRowSchema = z.object({ symbol: z.string(), name: z.string(), sector: z.string(), tier: z.enum(["t1", "t2", "t3"]), trackingMode: z.enum(["full", "lightweight"]), velocity5d: z.number().nullable(), reason: z.string() });
const tierBatchResponse = z.object({ ok: z.boolean(), universe: z.enum(["sp100", "sp500"]), runId: z.number().nullable(), offset: z.number(), processed: z.number(), totalProfiles: z.number(), persistedCounts: z.object({ t1: z.number(), t2: z.number(), t3: z.number() }), complete: z.boolean(), note: z.string() });
const tierPopulationStatusResponse = z.object({ ok: z.boolean(), universe: z.enum(["sp100", "sp500"]), runId: z.number().nullable(), totalProfiles: z.number(), persistedTotal: z.number(), persistedCounts: z.object({ t1: z.number(), t2: z.number(), t3: z.number() }), complete: z.boolean(), batchesRun: z.number(), note: z.string() });
const autoScanResponse = z.object({ run: z.object({ id: z.number(), universe: z.enum(["sp100", "sp500"]), requestedCount: z.number(), scannedCount: z.number(), availableCount: z.number(), signalCount: z.number(), newsCount: z.number(), eligibleCount: z.number(), scoredCount: z.number(), watchedCount: z.number(), issuedCount: z.number(), suppressedCount: z.number(), lastAttemptAt: z.string().nullable(), lastSuccessAt: z.string().nullable(), overdue: z.boolean(), zeroCoverage: z.boolean(), status: z.enum(["ok", "partial", "degraded", "failed"]), note: z.string(), createdAt: z.string(), sourceUrl: z.string() }).nullable(), signals: z.array(z.object({ id: z.number(), symbol: z.string(), name: z.string(), sector: z.string(), universeTier: z.enum(["t1", "t2"]), direction: z.enum(["long", "short", "mixed"]), agreementScore: z.number(), activeFlags: z.number(), return15d: z.number().nullable(), volumeZ: z.number().nullable(), rankScore: z.number(), confidenceTier: z.enum(["high", "medium", "low"]), ratingAvailable: z.boolean(), dimensions: z.array(scanDimensionSchema), researchRequired: z.array(z.string()), factors: z.array(scanFactorSchema), formula: z.string(), invalidationLevel: z.number().nullable(), sourceUrl: z.string().nullable(), why: z.string(), sourceAsOf: z.string().nullable() })), tiers: z.object({ t1: z.array(universeTierRowSchema), t2: z.array(universeTierRowSchema), t3: z.array(universeTierRowSchema), methodology: z.string() }), sectors: z.array(z.object({ id: z.number(), sector: z.string(), direction: z.enum(["positive", "negative", "mixed"]), evidenceScore: z.number(), headline: z.string(), reason: z.string(), sourceCount: z.number() })), news: z.array(z.object({ id: z.number(), title: z.string(), source: z.string(), url: z.string(), publishedAt: z.string(), timestampKind: z.enum(["published", "retrieved"]), whyItMatters: z.string(), ripples: z.array(z.string()) })), theoryRun: z.object({ status: z.enum(["ok", "degraded", "failed"]), surfacedCount: z.number(), withheldFloorCount: z.number(), contestedCount: z.number(), note: z.string() }).nullable() });
const briefEvidenceSchema = z.object({ label: z.string(), url: z.string().nullable() });
function theoryRunSummary(run: typeof schema.theoryDiscoveryRuns.$inferSelect, rows: Array<typeof schema.machineTheories.$inferSelect>) { const legacy = /cleared all six verification layers/i.test(run.note); if (!legacy) return { surfacedCount: run.surfacedCount, withheldFloorCount: run.withheldFloorCount, contestedCount: run.contestedCount, note: run.note }; const matching = rows.filter((row) => Math.abs(row.checkedAt.getTime() - run.finishedAt.getTime()) < 1000).slice(0, run.candidateCount); const scores = matching.map((row) => scoreTheoryLayers(parseLayers(row.layersJson))); const surfacedCount = scores.filter((score) => score.evidenceFloorMet).length; const contestedCount = scores.filter((score) => score.evidenceFloorMet && score.measuredConflict).length; const withheldFloorCount = Math.max(0, run.candidateCount - surfacedCount); return { surfacedCount, withheldFloorCount, contestedCount, note: `${run.candidateCount} synthesis candidate${run.candidateCount === 1 ? "" : "s"}: ${surfacedCount} surfaced as weighted watch items, ${withheldFloorCount} withheld for the two-measured-layer evidence floor, ${contestedCount} contested by measured evidence. This earlier run was re-read under the weighted model.` }; }
const marketDayBriefResponse = z.object({
  generatedAt: z.string(), sourceRunId: z.number().nullable(), sourceRunAt: z.string().nullable(), direction: z.enum(["bullish", "bearish", "mixed"]),
  indexAlignment: z.object({ bullish: z.number(), bearish: z.number(), mixed: z.number(), measured: z.number(), indexes: z.array(z.object({ symbol: z.string(), direction: z.enum(["long", "short", "mixed"]).nullable(), score: z.number().nullable(), return15d: z.number().nullable(), asOf: z.string().nullable(), url: z.string().nullable(), sparkline: z.array(z.number()).max(16) })) }),
  breadth: z.object({ percent: z.number().nullable(), advancing: z.number(), measured: z.number(), basis: z.string() }),
  runners: z.object({ asOf: z.string().nullable(), basis: z.string(), gainers: z.array(z.object({ symbol: z.string(), name: z.string(), sector: z.string(), changePercent: z.number(), asOf: z.string(), sparkline: z.array(z.number()).max(16) })).max(5), losers: z.array(z.object({ symbol: z.string(), name: z.string(), sector: z.string(), changePercent: z.number(), asOf: z.string(), sparkline: z.array(z.number()).max(16) })).max(5) }),
  regime: z.object({ phase: z.string(), asOf: z.string().nullable(), note: z.string() }),
  smartMoney: z.object({ posture: z.enum(["supportive", "cautious", "mixed", "unavailable"]), evidenceCount: z.number(), note: z.string() }),
  sectors: z.array(z.object({ sector: z.string(), direction: z.enum(["bullish", "bearish", "mixed"]), breadth: z.number().nullable(), advancing: z.number(), measured: z.number(), averageAgreement: z.number().nullable(), dailyChange: z.number().nullable(), sparkline: z.array(z.number()).max(16), notable: z.array(z.object({ symbol: z.string(), return15d: z.number().nullable(), score: z.number(), url: z.string().nullable() })) })),
  bullets: z.array(z.object({ text: z.string(), evidence: z.array(briefEvidenceSchema) })),
  theories: z.array(z.object({ id: z.number(), title: z.string(), status: z.enum(["live", "contested", "invalidated", "degraded"]), sectors: z.array(z.string()), checkedAt: z.string() })),
  synthesisState: z.string(),
});
async function readAutoScan(ctx: Ctx): Promise<z.infer<typeof autoScanResponse>> {
  const db = ctx.db<typeof schema>(); const runs = await db.select().from(schema.marketScanRuns).orderBy(desc(schema.marketScanRuns.createdAt)); const run = runs[0];
  const emptyTiers = { t1: [], t2: [], t3: [], methodology: "T1 is the S&P 100 large-cap/liquidity proxy and receives full scoring plus full research. T2 contains non-T1 names promoted to full scoring by the fixed +10% five-session velocity qualifier. T3 retains every remaining constituent on lightweight velocity tracking. Tiers change effort and display only; scores, weights, issuance gates, and grading are unchanged." };
  if (!run) return { run: null, signals: [], tiers: emptyTiers, sectors: [], news: [], theoryRun: null };
  const [signals, universeRows, sectors, news, theoryRuns, theoryRows] = await Promise.all([
    db.select().from(schema.marketScanSignals).orderBy(desc(schema.marketScanSignals.rankScore)),
    db.select().from(schema.marketScanUniverseRows).where(eq(schema.marketScanUniverseRows.runId, run.id)).orderBy(asc(schema.marketScanUniverseRows.symbol)),
    db.select().from(schema.sectorImpacts).where(eq(schema.sectorImpacts.runId, run.id)).orderBy(desc(schema.sectorImpacts.evidenceScore)),
    db.select().from(schema.marketScanNews).where(eq(schema.marketScanNews.runId, run.id)).orderBy(desc(schema.marketScanNews.id)),
    db.select().from(schema.theoryDiscoveryRuns).orderBy(desc(schema.theoryDiscoveryRuns.finishedAt)),
    db.select().from(schema.machineTheories).orderBy(desc(schema.machineTheories.checkedAt)),
  ]);
  const theoryRun = theoryRuns[0]; const summary = theoryRun ? theoryRunSummary(theoryRun, theoryRows) : null;
  const tierBySymbol = new Map(universeRows.map((row) => [row.symbol, row.universeTier]));
  const tierRows = universeRows.map((row) => ({ symbol: row.symbol, name: row.instrumentName, sector: row.sector, tier: row.universeTier, trackingMode: row.trackingMode, velocity5d: row.velocity5d, reason: row.tierReason }));
  const tiers = { t1: tierRows.filter((row) => row.tier === "t1"), t2: tierRows.filter((row) => row.tier === "t2"), t3: tierRows.filter((row) => row.tier === "t3"), methodology: emptyTiers.methodology };
  const runStatus = run.status === "failed" && run.scannedCount > 0 && run.availableCount === 0 ? "degraded" as const : run.status;
  const heartbeatAt = run.lastSuccessAt ?? null; const overdue = !heartbeatAt || Date.now() - heartbeatAt.getTime() > 36 * 60 * 60 * 1000;
  return { run: { id: run.id, universe: run.universe, requestedCount: run.requestedCount, scannedCount: run.scannedCount, availableCount: run.availableCount, signalCount: run.signalCount, newsCount: run.newsCount, eligibleCount: run.eligibleCount, scoredCount: run.scoredCount, watchedCount: run.watchedCount, issuedCount: run.issuedCount, suppressedCount: run.suppressedCount, lastAttemptAt: run.lastAttemptAt?.toISOString() ?? null, lastSuccessAt: heartbeatAt?.toISOString() ?? null, overdue, zeroCoverage: run.requestedCount > 0 && run.availableCount === 0, status: runStatus, note: run.note, createdAt: run.createdAt.toISOString(), sourceUrl: universeUrls[run.universe] }, signals: signals.map((row) => ({ id: row.id, symbol: row.symbol, name: row.instrumentName, sector: row.sector, universeTier: tierBySymbol.get(row.symbol) === "t1" ? "t1" as const : "t2" as const, direction: row.direction, agreementScore: row.agreementScore, activeFlags: row.activeFlags, return15d: row.return15d, volumeZ: row.volumeZ, rankScore: row.rankScore, confidenceTier: row.confidenceTier, ratingAvailable: parseScanDimensions(row.dimensionsJson).filter((dimension) => dimension.status !== "research").length >= 4 && parseScanFactors(row.factorBreakdownJson).length > 0 && row.invalidationLevel != null && row.sourceAsOf != null, dimensions: parseScanDimensions(row.dimensionsJson), researchRequired: asStringArray(row.researchRequiredJson), factors: parseScanFactors(row.factorBreakdownJson), formula: "Directional rating = 100 × (supporting − conflicting) ÷ measured dimensions. Coverage is shown separately; unavailable research never becomes a directional vote. The factor ledger below supplies the underlying trend and momentum evidence.", invalidationLevel: row.invalidationLevel, sourceUrl: row.sourceUrl, why: row.why, sourceAsOf: row.sourceAsOf })), tiers, sectors: sectors.map((row) => ({ id: row.id, sector: row.sector, direction: row.direction, evidenceScore: row.evidenceScore, headline: row.headline, reason: row.reason, sourceCount: row.sourceCount })), news: news.map((row) => ({ id: row.id, title: row.title, source: row.source, url: row.sourceUrl, publishedAt: row.publishedAt, timestampKind: row.timestampKind, whyItMatters: row.whyItMatters, ripples: asStringArray(row.ripplesJson) })), theoryRun: theoryRun && summary ? { status: theoryRun.status, surfacedCount: summary.surfacedCount, withheldFloorCount: summary.withheldFloorCount, contestedCount: summary.contestedCount, note: summary.note } : null };
}
async function populateUniverseTierBatch(ctx: Ctx, args: { universe: "sp100" | "sp500"; offset: number; limit: number }): Promise<z.infer<typeof tierBatchResponse>> {
  const db = ctx.db<typeof schema>();
  const loaded = await loadScanUniverse(args.universe);
  const profiles = loaded.profiles;
  const run = (await db.select().from(schema.marketScanRuns).where(eq(schema.marketScanRuns.universe, args.universe)).orderBy(desc(schema.marketScanRuns.createdAt)))[0];
  if (!run) return { ok: false, universe: args.universe, runId: null, offset: args.offset, processed: 0, totalProfiles: profiles.length, persistedCounts: { t1: 0, t2: 0, t3: 0 }, complete: false, note: `No persisted ${args.universe.toUpperCase()} scan run exists to attach tier rows to.` };
  const batch = profiles.slice(args.offset, args.offset + args.limit);
  const largeCapSymbols = args.universe === "sp100" ? new Set(profiles.map((profile) => profile.symbol)) : new Set((await loadScanUniverse("sp100")).profiles.map((profile) => profile.symbol));
  const velocityBySymbol = args.universe === "sp500" ? await velocityScreen(batch) : new Map<string, number>();
  const existing = await db.select().from(schema.marketScanUniverseRows).where(eq(schema.marketScanUniverseRows.runId, run.id));
  const existingBySymbol = new Map(existing.map((row) => [row.symbol, row]));
  for (const profile of batch) {
    const velocity5d = velocityBySymbol.get(profile.symbol) ?? null;
    const universeTier = largeCapSymbols.has(profile.symbol) ? "t1" as const : velocity5d != null && velocity5d >= 10 ? "t2" as const : "t3" as const;
    const trackingMode = universeTier === "t3" ? "lightweight" as const : "full" as const;
    const tierReason = universeTier === "t1" ? "S&P 100 large-cap/liquidity proxy; full scoring and full research." : universeTier === "t2" ? `Five-session velocity ${velocity5d == null ? "unavailable" : `${velocity5d >= 0 ? "+" : ""}${velocity5d}%`} cleared the fixed +10% qualifier; full scoring for this run.` : `Five-session velocity ${velocity5d == null ? "unavailable" : `${velocity5d >= 0 ? "+" : ""}${velocity5d}%`} stayed below the fixed +10% qualifier; retained on lightweight tracking.`;
    const values = { instrumentName: profile.name, sector: profile.sector, universeTier, trackingMode, velocity5d, tierReason, createdAt: run.createdAt };
    const prior = existingBySymbol.get(profile.symbol);
    if (prior) await db.update(schema.marketScanUniverseRows).set(values).where(eq(schema.marketScanUniverseRows.id, prior.id));
    else await db.insert(schema.marketScanUniverseRows).values({ runId: run.id, symbol: profile.symbol, ...values });
  }
  const persisted = await db.select().from(schema.marketScanUniverseRows).where(eq(schema.marketScanUniverseRows.runId, run.id));
  const persistedCounts = { t1: persisted.filter((row) => row.universeTier === "t1").length, t2: persisted.filter((row) => row.universeTier === "t2").length, t3: persisted.filter((row) => row.universeTier === "t3").length };
  const complete = persisted.length === profiles.length;
  ctx.invalidateQueries();
  return { ok: true, universe: args.universe, runId: run.id, offset: args.offset, processed: batch.length, totalProfiles: profiles.length, persistedCounts, complete, note: `${persisted.length}/${profiles.length} tier rows are persisted for scan run ${run.id}. This bounded population pass changes tier metadata only; scoring, gates, signals, and grading are untouched.` };
}

async function readUniverseTierPopulationStatus(ctx: Ctx, universe: "sp100" | "sp500", batchesRun = 0): Promise<z.infer<typeof tierPopulationStatusResponse>> {
  const db = ctx.db<typeof schema>();
  const loaded = await loadScanUniverse(universe);
  const run = (await db.select().from(schema.marketScanRuns).where(eq(schema.marketScanRuns.universe, universe)).orderBy(desc(schema.marketScanRuns.createdAt)))[0];
  if (!run) return { ok: false, universe, runId: null, totalProfiles: loaded.profiles.length, persistedTotal: 0, persistedCounts: { t1: 0, t2: 0, t3: 0 }, complete: false, batchesRun, note: `No persisted ${universe.toUpperCase()} scan run exists to query.` };
  const rows = await db.select().from(schema.marketScanUniverseRows).where(eq(schema.marketScanUniverseRows.runId, run.id));
  const persistedCounts = { t1: rows.filter((row) => row.universeTier === "t1").length, t2: rows.filter((row) => row.universeTier === "t2").length, t3: rows.filter((row) => row.universeTier === "t3").length };
  const complete = rows.length === loaded.profiles.length;
  return { ok: true, universe, runId: run.id, totalProfiles: loaded.profiles.length, persistedTotal: rows.length, persistedCounts, complete, batchesRun, note: `${rows.length}/${loaded.profiles.length} tier rows are persisted for the latest ${universe.toUpperCase()} scan run ${run.id}.` };
}

async function populateUniverseTiers(ctx: Ctx, args: { universe: "sp100" | "sp500"; batchSize: number }): Promise<z.infer<typeof tierPopulationStatusResponse>> {
  const loaded = await loadScanUniverse(args.universe);
  let batchesRun = 0;
  for (let offset = 0; offset < loaded.profiles.length; offset += args.batchSize) {
    const result = await populateUniverseTierBatch(ctx, { universe: args.universe, offset, limit: Math.min(args.batchSize, 50) });
    batchesRun += 1;
    if (!result.ok) return { ok: false, universe: args.universe, runId: result.runId, totalProfiles: result.totalProfiles, persistedTotal: result.persistedCounts.t1 + result.persistedCounts.t2 + result.persistedCounts.t3, persistedCounts: result.persistedCounts, complete: false, batchesRun, note: result.note };
  }
  return readUniverseTierPopulationStatus(ctx, args.universe, batchesRun);
}

function normalizedSparkline(points: Point[], count = 12): number[] {
  const completed = completedDailyPoints(points).slice(-count);
  const base = completed[0]?.close;
  if (!base || completed.length < 2) return [];
  return completed.map((point) => round(point.close / base * 100, 3));
}
function latestSessionMove(points: Point[]): { asOf: string; changePercent: number } | null {
  const completed = completedDailyPoints(points);
  const latest = completed.at(-1); const previous = completed.at(-2);
  if (!latest || !previous || previous.close <= 0) return null;
  return { asOf: latest.date, changePercent: round((latest.close / previous.close - 1) * 100, 3) };
}
async function _currentCycleClock(ctx: Ctx): Promise<z.infer<typeof cycleClockResponse>> {
  const symbols = ["^TNX", "^FVX", "TIP", "IEF", "HYG", "LQD", "SPY"];
  await Promise.all(symbols.map((symbol) => yahooFullHistory(ctx, symbol, "background").catch(() => null)));
  return cycleClockFromCache(ctx);
}

async function buildMarketDayBrief(ctx: Ctx): Promise<z.infer<typeof marketDayBriefResponse>> {
  const db = ctx.db<typeof schema>();
  const [scan, alertsRows, theoryRows] = await Promise.all([
    readAutoScan(ctx),
    db.select().from(schema.alerts).orderBy(desc(schema.alerts.createdAt)),
    db.select().from(schema.machineTheories).orderBy(desc(schema.machineTheories.checkedAt)),
  ]);
  const indexSymbols = ["SPY", "QQQ", "IWM", "DIA"];
  // This builder runs only inside the scan pipeline. It reads histories already
  // persisted by scanning; the Trending read path never starts market fetches.
  const indexResults = await Promise.all(indexSymbols.map(async (symbol) => ({ symbol, series: await cachedHistoryOnly(ctx, symbol) })));
  const indexes = indexResults.map(({ symbol, series }) => {
    const points = completedDailyPoints(series?.points ?? []);
    const score = points.length ? factorScoreAt(points, points.length - 1) : null;
    const direction: "long" | "short" | "mixed" | null = score == null ? null : score >= 20 ? "long" : score <= -20 ? "short" : "mixed";
    const latest = points.at(-1); const previous15 = points.at(-16);
    return { symbol, direction, score, return15d: latest && previous15 ? finite(pct(latest.close, previous15.close)) : null, asOf: latest?.date ?? null, url: series?.sourceUrl ?? null, sparkline: normalizedSparkline(points) };
  });
  const measuredIndexes = indexes.filter((row) => row.direction != null); const bullishIndexes = measuredIndexes.filter((row) => row.direction === "long").length; const bearishIndexes = measuredIndexes.filter((row) => row.direction === "short").length; const mixedIndexes = measuredIndexes.filter((row) => row.direction === "mixed").length;
  const currentIndexSession = indexes.map((row) => row.asOf).filter((value): value is string => value != null).sort().at(-1) ?? null;
  const trackedSeries = await Promise.all(scan.signals.map(async (row) => ({ row, series: await cachedHistoryOnly(ctx, row.symbol) })));
  const runnerRows = trackedSeries.flatMap(({ row, series }) => { if (!series) return []; const move = latestSessionMove(series.points); if (!move || (currentIndexSession && move.asOf !== currentIndexSession)) return []; return [{ symbol: row.symbol, name: row.name, sector: row.sector, changePercent: move.changePercent, asOf: move.asOf, sparkline: normalizedSparkline(series.points) }]; });
  const gainers = [...runnerRows].filter((row) => row.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const losers = [...runnerRows].filter((row) => row.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
  const runnerAsOf = runnerRows.map((row) => row.asOf).sort().at(-1) ?? null;
  const measuredBreadth = runnerRows; const advancing = measuredBreadth.filter((row) => row.changePercent > 0).length; const breadthPercent = measuredBreadth.length ? round(advancing / measuredBreadth.length * 100) : null;
  const direction: "bullish" | "bearish" | "mixed" = bullishIndexes >= 3 && (breadthPercent ?? 0) >= 55 ? "bullish" : bearishIndexes >= 3 && (breadthPercent ?? 100) <= 45 ? "bearish" : "mixed";
  const bySector = new Map<string, typeof scan.signals>(); for (const row of scan.signals) bySector.set(row.sector, [...(bySector.get(row.sector) ?? []), row]);
  const runnerBySymbol = new Map(runnerRows.map((row) => [row.symbol, row]));
  const sectors = [...bySector.entries()].map(([sector, rows]) => {
    const members = rows.flatMap((row) => { const tracked = runnerBySymbol.get(row.symbol); return tracked ? [tracked] : []; });
    const up = members.filter((row) => row.changePercent > 0).length; const breadth = members.length ? round(up / members.length * 100) : null;
    const dailyChange = members.length ? round(members.reduce((sum, row) => sum + row.changePercent, 0) / members.length, 3) : null;
    const rated = rows.filter((row) => row.ratingAvailable); const averageAgreement = rated.length ? round(rated.reduce((sum, row) => sum + row.agreementScore, 0) / rated.length) : null;
    const maxLength = Math.max(0, ...members.map((member) => member.sparkline.length));
    const sparkline = Array.from({ length: maxLength }, (_, index) => { const values = members.map((member) => member.sparkline[index]).filter((value): value is number => value != null); return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 3) : null; }).filter((value): value is number => value != null);
    const sectorDirection: "bullish" | "bearish" | "mixed" = (breadth ?? 50) >= 60 && (dailyChange ?? 0) > 0 ? "bullish" : (breadth ?? 50) <= 40 && (dailyChange ?? 0) < 0 ? "bearish" : "mixed";
    return { sector, direction: sectorDirection, breadth, advancing: up, measured: members.length, averageAgreement, dailyChange, sparkline, notable: [...rows].sort((a, b) => Math.abs((runnerBySymbol.get(b.symbol)?.changePercent ?? 0)) - Math.abs((runnerBySymbol.get(a.symbol)?.changePercent ?? 0))).slice(0, 3).map((row) => ({ symbol: row.symbol, return15d: row.return15d, score: row.agreementScore, url: row.sourceUrl })) };
  }).sort((a, b) => (b.dailyChange ?? -Infinity) - (a.dailyChange ?? -Infinity)).slice(0, 8);
  const cycle = await cycleClockFromCache(ctx).catch(() => null); const regime = cycle?.status === "ok" ? { phase: cycle.phase ?? "unavailable", asOf: cycle.asOf, note: cycle.note } : { phase: "unavailable", asOf: null, note: cycle?.note ?? "Cycle-clock inputs were unavailable in the scan cache." };
  const cutoff = Date.now() - 14 * 86400000; const filingAlerts = alertsRows.filter((row) => row.createdAt.getTime() >= cutoff && (row.kind === "Form 4" || row.kind === "13D/G")); const buyHints = filingAlerts.filter((row) => /buy|stake|added|purchase/i.test(row.message)).length; const sellHints = filingAlerts.filter((row) => /sell|sale|reduced/i.test(row.message)).length; const smartPosture: "supportive" | "cautious" | "mixed" | "unavailable" = !filingAlerts.length ? "unavailable" : buyHints > sellHints ? "supportive" : sellHints > buyHints ? "cautious" : "mixed"; const smartNote = !filingAlerts.length ? "No fresh Form 4 or 13D/G alert is retained in the last 14 days; broad smart-money posture is unavailable rather than inferred." : `${filingAlerts.length} filing alert${filingAlerts.length === 1 ? "" : "s"} in 14 days: ${buyHints} purchase/add language, ${sellHints} sale/reduction language. Filing alerts are delayed evidence, not live flow.`;
  const leadingSector = sectors[0]; const laggingSector = [...sectors].sort((a, b) => (a.averageAgreement ?? 0) - (b.averageAgreement ?? 0))[0]; const radar = scan.signals.filter((row) => row.ratingAvailable && Math.abs(row.agreementScore) >= 90).slice(0, 4); const topNews = scan.news[0];
  const bullets: z.infer<typeof marketDayBriefResponse>["bullets"] = [];
  bullets.push({ text: `${bullishIndexes} of ${measuredIndexes.length} measured major indexes are bullish and ${bearishIndexes} are bearish; ${breadthPercent == null ? "tracked-candidate daily breadth is unavailable" : `${advancing}/${measuredBreadth.length} tracked candidates (${breadthPercent}%) advanced in the latest completed session`}.`, evidence: indexes.filter((row) => row.asOf).map((row) => ({ label: `${row.symbol} ${row.score == null ? "unrated" : `${row.score >= 0 ? "+" : ""}${row.score}`} · 15d ${pctText(row.return15d)}`, url: row.url })) });
  if (leadingSector) bullets.push({ text: `${leadingSector.sector} has the strongest retained sector agreement (${leadingSector.averageAgreement == null ? "unrated" : `${leadingSector.averageAgreement >= 0 ? "+" : ""}${leadingSector.averageAgreement}`}) with ${leadingSector.breadth == null ? "breadth unavailable" : `${leadingSector.breadth}% breadth`}${laggingSector && laggingSector.sector !== leadingSector.sector ? `; ${laggingSector.sector} is weakest at ${laggingSector.averageAgreement ?? 0}` : ""}.`, evidence: [...leadingSector.notable, ...(laggingSector?.notable ?? [])].map((row) => ({ label: `${row.symbol} · 15d ${pctText(row.return15d)} · score ${row.score >= 0 ? "+" : ""}${row.score}`, url: row.url })) });
  bullets.push({ text: radar.length ? `${radar.length} retained scan signal${radar.length === 1 ? "" : "s"} clear the ±90 evidence gate: ${radar.map((row) => `${row.symbol} ${row.agreementScore >= 0 ? "+" : ""}${row.agreementScore}`).join(", ")}.` : "No retained scan signal currently clears the ±90 gate with a complete factor ledger, invalidation, timestamp, and source.", evidence: radar.map((row) => ({ label: `${row.symbol} factor evidence`, url: row.sourceUrl })) });
  bullets.push({ text: `Smart-money posture: ${smartPosture.toUpperCase()}. ${smartNote}`, evidence: filingAlerts.slice(0, 4).map((row) => ({ label: `${row.symbol} · ${row.kind} · ${row.message}`, url: row.sourceUrl })) });
  if (topNews) bullets.push({ text: `Top retained news driver: ${topNews.title}. ${topNews.whyItMatters}`, evidence: [{ label: `${topNews.source} · ${topNews.timestampKind} ${topNews.publishedAt}`, url: topNews.url }] });
  const theories = theoryRows.slice(0, 8).map((row) => ({ id: row.id, title: row.title, status: row.status, sectors: asStringArray(row.sectorOutlookJson), checkedAt: row.checkedAt.toISOString() }));
  return { generatedAt: new Date().toISOString(), sourceRunId: scan.run?.id ?? null, sourceRunAt: scan.run?.createdAt ?? null, direction, indexAlignment: { bullish: bullishIndexes, bearish: bearishIndexes, mixed: mixedIndexes, measured: measuredIndexes.length, indexes }, breadth: { percent: breadthPercent, advancing, measured: measuredBreadth.length, basis: scan.run ? `${scan.run.universe.toUpperCase()} latest tracked-candidate set; this is not full-universe advance/decline breadth.` : "No completed broad scan is available." }, runners: { asOf: runnerAsOf, basis: "Latest completed session among symbols in the persisted tracked scan cohort.", gainers, losers }, regime, smartMoney: { posture: smartPosture, evidenceCount: filingAlerts.length, note: smartNote }, sectors, bullets: bullets.slice(0, 5), theories, synthesisState: scan.run ? "Cross-insight inputs are available for agent-led theory synthesis through discovery, market-read, and news evidence." : "A completed broad scan is required before evidence can be handed off for agent-led theory synthesis." };
}

async function writeMarketDayBriefCache(ctx: Ctx, runId: number): Promise<z.infer<typeof marketDayBriefResponse>> {
  const brief = await buildMarketDayBrief(ctx);
  const generatedAt = new Date(brief.generatedAt);
  await ctx.db<typeof schema>().update(schema.marketScanRuns).set({ marketBriefJson: JSON.stringify(brief), marketBriefGeneratedAt: generatedAt }).where(eq(schema.marketScanRuns.id, runId));
  return brief;
}

async function readMarketDayBriefCache(ctx: Ctx): Promise<z.infer<typeof marketDayBriefResponse>> {
  const rows = await ctx.db<typeof schema>().select({ id: schema.marketScanRuns.id, payload: schema.marketScanRuns.marketBriefJson }).from(schema.marketScanRuns).orderBy(desc(schema.marketScanRuns.createdAt)).limit(20);
  for (const row of rows) {
    if (!row.payload) continue;
    try {
      const parsed = marketDayBriefResponse.safeParse(JSON.parse(row.payload));
      if (parsed.success) return parsed.data;
    } catch { /* try the next retained scan cache */ }
  }
  throw new Error("No cached market brief is available yet. Run the market scan once to prepare Trending.");
}

type TheoryDiscoveryResult = { status: "ok" | "degraded" | "failed"; note: string; candidateCount: number; surfacedCount: number; withheldFloorCount: number; contestedCount: number; checkedAt: string };

async function collectTheoryDiscoveryEvidence(ctx: Ctx): Promise<TheoryDiscoveryResult> {
  // Keep the legacy verifier code intact for this scoped retirement, but do
  // not invoke any synthesis helper from discovery.
  void candidateSchema;
  void assessSmartMoney;
  void verifyCandidate;
  // Preserve the existing discovery inputs, but stop at the evidence boundary.
  // Theory synthesis and persistence are now agent-led through saveTheory and
  // attachTheoryEvidence; this path never invokes inference or writes a run.
  await readMarketDayBriefCache(ctx).catch(() => null);
  const scan = await readAutoScan(ctx);
  const checkedAt = new Date().toISOString();
  if (!scan.run) return { status: "failed", note: "No completed market scan exists, so there is no retained evidence set to hand off for agent-led theory synthesis.", candidateCount: 0, surfacedCount: 0, withheldFloorCount: 0, contestedCount: 0, checkedAt };

  const retrievedAt = checkedAt;
  const sources: DiscoverySource[] = [
    ...scan.news.map((row) => ({ title: row.title, url: row.url, source: row.source, snippet: row.whyItMatters, publishedAt: row.publishedAt, retrievedAt, singleSource: true })),
    ...scan.signals.filter((row) => row.sourceUrl).slice(0, 12).map((row) => ({ title: `${row.symbol} retained chart evidence`, url: row.sourceUrl ?? "", source: "Yahoo Finance", snippet: `${row.sector}; 15-session ${pctText(row.return15d)}; factor agreement ${row.ratingAvailable ? `${row.agreementScore >= 0 ? "+" : ""}${row.agreementScore}` : "unrated"}; ${row.why}`, publishedAt: row.sourceAsOf, retrievedAt, singleSource: false })),
  ];
  const evidenceCount = [...new Map(sources.map((row) => [row.url, row])).values()].filter((row) => row.url).length;
  const status: TheoryDiscoveryResult["status"] = evidenceCount > 0 ? "ok" : "degraded";
  return {
    status,
    note: `${evidenceCount} unique retained evidence source${evidenceCount === 1 ? "" : "s"} collected with current market context. No theory was synthesized or written; agent-led synthesis can use discoverTheories, getMarketRead, getNews, and the existing saveTheory + attachTheoryEvidence path.`,
    candidateCount: 0,
    surfacedCount: 0,
    withheldFloorCount: 0,
    contestedCount: 0,
    checkedAt,
  };
}

function passesDiscoveryCompleteness(result: z.infer<typeof analyzeResponse>, fullSeries: YahooSeries | null) {
  // The dossier response is intentionally downsampled for transport. Discovery must
  // test completeness against the owned full-history cache, never the 90-point chart
  // sent to the client. Using result.chart here made every name fail after the dossier
  // payload optimization even when Yahoo history was healthy.
  if (!result.instrument || !result.factorModel || !fullSeries) return { ok: false, reason: "full adjusted-price history was unavailable" };
  const history = completedDailyPoints(fullSeries.points);
  if (history.length < 252) return { ok: false, reason: "fewer than 252 clean daily sessions" };
  const recent = history.slice(-20); const liquidSessions = recent.filter((point) => point.volume != null && point.volume > 0 && point.close > 0); if (liquidSessions.length < 18) return { ok: false, reason: "fewer than 18 liquid sessions in the latest 20" };
  const dollarVolumes = liquidSessions.map((point) => point.close * (point.volume ?? 0)).sort((a, b) => a - b); const medianDollarVolume = dollarVolumes[Math.floor(dollarVolumes.length / 2)] ?? 0; if (medianDollarVolume < 25_000_000) return { ok: false, reason: "median 20-session dollar volume below $25m" };
  const latest = history.at(-1); if (!latest) return { ok: false, reason: "latest source bar unavailable" }; const ageDays = (Date.now() - Date.parse(`${latest.date}T21:00:00Z`)) / 86400000; if (!Number.isFinite(ageDays) || ageDays > 5) return { ok: false, reason: "latest bar older than 5 calendar days" };
  if (result.factorModel.factors.some((factor) => factor.quality !== "GOOD")) return { ok: false, reason: "one or more scoring factors failed sample, anomaly, or freshness gates" };
  return { ok: true, reason: "252 sessions, 18/20 recent liquid bars, $25m median dollar volume, all factor gates passed" };
}
async function runAutomatedMarketScan(ctx: Ctx, universe: "sp100" | "sp500"): Promise<z.infer<typeof autoScanResponse>> {
  const startedAt = new Date(); let profiles: UniverseProfile[] = []; let sourceUrl: string = universeUrls[universe];
  try { const loaded = await loadScanUniverse(universe); profiles = loaded.profiles; sourceUrl = loaded.sourceUrl; } catch (error) {
    const inserted = await ctx.db<typeof schema>().insert(schema.marketScanRuns).values({ universe, requestedCount: universe === "sp100" ? 101 : 503, scannedCount: 0, availableCount: 0, signalCount: 0, newsCount: 0, eligibleCount: 0, scoredCount: 0, watchedCount: 0, issuedCount: 0, suppressedCount: universe === "sp100" ? 101 : 503, lastAttemptAt: startedAt, lastSuccessAt: null, status: "failed", note: `Universe membership could not be loaded: ${String(error).replace(/^Error:\s*/, "")}`, exclusionsJson: "[]", createdAt: startedAt }).returning();
    ctx.invalidateQueries(); return inserted[0] ? readAutoScan(ctx) : { run: null, signals: [], tiers: { t1: [], t2: [], t3: [], methodology: "Universe tiering was unavailable because membership could not be loaded." }, sectors: [], news: [], theoryRun: null };
  }
  const db = ctx.db<typeof schema>();
  let largeCapSymbols = new Set(profiles.map((profile) => profile.symbol));
  if (universe === "sp500") {
    try { largeCapSymbols = new Set((await loadScanUniverse("sp100")).profiles.map((profile) => profile.symbol)); }
    catch { largeCapSymbols = new Set(); }
  }
  const topTierProfiles = profiles.filter((profile) => largeCapSymbols.has(profile.symbol));
  const velocityBySymbol = await velocityScreen(profiles); const scoringSelection = fullScoringProfiles(topTierProfiles, profiles, velocityBySymbol); const scanProfiles = scoringSelection.profiles;
  const t2Symbols = new Set(scoringSelection.qualifiers.map((profile) => profile.symbol));
  const spy = await analyze(ctx, "SPY", false).catch(() => null);
  const scanFailureBySymbol = new Map<string, string>();
  const rows = await mapWithConcurrency(scanProfiles, universe === "sp500" ? 18 : 14, async (profile) => {
    const result = await analyze(ctx, profile.symbol, false).catch((error) => {
      scanFailureBySymbol.set(profile.symbol, `Chart analysis failed: ${String(error).replace(/^Error:\s*/, "")}`);
      return null;
    });
    if (!result?.instrument || !result.factorModel) {
      scanFailureBySymbol.set(profile.symbol, result?.error ? `Chart analysis failed: ${result.error}` : "No usable instrument and factor history was returned.");
      return null;
    }
    const fullSeries = await cachedHistoryOnly(ctx, result.instrument.symbol);
    if (!fullSeries) {
      scanFailureBySymbol.set(profile.symbol, "Discovery completeness failed: full adjusted-price history was unavailable.");
      return null;
    }
    const completeness = passesDiscoveryCompleteness(result, fullSeries);
    if (!completeness.ok) {
      scanFailureBySymbol.set(profile.symbol, `Discovery completeness failed: ${completeness.reason}.`);
      return null;
    }
    const tape = buildSignalTape(result, spy?.status === "ok" ? spy : null); const activeFlags = tape.filter((signal) => signal.active).length; const return15d = getMetric(result.returns, "15d"); const volumeZ = getMetric(result.indicators, "Volume z"); const gate = fiveDimensionGate(result, spy?.status === "ok" ? spy : null); const score = gate.ratingScore; const supports = gate.dimensions.filter((dimension) => dimension.status === "supports").length; const conflicts = gate.dimensions.filter((dimension) => dimension.status === "conflicts").length; const rankScore = round((gate.confidenceTier === "high" ? 200 : gate.confidenceTier === "medium" ? 100 : 0) + supports * 22 - conflicts * 28 + Math.abs(score ?? 0) * 0.5 + Math.min(15, Math.abs(volumeZ ?? 0) * 5));
    const whyParts = [`${gate.confidenceTier.toUpperCase()} confidence`, `${supports}/5 dimensions support`, `${conflicts} conflict${conflicts === 1 ? "" : "s"}`, score == null ? "NO DIRECTIONAL RATING · fewer than 4/5 dimensions measured or factor direction is mixed" : `${score >= 0 ? "+" : ""}${score} five-dimension agreement`]; if (gate.researchRequired.length) whyParts.push(`research: ${gate.researchRequired.join(", ")}`);
    return { profile, result, fullSeries, activeFlags, return15d, volumeZ, rankScore, gate, why: whyParts.join(" · ") };
  });
  const available = rows.filter((row): row is NonNullable<typeof row> => row != null);
  const validated = await mapWithConcurrency(available, 4, async (row) => {
    const direction = row.gate.ratingDirection; const invalidation = row.result.levels?.invalidation ?? null; const signalDate = row.result.chart.at(-1)?.date ?? null;
    if (!direction || invalidation == null || !signalDate) return { ...row, issuance: null, signalDay: null, issuanceSourceUrl: row.fullSeries.sourceUrl };
    // analyze() already fetched the same Yahoo daily series and persisted it in the
    // owned cache. Reuse those exact completed bars for issuance validation instead
    // of making a second network request per symbol; the decision rule is unchanged.
    const history = completedDailyPoints(row.fullSeries.points);
    const signalDay = history.find((point) => point.date === signalDate) ?? null;
    const issuance = signalIssuanceDecision(direction, invalidation, signalDay, history);
    return { ...row, issuance, signalDay, issuanceSourceUrl: row.fullSeries.sourceUrl };
  });
  const suppressed = validated.filter((row) => row.gate.ratingDirection != null && row.issuance != null && !row.issuance.allowed); const issuable = validated.filter((row) => !row.issuance || row.issuance.allowed); const selected = issuable.sort((a, b) => b.rankScore - a.rankScore).slice(0, 50);
  let newsResult: Awaited<ReturnType<typeof marketNews>> = { view: "discovery", symbol: null, retrievedAt: new Date().toISOString(), items: [] }; try { newsResult = await marketNews(ctx, "discovery", null); } catch { /* empty source-backed state */ }
  const sectorStats = new Map<string, { count: number; sum: number; symbols: string[] }>(); for (const row of selected) { const existing = sectorStats.get(row.profile.sector) ?? { count: 0, sum: 0, symbols: [] }; existing.count++; existing.sum += row.gate.ratingScore ?? 0; existing.symbols.push(row.profile.symbol); sectorStats.set(row.profile.sector, existing); }
  let sectorRows: z.infer<typeof sectorImpactGenerated> = [...sectorStats.entries()].map(([sector, stat]) => { const avg = Math.round(stat.sum / stat.count); return { sector, direction: avg >= 20 ? "positive" as const : avg <= -20 ? "negative" as const : "mixed" as const, evidenceScore: avg, headline: `${stat.count} ranked ${stat.count === 1 ? "signal" : "signals"} in ${sector}`, reason: `Average factor agreement ${avg >= 0 ? "+" : ""}${avg}; leaders: ${stat.symbols.slice(0, 5).join(", ")}.`, sourceCount: 0 }; }).sort((a, b) => Math.abs(b.evidenceScore) - Math.abs(a.evidenceScore)).slice(0, 10);
  if (newsResult.items.length || selected.length) try {
    const signalText = selected.slice(0, 24).map((row) => `${row.profile.symbol} | ${row.profile.sector} | ${row.gate.confidenceTier} confidence | ${row.gate.ratingScore == null ? "no directional rating" : `five-dimension agreement ${row.gate.ratingScore}`} | dimensions ${row.gate.dimensions.map((dimension) => `${dimension.name}:${dimension.status}`).join(", ")} | 15d ${pctText(row.return15d)} | volume ${numText(row.volumeZ)}σ | ${row.activeFlags} active setups`).join("\n"); const newsText = newsResult.items.slice(0, 10).map((item, index) => `[${index + 1}] ${item.title} | ${item.source} | ${item.whyItMatters} | ripples: ${item.ripples.join(", ")}`).join("\n");
    sectorRows = await ctx.inference.complete(`Synthesize sector impact from the ranked cross-sectional signals and source-linked news below. Evidence score is signed agreement from -100 to 100, not probability. Keep chart evidence and news influence distinct in each reason. If they conflict, direction must be mixed. sourceCount is the number of supplied news rows that directly support that sector statement. Do not add facts or sectors unsupported by the inputs.\n\nSIGNALS\n${signalText}\n\nNEWS\n${newsText}`, { schema: sectorImpactGenerated });
  } catch { /* deterministic sector aggregation remains */ }
  const availableSymbols = new Set(available.map((row) => row.profile.symbol)); const failedExclusions = scanProfiles.filter((profile) => !availableSymbols.has(profile.symbol)).map((profile) => ({ symbol: profile.symbol, reason: scanFailureBySymbol.get(profile.symbol) ?? "No usable chart returned." })); const suppressedExclusions = suppressed.map((row) => ({ symbol: row.profile.symbol, reason: row.issuance?.reason ?? "Signal issuance gate did not clear." })); const exclusions = [...failedExclusions, ...suppressedExclusions];
  const status: "ok" | "partial" | "degraded" = !available.length ? "degraded" : available.length < scanProfiles.length || !newsResult.items.length ? "partial" : "ok"; const t3Count = Math.max(0, profiles.length - topTierProfiles.length - scoringSelection.qualifiers.length); const coverageNote = !available.length ? `DEGRADED — zero of ${scanProfiles.length} full-score candidates produced usable histories. The empty candidate set is a data-pipeline failure, not a no-signal market result.` : `${available.length}/${scanProfiles.length} full-score candidates cleared completeness.`; const note = `${coverageNote} ${velocityBySymbol.size}/${profiles.length} constituents returned the lightweight 5-session velocity read. T1: ${topTierProfiles.length} S&P 100 large-cap/liquidity proxy names received full scoring and research. T2: ${scoringSelection.qualifiers.length} other names cleared the fixed +10% velocity qualifier and received the same full scoring. T3: ${t3Count} remaining names stayed visible on lightweight tracking. ${suppressed.length} directional candidate${suppressed.length === 1 ? " was" : "s were"} withheld by issuance validation. Eligibility, factor weights, formulas, publishing gates, the signal ledger, and grading are unchanged.`;
  const runRows = await db.insert(schema.marketScanRuns).values({ universe, requestedCount: profiles.length, scannedCount: scanProfiles.length, availableCount: available.length, signalCount: selected.length, newsCount: newsResult.items.length, eligibleCount: available.length, scoredCount: scanProfiles.length, watchedCount: selected.length, issuedCount: 0, suppressedCount: exclusions.length, lastAttemptAt: startedAt, lastSuccessAt: new Date(), status, note, exclusionsJson: JSON.stringify(exclusions), createdAt: startedAt }).returning(); const run = runRows[0]; if (!run) return { run: null, signals: [], tiers: { t1: [], t2: [], t3: [], methodology: "Universe tier rows could not be saved." }, sectors: [], news: [], theoryRun: null };
  const universeTierRows = profiles.map((profile) => { const velocity5d = velocityBySymbol.get(profile.symbol) ?? null; const universeTier = largeCapSymbols.has(profile.symbol) ? "t1" as const : t2Symbols.has(profile.symbol) ? "t2" as const : "t3" as const; const trackingMode = universeTier === "t3" ? "lightweight" as const : "full" as const; const tierReason = universeTier === "t1" ? "S&P 100 large-cap/liquidity proxy; full scoring and full research." : universeTier === "t2" ? `Five-session velocity ${velocity5d == null ? "unavailable" : `${velocity5d >= 0 ? "+" : ""}${velocity5d}%`} cleared the fixed +10% qualifier; full scoring for this run.` : `Five-session velocity ${velocity5d == null ? "unavailable" : `${velocity5d >= 0 ? "+" : ""}${velocity5d}%`} stayed below the fixed +10% qualifier; retained on lightweight tracking.`; return { runId: run.id, symbol: profile.symbol, instrumentName: profile.name, sector: profile.sector, universeTier, trackingMode, velocity5d, tierReason, createdAt: startedAt }; });
  if (universeTierRows.length) await db.insert(schema.marketScanUniverseRows).values(universeTierRows);
  for (const row of suppressed) {
    const direction = row.gate.ratingDirection; const invalidation = row.result.levels?.invalidation; const signalDay = row.signalDay; const reason = row.issuance?.reason;
    if (!direction || invalidation == null || !reason || !row.result.instrument || !row.issuance) continue;
    await logSuppressedCandidate(ctx, { symbol: row.result.instrument.symbol, name: row.result.instrument.name, setupType: `Discovery ${row.gate.confidenceTier}`, direction, agreementScore: row.gate.ratingScore ?? row.result.factorModel?.score ?? 0, entryPrice: row.result.instrument.price ?? signalDay?.close ?? 0, invalidation, signalDate: signalDay?.date ?? row.result.chart.at(-1)?.date ?? startedAt.toISOString().slice(0, 10), signalDay, reason, origin: "discovery", sourceAsOf: signalDay ? `${signalDay.date}T21:00:00.000Z` : row.result.instrument.asOf ?? startedAt.toISOString(), sourceUrl: row.issuanceSourceUrl || row.result.instrument.sources[0]?.url || "", decision: row.issuance });
    await db.delete(schema.marketScanSignals).where(eq(schema.marketScanSignals.symbol, row.result.instrument.symbol));
  }
  const signalRows = selected.map((row) => ({ runId: run.id, symbol: row.result.instrument?.symbol ?? row.profile.symbol, instrumentName: row.result.instrument?.name ?? row.profile.name, sector: row.profile.sector, direction: row.gate.ratingDirection ?? "mixed" as const, agreementScore: row.gate.ratingScore ?? 0, activeFlags: row.activeFlags, return15d: row.return15d, volumeZ: row.volumeZ, rankScore: row.rankScore, confidenceTier: row.gate.confidenceTier, dimensionsJson: JSON.stringify(row.gate.dimensions), researchRequiredJson: JSON.stringify(row.gate.researchRequired), factorBreakdownJson: JSON.stringify(row.result.factorModel?.factors ?? []), invalidationLevel: row.result.levels?.invalidation ?? null, sourceUrl: row.result.instrument?.sources[0]?.url ?? null, why: row.why, sourceAsOf: row.result.instrument?.asOf ?? null, createdAt: startedAt }));
  for (const row of signalRows) await db.insert(schema.marketScanSignals).values(row).onConflictDoUpdate({ target: schema.marketScanSignals.symbol, set: { runId: row.runId, instrumentName: row.instrumentName, sector: row.sector, direction: row.direction, agreementScore: row.agreementScore, activeFlags: row.activeFlags, return15d: row.return15d, volumeZ: row.volumeZ, rankScore: row.rankScore, confidenceTier: row.confidenceTier, dimensionsJson: row.dimensionsJson, researchRequiredJson: row.researchRequiredJson, factorBreakdownJson: row.factorBreakdownJson, invalidationLevel: row.invalidationLevel, sourceUrl: row.sourceUrl, why: row.why, sourceAsOf: row.sourceAsOf, createdAt: row.createdAt } });
  for (const row of selected.filter((candidate) => Math.abs(candidate.gate.ratingScore ?? 0) >= 90)) { const symbol = row.result.instrument?.symbol ?? row.profile.symbol; const score = row.gate.ratingScore ?? 0; const direction = row.gate.ratingDirection ?? "mixed"; const invalidation = row.result.levels?.invalidation; await insertAlert(ctx, symbol, `Radar 90+ ${direction}`, `${score > 0 ? "+" : ""}${score} five-dimension agreement · ${direction.toUpperCase()} · ${row.gate.confidenceTier.toUpperCase()} confidence${invalidation == null ? "" : ` · invalidation ${round(invalidation)}`}.`, startedAt.toISOString().slice(0, 10), row.result.instrument?.sources[0]?.url ?? null); }
  if (sectorRows.length) await db.insert(schema.sectorImpacts).values(sectorRows.map((row) => ({ runId: run.id, ...row, createdAt: startedAt })));
  if (newsResult.items.length) await db.insert(schema.marketScanNews).values(newsResult.items.map((item) => ({ runId: run.id, title: item.title, source: item.source, sourceUrl: item.url, publishedAt: item.publishedAt, timestampKind: item.timestampKind, whyItMatters: item.whyItMatters, ripplesJson: JSON.stringify(item.ripples), createdAt: startedAt })));
  // Resolve any newly mature tracker horizons on every scheduled market scan.
  // This reuses the same persisted daily histories and does not alter scoring.
  await scoreTrackedSignals(ctx);
  // The market page is a pure cache read. Prepare its complete brief here, once,
  // after this run's signals, sectors, news, and cached histories are durable.
  await writeMarketDayBriefCache(ctx, run.id);
  // Theory synthesis is intentionally manual. A completed market scan must not emit a false-success 0-theory run or consume the worker budget.
  ctx.invalidateQueries(); const output = await readAutoScan(ctx); if (output.run) output.run.sourceUrl = sourceUrl; return output;
}

async function refreshSparseRadarRows(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const rows = await db.select().from(schema.marketScanSignals).orderBy(desc(schema.marketScanSignals.id));
  const candidates = rows.filter((row) => Math.abs(row.agreementScore) >= 90 && (parseScanFactors(row.factorBreakdownJson).length === 0 || parseScanDimensions(row.dimensionsJson).filter((dimension) => dimension.status !== "research").length < 4 || row.invalidationLevel == null || row.sourceAsOf == null || row.sourceUrl == null)).slice(0, 30);
  for (const row of candidates) {
    const result = await analyze(ctx, row.symbol, false).catch(() => null);
    if (!result?.instrument || !result.factorModel) continue;
    const gate = fiveDimensionGate(result, null); const invalidation = result.levels?.invalidation ?? null; const signalDate = result.chart.at(-1)?.date ?? null;
    if (gate.ratingDirection && invalidation != null && signalDate) {
      const exact = await exactYahooIssuanceCheck(result.instrument.symbol, signalDate, gate.ratingDirection, invalidation, "background");
      if (!exact.decision.allowed && exact.decision.reason) {
        await logSuppressedCandidate(ctx, { symbol: result.instrument.symbol, name: result.instrument.name, setupType: `Discovery ${gate.confidenceTier}`, direction: gate.ratingDirection, agreementScore: gate.ratingScore ?? result.factorModel.score, entryPrice: result.instrument.price ?? exact.signalDay?.close ?? row.rankScore, invalidation, signalDate, signalDay: exact.signalDay, reason: exact.decision.reason, origin: "discovery", sourceAsOf: exact.signalDay ? `${exact.signalDay.date}T21:00:00.000Z` : result.instrument.asOf ?? new Date().toISOString(), sourceUrl: exact.sourceUrl || result.instrument.sources[0]?.url || "", decision: exact.decision });
        await db.delete(schema.marketScanSignals).where(eq(schema.marketScanSignals.id, row.id));
        continue;
      }
    }
    await db.update(schema.marketScanSignals).set({
      direction: gate.ratingDirection ?? "mixed",
      agreementScore: gate.ratingScore ?? 0,
      confidenceTier: gate.confidenceTier,
      dimensionsJson: JSON.stringify(gate.dimensions),
      researchRequiredJson: JSON.stringify(gate.researchRequired),
      factorBreakdownJson: JSON.stringify(result.factorModel.factors),
      invalidationLevel: invalidation,
      sourceAsOf: result.instrument.asOf,
      sourceUrl: result.instrument.sources[0]?.url ?? null,
      why: gate.ratingScore == null ? "NO DIRECTIONAL RATING · fewer than 4 of 5 required dimensions are measured." : `${gate.ratingScore >= 0 ? "+" : ""}${gate.ratingScore} five-dimension agreement · ${gate.confidenceTier.toUpperCase()} confidence`,
    }).where(eq(schema.marketScanSignals.id, row.id));
  }
}

async function refreshCurrentTrackedEvidence(_ctx: Ctx) {
  // Issued rows are immutable. Maintenance may refresh external caches and append
  // versioned correction events, but it must never rewrite historical direction,
  // score, factors, inputs, or levels in tracked_signals.
  return;
}

const engineHitEvidenceSchema = z.object({ title: z.string(), source: z.string(), url: z.string(), supports: z.string() });
const engineHitHopSchema = z.object({ from: z.string(), to: z.string(), mechanism: z.string(), kind: z.enum(["verified", "inference"]), evidenceIndexes: z.array(z.number()) });
const engineHitSchema = z.object({ id: z.number(), kind: z.enum(["hit", "gem"]), symbol: z.string().nullable(), anomaly: z.string().nullable(), tags: z.array(z.string()), evidenceStrength: z.number().nullable(), hitAt: z.string(), testCaseLabel: z.string(), thesis: z.string(), triggerEvent: z.string(), engineScore: z.number(), confidenceTier: z.enum(["high", "medium", "low"]), tapeState: z.string(), twist: z.string(), evidence: z.array(engineHitEvidenceSchema), lowTierEvidenceExcluded: z.number(), rippleChain: z.array(engineHitHopSchema), createdAt: z.string() });
const engineHitsResponse = z.object({ hits: z.array(engineHitSchema), nextCursor: z.number().nullable() });
type EngineHitEvidence = z.infer<typeof engineHitEvidenceSchema>;
type EngineHitHop = z.infer<typeof engineHitHopSchema>;
function parseEngineHitEvidence(value: string): EngineHitEvidence[] { try { return z.array(engineHitEvidenceSchema).parse(JSON.parse(value)); } catch { return []; } }
function parseEngineHitHops(value: string): EngineHitHop[] { try { return z.array(engineHitHopSchema).parse(JSON.parse(value)); } catch { return []; } }
async function seedFirstEngineHit(ctx: Ctx): Promise<void> {
  const evidence: EngineHitEvidence[] = [
    { title: "Constellation and Amazon announce 20-year power purchase agreement", source: "Business Wire", url: "https://www.businesswire.com/news/home/20260930235521/en/Constellation-and-Amazon-Announce-20-Year-Power-Purchase-Agreement-Adding-190-Megawatts-of-Nuclear-Capacity-at-Calvert-Cliffs", supports: "The agreement covers 690 MW for 20 years, includes an approximately 190 MW uprate, and supports continued investment and relicensing at Calvert Cliffs." },
    { title: "Amid AI boom and aided by Amazon, Calvert Cliffs nuclear plant to be upgraded", source: "The Baltimore Banner", url: "https://www.thebanner.com/community/climate-environment/ai-amazon-calvert-cliffs-nuclear-KOJ5IMEN6JHX3JFNJOITQEBBJA/", supports: "Amazon scrapped the on-site data-center plan roughly two months earlier after local opposition that ousted three county commissioners, then entered the long-term power agreement." },
  ];
  const rippleChain: EngineHitHop[] = [
    { from: "AI and cloud power demand", to: "Amazon seeks durable regional supply", mechanism: "Amazon's long-term agreement is designed to support operations across the PJM market and manage regional energy costs.", kind: "verified", evidenceIndexes: [0] },
    { from: "Amazon demand", to: "690 MW, 20-year commitment", mechanism: "The signed agreement covers 690 MW for 20 years, including approximately 190 MW of new generating capacity.", kind: "verified", evidenceIndexes: [0] },
    { from: "Long-duration revenue", to: "Calvert Cliffs investment and uprate", mechanism: "Constellation says the commitment provides revenue certainty for more than $3 billion of investment, uprating, and a relicensing path.", kind: "verified", evidenceIndexes: [0] },
    { from: "Local data-center rejection", to: "Grid-delivered power deal survives", mechanism: "The separate campus plan was withdrawn after local blowback, but the later PPA keeps all plant output flowing through the PJM grid.", kind: "verified", evidenceIndexes: [0, 1] },
    { from: "Baseload contracted without the campus", to: "Uranium / AI-power thesis gains narrative evidence", mechanism: "Inference: the physical data-center site proved expendable while long-duration nuclear baseload remained strategically valuable; this supports the narrative thesis but does not establish a uranium-miner trade signal.", kind: "inference", evidenceIndexes: [0, 1] },
  ];
  await ctx.db<typeof schema>().insert(schema.engineHits).values({ hitKey: "2026-09-30-amazon-calvert-cliffs-ppa", hitAt: "2026-09-30", testCaseLabel: "FIRST LIVE RIPPLE-CHAIN TEST CASE", thesis: "uranium = leverage bet on AI power", triggerEvent: "Amazon signed a 20-year power purchase agreement with Constellation covering 690 MW from Calvert Cliffs, including an approximately 190 MW uprate.", engineScore: 12, confidenceTier: "low", tapeState: "Washed-out on the morning of 2026-10-01. CEG rose about 2.7% overnight on bullish retail sentiment, while uranium miners did not follow: CCJ slipped about 0.24% to roughly $86.67, well below its $134.09 January high.", twist: "Amazon had scrapped its Calvert Cliffs data-center plan roughly two months earlier after local blowback that ousted three county commissioners, then bought the power anyway for 20 years. The building was expendable; the baseload wasn't.", evidenceJson: JSON.stringify(evidence), rippleChainJson: JSON.stringify(rippleChain), createdAt: new Date("2026-09-30T12:00:00.000Z") }).onConflictDoNothing({ target: schema.engineHits.hitKey });
  ctx.invalidateQueries();
}
async function readEngineHits(ctx: Ctx, limit = 20, cursor: number | null | undefined = null): Promise<z.infer<typeof engineHitsResponse>> {
  const rows = await ctx.db<typeof schema>().select().from(schema.engineHits).orderBy(desc(schema.engineHits.hitAt), desc(schema.engineHits.id));
  const mapped = rows.map((row) => {
    const storedEvidence = parseEngineHitEvidence(row.evidenceJson);
    const retained = storedEvidence.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => sourceTier(item.url, `${item.title} ${item.supports}`) !== "LOW_TIER");
    const evidence = retained.map(({ item }) => item);
    const remappedIndexes = new Map(retained.map(({ originalIndex }, newIndex) => [originalIndex, newIndex]));
    const rippleChain = parseEngineHitHops(row.rippleChainJson).map((hop) => ({ ...hop, evidenceIndexes: hop.evidenceIndexes.flatMap((index) => { const remapped = remappedIndexes.get(index); return remapped == null ? [] : [remapped]; }) }));
    return { id: row.id, kind: row.kind, symbol: row.symbol, anomaly: row.anomaly, tags: asStringArray(row.tagsJson), evidenceStrength: row.evidenceStrength, hitAt: row.hitAt, testCaseLabel: row.testCaseLabel, thesis: row.thesis, triggerEvent: row.triggerEvent, engineScore: row.engineScore, confidenceTier: row.confidenceTier, tapeState: row.tapeState, twist: row.twist, evidence, lowTierEvidenceExcluded: storedEvidence.length - evidence.length, rippleChain, createdAt: row.createdAt.toISOString() };
  });
  const page = pageSlice(mapped, limit, cursor); return { hits: page.items, nextCursor: page.nextCursor };
}


const distributionMetricSchema = z.object({ label: z.string(), value: z.number().nullable(), percentile: z.number().nullable(), unit: z.string() });
const historicalContextResponse = z.object({
  symbol: z.string(), currency: z.string().nullable(), sourceUrl: z.string(), fetchedAt: z.string(), firstDate: z.string(), lastDate: z.string(), sessions: z.number(),
  basisNote: z.string(),
  distributions: z.array(distributionMetricSchema),
  timeframeLadder: z.array(z.object({ label: z.string(), sessions: z.number(), trend: z.enum(["up", "down", "flat", "unavailable"]), momentum: z.enum(["up", "down", "flat", "unavailable"]), volume: z.enum(["expanding", "contracting", "normal", "unavailable"]), votes: z.number(), detail: z.string() })),
  underwater: z.array(z.object({ date: z.string(), drawdownPct: z.number() })),
  drawdowns: z.array(z.object({ peakDate: z.string(), bottomDate: z.string(), recoveryDate: z.string().nullable(), depthPct: z.number(), declineSessions: z.number(), recoverySessions: z.number().nullable(), bottomRsi14: z.number().nullable(), bottomVsSma200Pct: z.number().nullable(), forward90dPct: z.number().nullable() })),
  analogs: z.array(z.object({ date: z.string(), distance: z.number(), rsi14: z.number().nullable(), volumePercentile: z.number().nullable(), volatilityPercentile: z.number().nullable(), forward90dPct: z.number().nullable() })),
  cycleYears: z.array(z.object({ year: z.number(), lowDate: z.string(), low: z.number(), highDate: z.string(), high: z.number(), yearReturnPct: z.number().nullable() })),
  cycleOverlay: z.object({ meaningful: z.boolean(), method: z.string(), sampleCount: z.number(), fitSessions: z.number(), horizonSessions: z.number(), similarityThreshold: z.number(), similarityZ: z.number().nullable(), topCorrelation: z.number().nullable(), divergence: z.enum(["none", "breaking", "insufficient"]), divergenceNote: z.string(), current: z.object({ startDate: z.string(), endDate: z.string(), values: z.array(z.number()) }), analogs: z.array(z.object({ startDate: z.string(), endDate: z.string(), correlation: z.number(), values: z.array(z.number()), postFitReturnPct: z.number() })) }),
});
type HistoricalContext = z.infer<typeof historicalContextResponse>;
function percentileRank(values: number[], current: number | null): number | null { if (current == null || !values.length) return null; return round(values.filter((value) => value <= current).length / values.length * 100, 1); }
function rollingRsiValues(points: Point[], period = 14): Array<number | null> {
  const output: Array<number | null> = Array(points.length).fill(null); if (points.length <= period) return output;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const current = points[i], previous = points[i - 1]; if (!current || !previous) continue; const delta = current.close - previous.close; gains += Math.max(delta, 0); losses += Math.max(-delta, 0); }
  let avgGain = gains / period, avgLoss = losses / period;
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < points.length; i++) { const current = points[i], previous = points[i - 1]; if (!current || !previous) continue; const delta = current.close - previous.close; avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period; output[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); }
  return output;
}
function rollingVolatility(points: Point[], period = 20): Array<number | null> {
  const output: Array<number | null> = Array(points.length).fill(null); const returns = points.map((point, index) => { const previous = points[index - 1]; return previous && previous.close > 0 && point.close > 0 ? Math.log(point.close / previous.close) : null; });
  for (let i = period; i < points.length; i++) { const sample = returns.slice(i - period + 1, i + 1).filter((value): value is number => value != null); if (sample.length !== period) continue; const mean = average(sample); if (mean == null) continue; const deviation = Math.sqrt(sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sample.length); output[i] = deviation * Math.sqrt(252) * 100; }
  return output;
}
function pearson(a: number[], b: number[]): number | null { if (a.length !== b.length || a.length < 3) return null; const am = average(a), bm = average(b); if (am == null || bm == null) return null; let top = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { const av = a[i], bv = b[i]; if (av == null || bv == null) return null; const ad = av - am, bd = bv - bm; top += ad * bd; aa += ad * ad; bb += bd * bd; } return aa > 0 && bb > 0 ? top / Math.sqrt(aa * bb) : null; }
function normalizedPath(rows: Point[], samples = 64): number[] { const base = rows[0]?.close; if (!base || rows.length < 2) return []; return Array.from({ length: samples }, (_, i) => { const index = Math.min(rows.length - 1, Math.round(i * (rows.length - 1) / (samples - 1))); return round((rows[index]?.close ?? base) / base * 100, 2); }); }
function cycleOverlay(points: Point[]): HistoricalContext["cycleOverlay"] { const horizon = 252, fit = 189; const currentRows = points.slice(-horizon); const empty = { meaningful: false, method: "Pearson correlation on the first 189 normalized daily adjusted closes of 252-session windows; candidates sampled every 21 sessions and ranked against the full pre-current history. Meaningful requires correlation ≥ 0.65 and ≥ 2 standard deviations above the candidate mean.", sampleCount: 0, fitSessions: fit, horizonSessions: horizon, similarityThreshold: .65, similarityZ: null, topCorrelation: null, divergence: "insufficient" as const, divergenceNote: "Not enough full-history windows for statistical pattern detection.", current: { startDate: currentRows[0]?.date ?? "", endDate: currentRows[currentRows.length - 1]?.date ?? "", values: normalizedPath(currentRows) }, analogs: [] };
  if (currentRows.length < horizon || points.length < horizon * 3) return empty; const currentFit = normalizedPath(currentRows.slice(0, fit), fit); const candidates: Array<{ start: number; correlation: number; rows: Point[] }> = []; const latestAllowed = points.length - horizon * 2; for (let start = 0; start <= latestAllowed; start += 21) { const rows = points.slice(start, start + horizon); const correlation = pearson(currentFit, normalizedPath(rows.slice(0, fit), fit)); if (correlation != null && Number.isFinite(correlation)) candidates.push({ start, correlation, rows }); } if (candidates.length < 20) return { ...empty, sampleCount: candidates.length, divergenceNote: `Only ${candidates.length} independent candidate windows were available; at least 20 are required.` }; const correlations = candidates.map((item) => item.correlation); const mean = average(correlations) ?? 0; const sd = Math.sqrt(correlations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / correlations.length); const sorted = [...candidates].sort((a,b)=>b.correlation-a.correlation); const selected: typeof candidates = []; for (const candidate of sorted) { if (selected.every((row)=>Math.abs(row.start-candidate.start)>=126)) selected.push(candidate); if (selected.length===3) break; } const top = selected[0]?.correlation ?? null; const similarityZ = top == null || sd === 0 ? null : (top - mean) / sd; const meaningful = top != null && top >= .65 && similarityZ != null && similarityZ >= 2 && selected.length >= 3; const currentPost = pct(currentRows[currentRows.length - 1]?.close ?? 0, currentRows[fit - 1]?.close ?? 0) ?? 0; const analogReturns = selected.map((item)=>pct(item.rows[item.rows.length-1]?.close ?? 0,item.rows[fit-1]?.close ?? 0) ?? 0); const median = [...analogReturns].sort((a,b)=>a-b)[Math.floor(analogReturns.length/2)] ?? 0; const retMean = average(analogReturns) ?? 0; const retSd = Math.sqrt(analogReturns.reduce((sum,value)=>sum+(value-retMean)**2,0)/(analogReturns.length||1)); const breaking = meaningful && (Math.sign(currentPost)!==Math.sign(median) || (retSd>0 && Math.abs(currentPost-median)>2*retSd)); return { ...empty, meaningful, sampleCount: candidates.length, similarityZ: finite(similarityZ), topCorrelation: finite(top), divergence: !meaningful ? "insufficient" : breaking ? "breaking" : "none", divergenceNote: !meaningful ? "No statistically meaningful recurring pattern was found; the overlay is withheld as a signal." : breaking ? `Current post-fit return ${round(currentPost)}% diverges from the analog median ${round(median)}%; the historical pattern is breaking.` : `Current post-fit return ${round(currentPost)}% remains within the selected analog range (median ${round(median)}%).`, analogs: selected.map((item)=>({ startDate:item.rows[0]?.date??"", endDate:item.rows[item.rows.length-1]?.date??"", correlation:round(item.correlation,3), values:normalizedPath(item.rows), postFitReturnPct:round(pct(item.rows[item.rows.length-1]?.close??0,item.rows[fit-1]?.close??0)??0) })) };
}

function fullHistoryContext(series: YahooSeries, fetchedAt: Date): HistoricalContext {
  const points = series.points; const last = points[points.length - 1]; const first = points[0]; if (!last || !first) throw new Error("Historical context requires at least one adjusted-close observation.");
  const rsiSeries = rollingRsiValues(points); const volSeries = rollingVolatility(points); const volumes = points.map((point) => point.volume).filter((value): value is number => value != null); const rsiValues = rsiSeries.filter((value): value is number => value != null); const volValues = volSeries.filter((value): value is number => value != null);
  const volumePercentiles = points.map((point) => percentileRank(volumes, point.volume)); const volPercentiles = volSeries.map((value) => percentileRank(volValues, value)); const currentRsi = rsiSeries[rsiSeries.length - 1] ?? null; const currentVol = volSeries[volSeries.length - 1] ?? null;
  const drawdowns: HistoricalContext["drawdowns"] = []; let peakIndex = 0; let active: { peakIndex: number; bottomIndex: number } | null = null;
  for (let i = 1; i < points.length; i++) { const point = points[i]; const peak = points[peakIndex]; if (!point || !peak) continue; if (!active && point.close >= peak.close) { peakIndex = i; continue; } const depth = (point.close / peak.close - 1) * 100; if (!active && depth <= -20) active = { peakIndex, bottomIndex: i }; if (active) { const bottom = points[active.bottomIndex]; const activePeak = points[active.peakIndex]; if (!bottom || !activePeak) continue; if (point.close < bottom.close) active.bottomIndex = i; if (point.close >= activePeak.close || i === points.length - 1) { const finalBottom = points[active.bottomIndex]; if (finalBottom) { const sma200 = average(points.slice(Math.max(0, active.bottomIndex - 199), active.bottomIndex + 1).map((row) => row.close)); drawdowns.push({ peakDate: activePeak.date, bottomDate: finalBottom.date, recoveryDate: point.close >= activePeak.close ? point.date : null, depthPct: round((finalBottom.close / activePeak.close - 1) * 100), declineSessions: active.bottomIndex - active.peakIndex, recoverySessions: point.close >= activePeak.close ? i - active.bottomIndex : null, bottomRsi14: finite(rsiSeries[active.bottomIndex]), bottomVsSma200Pct: sma200 ? round((finalBottom.close / sma200 - 1) * 100) : null, forward90dPct: finite(pct(points[active.bottomIndex + 90]?.close ?? finalBottom.close, finalBottom.close)) }); } active = null; if (point.close >= activePeak.close) peakIndex = i; }
    }
  }
  const windows = [{ label: "1d", sessions: 1 }, { label: "1w", sessions: 5 }, { label: "1m", sessions: 21 }, { label: "3m", sessions: 63 }, { label: "6m", sessions: 126 }, { label: "1y", sessions: 252 }, { label: "full history", sessions: points.length - 1 }];
  const timeframeLadder: HistoricalContext["timeframeLadder"] = windows.map(({ label, sessions }) => { const prior = points[Math.max(0, points.length - 1 - sessions)], recent = points.slice(Math.max(0, points.length - Math.max(20, Math.min(sessions, 63)))); if (!prior || !last) return { label, sessions, trend: "unavailable" as const, momentum: "unavailable" as const, volume: "unavailable" as const, votes: 0, detail: "Insufficient cached history." }; const change = pct(last.close, prior.close) ?? 0; const sma = average(recent.map((row)=>row.close)) ?? last.close; const trend = Math.abs(change)<.5 ? "flat" as const : change>0 ? "up" as const : "down" as const; const momentum = Math.abs(last.close/sma-1)<.005 ? "flat" as const : last.close>sma ? "up" as const : "down" as const; const volumeRows=recent.map((row)=>row.volume).filter((value):value is number=>value!=null), recentVolume=average(volumeRows.slice(-5)), baselineVolume=average(volumeRows); const volume = recentVolume==null||baselineVolume==null||baselineVolume===0 ? "unavailable" as const : recentVolume/baselineVolume>1.15 ? "expanding" as const : recentVolume/baselineVolume<.85 ? "contracting" as const : "normal" as const; const votes=(trend==="up"?1:trend==="down"?-1:0)+(momentum==="up"?1:momentum==="down"?-1:0)+(volume==="expanding"?Math.sign(change):0); return { label, sessions, trend, momentum, volume, votes, detail: `${round(change)}% adjusted-close return; last close ${last.close>sma?"above":"below"} ${recent.length}-session mean; recent volume ${volume}.` }; });
  let runningPeak=points[0]?.close??0; const underwaterAll=points.map((point)=>{runningPeak=Math.max(runningPeak,point.close);return {date:point.date,drawdownPct:round((point.close/runningPeak-1)*100,2)}}); const step=Math.max(1,Math.ceil(underwaterAll.length/256)); const underwater=underwaterAll.filter((_,index)=>index%step===0||index===underwaterAll.length-1);
  const currentFeatures: Array<number | null> = [currentRsi, volumePercentiles[volumePercentiles.length - 1] ?? null, volPercentiles[volPercentiles.length - 1] ?? null]; const analogCandidates = points.slice(0, -91).flatMap((point, index) => { const features: Array<number | null> = [rsiSeries[index] ?? null, volumePercentiles[index] ?? null, volPercentiles[index] ?? null]; if (features.some((value) => value == null) || currentFeatures.some((value) => value == null)) return []; const distance = Math.sqrt(features.map((value) => value ?? 0).reduce((sum: number, value: number, featureIndex: number) => sum + (value - (currentFeatures[featureIndex] ?? 0)) ** 2, 0)); const forward = points[index + 90]; return forward ? [{ date: point.date, distance: round(distance, 2), rsi14: finite(features[0]), volumePercentile: finite(features[1]), volatilityPercentile: finite(features[2]), forward90dPct: finite(pct(forward.close, point.close)) }] : []; });
  const analogs = analogCandidates.sort((a, b) => a.distance - b.distance).slice(0, 5); const byYear = new Map<number, Point[]>(); for (const point of points) { const year = Number(point.date.slice(0, 4)); if (Number.isFinite(year)) byYear.set(year, [...(byYear.get(year) ?? []), point]); }
  const availableYears = [...byYear.keys()]; const cycleTargets = [...new Set([2000, 2008, 2020, 2022, ...availableYears.slice(-3)])].filter((year) => byYear.has(year)); const cycleYears = cycleTargets.map((year) => { const rows = byYear.get(year) ?? []; const low = rows.reduce((best, point) => point.close < best.close ? point : best); const high = rows.reduce((best, point) => point.close > best.close ? point : best); return { year, lowDate: low.date, low: round(low.close), highDate: high.date, high: round(high.close), yearReturnPct: rows[0] && rows[rows.length - 1] ? finite(pct(rows[rows.length - 1]!.close, rows[0]!.close)) : null }; });
  return { symbol: series.meta.symbol ?? "", currency: series.meta.currency ?? null, sourceUrl: series.sourceUrl, fetchedAt: fetchedAt.toISOString(), firstDate: first.date, lastDate: last.date, sessions: points.length, basisNote: "Adjusted closes power every return, drawdown, analog, and cycle calculation. These are historical base rates, never predictions.", timeframeLadder, underwater, distributions: [{ label: "RSI 14", value: finite(currentRsi), percentile: percentileRank(rsiValues, currentRsi), unit: "" }, { label: "Daily volume", value: finite(last.volume), percentile: percentileRank(volumes, last.volume), unit: "shares/contracts" }, { label: "20d annualized volatility", value: finite(currentVol), percentile: percentileRank(volValues, currentVol), unit: "%" }], drawdowns: drawdowns.sort((a, b) => a.peakDate.localeCompare(b.peakDate)), analogs, cycleYears, cycleOverlay: cycleOverlay(points) };
}

const cycleClockResponse = z.object({ status: z.enum(["ok","unavailable"]), phase: z.enum(["expansion","slowdown","recession","recovery"]).nullable(), asOf: z.string().nullable(), missingSymbols: z.array(z.string()), chain: z.array(z.object({ input:z.string(), reading:z.string(), effect:z.string() })), ribbon: z.array(z.object({ date:z.string(), phase:z.enum(["expansion","slowdown","recession","recovery"]) })), note:z.string() });
const portfolioCorrelationResponse = z.object({ status:z.enum(["ok","unavailable"]), symbols:z.array(z.string()), sessions:z.number(), pairs:z.array(z.object({ a:z.string(), b:z.string(), correlation:z.number() })), warning:z.string(), missingSymbols:z.array(z.string()), method:z.string() });
async function cachedHistoryOnly(ctx:Ctx,symbol:string):Promise<YahooSeries|null>{const row=(await ctx.db<typeof schema>().select().from(schema.historicalCaches).where(eq(schema.historicalCaches.symbol,symbol)))[0];return row?parseCachedSeries(row.seriesJson,row.sourceUrl):null;}
function returnsByDate(series:YahooSeries){const out=new Map<string,number>();for(let i=1;i<series.points.length;i++){const row=series.points[i],prior=series.points[i-1];if(row&&prior&&prior.close>0)out.set(row.date,Math.log(row.close/prior.close));}return out;}
function ratioChange(a:YahooSeries,b:YahooSeries,date:string,lookback=63):number|null{const am=new Map(a.points.map(x=>[x.date,x.close])),bm=new Map(b.points.map(x=>[x.date,x.close]));const dates=[...am.keys()].filter(d=>d<=date&&bm.has(d)).sort();const end=dates[dates.length-1],start=dates[Math.max(0,dates.length-1-lookback)];if(!end||!start)return null;const e=(am.get(end)??0)/(bm.get(end)??1),v=(am.get(start)??0)/(bm.get(start)??1);return v?((e/v)-1)*100:null;}
async function cycleClockFromCache(ctx:Ctx):Promise<z.infer<typeof cycleClockResponse>>{const symbols=["^TNX","^FVX","TIP","IEF","HYG","LQD","SPY"];const loaded=await Promise.all(symbols.map(async symbol=>[symbol,await cachedHistoryOnly(ctx,symbol)] as const));const map=new Map(loaded);const missing=symbols.filter(symbol=>!map.get(symbol));if(missing.length)return {status:"unavailable",phase:null,asOf:null,missingSymbols:missing,chain:[],ribbon:[],note:"Cycle clock withheld: required macro-proxy histories are not already cached. This action performs no new market-data requests."};const tnx=map.get("^TNX"),fvx=map.get("^FVX"),tip=map.get("TIP"),ief=map.get("IEF"),hyg=map.get("HYG"),lqd=map.get("LQD"),spy=map.get("SPY");if(!tnx||!fvx||!tip||!ief||!hyg||!lqd||!spy)return {status:"unavailable",phase:null,asOf:null,missingSymbols:missing,chain:[],ribbon:[],note:"Cycle clock inputs are incomplete."};const completedSpy=completedDailyPoints(spy.points);const sampledDates=completedSpy.filter((_,i)=>i%21===0).slice(-23).map(x=>x.date);const latestCompletedDate=completedSpy.at(-1)?.date;const dates=[...new Set([...sampledDates,...(latestCompletedDate?[latestCompletedDate]:[])])].sort().slice(-24);const ribbon: Array<{date:string;phase:"expansion"|"slowdown"|"recession"|"recovery"}>=[];let latest:{credit:number;breakeven:number;curve:number;drawdown:number;date:string}|null=null;for(const date of dates){const credit=ratioChange(hyg,lqd,date),breakeven=ratioChange(tip,ief,date);const tv=tnx.points.filter(x=>x.date<=date).at(-1)?.close,fv=fvx.points.filter(x=>x.date<=date).at(-1)?.close;const spyRows=spy.points.filter(x=>x.date<=date).slice(-252),last=spyRows.at(-1)?.close,peak=Math.max(...spyRows.map(x=>x.close));if(credit==null||breakeven==null||tv==null||fv==null||last==null||!Number.isFinite(peak))continue;const curve=tv-fv,drawdown=(last/peak-1)*100,growth=credit+drawdown*.25,inflation=breakeven+curve*.1;const phase=growth>=0&&inflation>0?"expansion":growth<0&&inflation>0?"slowdown":growth<0?"recession":"recovery";ribbon.push({date,phase});latest={credit,breakeven,curve,drawdown,date};}if(!latest||!ribbon.length)return {status:"unavailable",phase:null,asOf:null,missingSymbols:[],chain:[],ribbon:[],note:"Cached proxy histories did not overlap enough to classify a regime."};return {status:"ok",phase:ribbon.at(-1)?.phase??null,asOf:latest.date,missingSymbols:[],chain:[{input:"HYG / LQD · 63 sessions",reading:`${round(latest.credit)}%`,effect:latest.credit>=0?"Credit appetite supports growth transmission.":"Credit risk appetite is tightening."},{input:"TIP / IEF · 63 sessions",reading:`${round(latest.breakeven)}%`,effect:latest.breakeven>=0?"Inflation-sensitive bonds lead nominal duration.":"Inflation impulse is cooling versus nominal duration."},{input:"10y − 5y proxy",reading:`${round(latest.curve)} points`,effect:latest.curve>=0?"Curve slope is positive.":"Curve slope is inverted."},{input:"SPY drawdown",reading:`${round(latest.drawdown)}%`,effect:latest.drawdown<=-10?"Equities confirm stress transmission.":"Equity drawdown has not crossed the 10% stress gate."}],ribbon,note:"Rule-based four-quadrant classifier from Yahoo proxy histories. The market brief refreshes these inputs once per day and falls back to the last valid cache if a source fails. It is a transmission map, not a forecast."};}
async function portfolioCorrelationFromCache(ctx:Ctx):Promise<z.infer<typeof portfolioCorrelationResponse>>{const db=ctx.db<typeof schema>();const [watch,signals]=await Promise.all([db.select().from(schema.watchlist),db.select().from(schema.trackedSignals)]);const symbols=[...new Set([...watch.map(x=>x.symbol),...signals.map(x=>x.symbol)])].slice(0,20);const loaded=await Promise.all(symbols.map(async symbol=>[symbol,await cachedHistoryOnly(ctx,symbol)] as const));const available=loaded.filter((row):row is readonly [string,YahooSeries]=>row[1]!=null);const missing=loaded.filter(row=>!row[1]).map(row=>row[0]);if(available.length<2)return {status:"unavailable",symbols:available.map(x=>x[0]),sessions:0,pairs:[],warning:"Correlation needs at least two cached watchlist or tracked-signal histories. No market-data request was made.",missingSymbols:missing,method:"Pearson correlation of aligned daily log returns over up to 252 sessions."};const maps=new Map(available.map(([symbol,series])=>[symbol,returnsByDate(series)]));const pairs=[] as Array<{a:string;b:string;correlation:number}>;let minSessions=Infinity;for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++){const a=available[i]?.[0],b=available[j]?.[0];if(!a||!b)continue;const am=maps.get(a),bm=maps.get(b);if(!am||!bm)continue;const dates=[...am.keys()].filter(d=>bm.has(d)).sort().slice(-252),av=dates.map(d=>am.get(d)??0),bv=dates.map(d=>bm.get(d)??0),corr=pearson(av,bv);if(corr!=null){pairs.push({a,b,correlation:round(corr,3)});minSessions=Math.min(minSessions,dates.length);}}pairs.sort((a,b)=>Math.abs(b.correlation)-Math.abs(a.correlation));const high=pairs.filter(x=>Math.abs(x.correlation)>=.75);const warning=high.length>=Math.max(1,Math.floor(pairs.length/3))?`${high.length} pair${high.length===1?"":"s"} exceed |0.75| correlation: the book may be one beta/factor bet wearing multiple ticker labels.`:"No broad one-bet concentration flag at the |0.75| threshold.";return {status:"ok",symbols:available.map(x=>x[0]),sessions:Number.isFinite(minSessions)?minSessions:0,pairs,warning,missingSymbols:missing,method:"Pearson correlation of aligned daily log returns over up to 252 sessions from existing full-history cache rows only."};}

type QuoteModule = Record<string, unknown>;
type QuoteSummaryPayload = { quoteSummary?: { result?: Array<Record<string, QuoteModule>>; error?: { description?: string } | null } };
function rawNumber(value: unknown): number | null { if (typeof value === "number") return finite(value); if (value && typeof value === "object" && "raw" in value) return finite(Number((value as { raw?: unknown }).raw)); return null; }
function rawText(value: unknown): string | null { if (typeof value === "string") return value; if (value && typeof value === "object" && "fmt" in value && typeof (value as { fmt?: unknown }).fmt === "string") return (value as { fmt: string }).fmt; return null; }
function moduleObject(root: Record<string, QuoteModule>, name: string): QuoteModule { const value = root[name]; return value && typeof value === "object" ? value : {}; }
const fundamentalSchema = z.object({ label: z.string(), value: z.number().nullable(), formatted: z.string(), unit: z.enum(["currency", "multiple", "percent", "shares", "date"]), currency: z.string().nullable(), inputs: z.string() });
const deepLensSchema = z.object({ name: z.string(), horizon: z.string(), verdict: z.enum(["supportive", "caution", "mixed", "unavailable"]), summary: z.string(), inputs: z.array(z.string()), sources: z.array(sourceSchema) });
const deepAnalysisResponse = z.object({ symbol: z.string(), currency: z.string().nullable(), asOf: z.string(), sourceUrl: z.string(), status: z.enum(["ok", "partial", "unavailable"]), note: z.string(), fundamentals: z.array(fundamentalSchema), lbo: z.object({ currentEvEbitda: z.number().nullable(), referenceMultiple: z.number().nullable(), enterpriseValue: z.number().nullable(), ebitda: z.number().nullable(), netDebt: z.number().nullable(), sharesOutstanding: z.number().nullable(), impliedEquityValue: z.number().nullable(), impliedPrice: z.number().nullable(), distancePct: z.number().nullable(), currency: z.string().nullable(), formula: z.string() }), lenses: z.array(deepLensSchema) });
async function deepAnalysis(ctx: Ctx, symbol: string, referenceMultiple: number | null): Promise<z.infer<typeof deepAnalysisResponse>> {
  const normalized = symbol.trim().toUpperCase(); const db = ctx.db<typeof schema>(); const sourceUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(normalized)}?modules=price%2CsummaryDetail%2CdefaultKeyStatistics%2CfinancialData%2CcalendarEvents%2CassetProfile`;
  const cachedRows = await db.select().from(schema.deepAnalysisCaches).where(eq(schema.deepAnalysisCaches.symbol, normalized)); const cached = cachedRows[0]; let payload: QuoteSummaryPayload | null = null; let fetchedAt = new Date();
  if (cached && Date.now() - cached.fetchedAt.getTime() < 6 * 3600000) { try { payload = JSON.parse(cached.payloadJson) as QuoteSummaryPayload; fetchedAt = cached.fetchedAt; } catch { payload = null; } }
  if (!payload) {
    try { const response = await pacedYahooFetch(sourceUrl); if (!response.ok) throw new Error(`HTTP ${response.status}`); payload = await response.json() as QuoteSummaryPayload; fetchedAt = new Date(); await db.insert(schema.deepAnalysisCaches).values({ symbol: normalized, currency: null, payloadJson: JSON.stringify(payload), sourceUrl, fetchedAt }).onConflictDoUpdate({ target: schema.deepAnalysisCaches.symbol, set: { payloadJson: JSON.stringify(payload), sourceUrl, fetchedAt } }); }
    catch (error) { return { symbol: normalized, currency: null, asOf: fetchedAt.toISOString(), sourceUrl, status: "unavailable", note: `Yahoo quoteSummary was unavailable (${String(error).replace(/^Error:\s*/, "")}). No fundamentals or LBO inputs were inferred.`, fundamentals: [], lbo: { currentEvEbitda: null, referenceMultiple, enterpriseValue: null, ebitda: null, netDebt: null, sharesOutstanding: null, impliedEquityValue: null, impliedPrice: null, distancePct: null, currency: null, formula: "Implied equity value = EBITDA × verified reference multiple − net debt; implied price = equity value ÷ shares outstanding." }, lenses: ["Fast-money positioning", "Buyout floor", "Structural flows", "State action", "Concentrated conviction"].map((name) => ({ name, horizon: name === "Fast-money positioning" ? "30–90d" : name === "Buyout floor" ? "3–5yr" : name === "State action" ? "multi-year" : "event-driven", verdict: "unavailable" as const, summary: "Required source data is unavailable; no verdict is inferred.", inputs: [], sources: [] })) }; }
  }
  const root = payload.quoteSummary?.result?.[0]; if (!root) return { symbol: normalized, currency: cached?.currency ?? null, asOf: fetchedAt.toISOString(), sourceUrl, status: "unavailable", note: payload.quoteSummary?.error?.description ?? "Yahoo quoteSummary returned no fundamentals. Fields remain unavailable.", fundamentals: [], lbo: { currentEvEbitda: null, referenceMultiple, enterpriseValue: null, ebitda: null, netDebt: null, sharesOutstanding: null, impliedEquityValue: null, impliedPrice: null, distancePct: null, currency: cached?.currency ?? null, formula: "Implied equity value = EBITDA × verified reference multiple − net debt; implied price = equity value ÷ shares outstanding." }, lenses: ["Fast-money positioning", "Buyout floor", "Structural flows", "State action", "Concentrated conviction"].map((name) => ({ name, horizon: "Unavailable", verdict: "unavailable" as const, summary: "Required source data is unavailable; no verdict is inferred.", inputs: [], sources: [] })) };
  const price = moduleObject(root, "price"), stats = moduleObject(root, "defaultKeyStatistics"), financial = moduleObject(root, "financialData"), calendar = moduleObject(root, "calendarEvents"); const currency = rawText(price.currency) ?? null; const currentPrice = rawNumber(price.regularMarketPrice); const enterpriseValue = rawNumber(stats.enterpriseValue); const ebitda = rawNumber(financial.ebitda); const currentEvEbitda = rawNumber(stats.enterpriseToEbitda) ?? (enterpriseValue != null && ebitda ? enterpriseValue / ebitda : null); const totalDebt = rawNumber(financial.totalDebt); const totalCash = rawNumber(financial.totalCash); const netDebt = totalDebt != null && totalCash != null ? totalDebt - totalCash : null; const shares = rawNumber(stats.sharesOutstanding); const impliedEquity = referenceMultiple != null && ebitda != null && netDebt != null ? ebitda * referenceMultiple - netDebt : null; const impliedPrice = impliedEquity != null && shares ? impliedEquity / shares : null; const distancePct = impliedPrice != null && currentPrice ? (impliedPrice / currentPrice - 1) * 100 : null; const shortFloat = rawNumber(stats.shortPercentOfFloat); const insiderHeld = rawNumber(stats.heldPercentInsiders); const institutionHeld = rawNumber(stats.heldPercentInstitutions); const earningsDate = rawText((calendar.earnings as Record<string, unknown> | undefined)?.earningsDate) ?? null;
  const fields: Array<{ label: string; value: number | null; unit: "currency" | "multiple" | "percent" | "shares" | "date"; input: string }> = [{ label: "Enterprise value", value: enterpriseValue, unit: "currency", input: "defaultKeyStatistics.enterpriseValue" }, { label: "EBITDA", value: ebitda, unit: "currency", input: "financialData.ebitda" }, { label: "EV / EBITDA", value: currentEvEbitda, unit: "multiple", input: "enterpriseValue ÷ EBITDA, or provider enterpriseToEbitda" }, { label: "Net debt", value: netDebt, unit: "currency", input: "totalDebt − totalCash" }, { label: "Shares outstanding", value: shares, unit: "shares", input: "defaultKeyStatistics.sharesOutstanding" }, { label: "Short % of float", value: shortFloat == null ? null : shortFloat * 100, unit: "percent", input: "defaultKeyStatistics.shortPercentOfFloat" }, { label: "Insider ownership", value: insiderHeld == null ? null : insiderHeld * 100, unit: "percent", input: "defaultKeyStatistics.heldPercentInsiders" }, { label: "Institutional ownership", value: institutionHeld == null ? null : institutionHeld * 100, unit: "percent", input: "defaultKeyStatistics.heldPercentInstitutions" }];
  const fundamentals = fields.map((field) => ({ label: field.label, value: finite(field.value), formatted: field.value == null ? "Unavailable" : field.unit === "currency" ? `${currency ?? "currency unavailable"} ${numText(field.value)}` : field.unit === "multiple" ? `${round(field.value)}×` : field.unit === "percent" ? `${round(field.value)}%` : numText(field.value), unit: field.unit, currency: field.unit === "currency" ? currency : null, inputs: field.input })); const sources = [{ title: `Yahoo Finance quoteSummary · ${normalized}`, url: sourceUrl }];
  const lenses: z.infer<typeof deepLensSchema>[] = [
    { name: "Fast-money positioning", horizon: "30–90d", verdict: shortFloat == null ? "unavailable" : shortFloat >= 0.12 ? "caution" : "mixed", summary: shortFloat == null ? "Short float is unavailable; ETF flows, COT and transactional congressional clusters are not inferred." : `Reported short interest is ${round(shortFloat * 100)}% of float. This alone does not identify direction or timing.`, inputs: shortFloat == null ? [] : [`shortPercentOfFloat = ${round(shortFloat * 100)}%`], sources },
    { name: "Buyout floor", horizon: "3–5yr", verdict: impliedPrice == null ? "unavailable" : distancePct != null && distancePct >= 0 ? "supportive" : "caution", summary: impliedPrice == null ? "LBO floor is unavailable until EV, EBITDA, net debt, shares, and a verified reference buyout multiple are all present." : `The mechanical floor is ${currency ?? "currency unavailable"} ${round(impliedPrice)} per share, ${round(distancePct ?? 0)}% from the current quote. It is scenario math, not a forecast.`, inputs: [`EV = ${enterpriseValue == null ? "unavailable" : numText(enterpriseValue)}`, `EBITDA = ${ebitda == null ? "unavailable" : numText(ebitda)}`, `net debt = ${netDebt == null ? "unavailable" : numText(netDebt)}`, `shares = ${shares == null ? "unavailable" : numText(shares)}`, `reference multiple = ${referenceMultiple == null ? "unavailable" : `${referenceMultiple}×`}`], sources },
    { name: "Structural flows", horizon: "scheduled / event-driven", verdict: earningsDate ? "mixed" : "unavailable", summary: earningsDate ? `Yahoo lists earnings timing as ${earningsDate}; index rebalances and ETF flows are not available in this source.` : "A verified earnings date, rebalancing date, and standardized flow series are unavailable.", inputs: earningsDate ? [`earningsDate = ${earningsDate}`] : [], sources: earningsDate ? sources : [] },
    { name: "State action", horizon: "multi-year", verdict: "unavailable", summary: "Export controls, subsidies, procurement and stockpile policy require primary-source policy evidence; quoteSummary does not provide it.", inputs: [], sources: [] },
    { name: "Concentrated conviction", horizon: "filing / multi-quarter", verdict: insiderHeld == null && institutionHeld == null ? "unavailable" : "mixed", summary: insiderHeld == null && institutionHeld == null ? "Insider and institutional ownership are unavailable; 13D and 13F changes are not inferred." : `Provider ownership fields show ${insiderHeld == null ? "unavailable" : `${round(insiderHeld * 100)}%`} insider and ${institutionHeld == null ? "unavailable" : `${round(institutionHeld * 100)}%`} institutional ownership. Point-in-time ownership is not the same as a new concentrated add.`, inputs: [`insider ownership = ${insiderHeld == null ? "unavailable" : `${round(insiderHeld * 100)}%`}`, `institutional ownership = ${institutionHeld == null ? "unavailable" : `${round(institutionHeld * 100)}%`}`], sources },
  ];
  await db.update(schema.deepAnalysisCaches).set({ currency }).where(eq(schema.deepAnalysisCaches.symbol, normalized));
  return { symbol: normalized, currency, asOf: fetchedAt.toISOString(), sourceUrl, status: fundamentals.some((field) => field.value != null) ? "ok" : "partial", note: "Fundamentals are fetched only by this on-demand action and cached for six hours. Missing fields remain visible as unavailable. No blended lens score is produced.", fundamentals, lbo: { currentEvEbitda: finite(currentEvEbitda), referenceMultiple, enterpriseValue, ebitda, netDebt, sharesOutstanding: shares, impliedEquityValue: finite(impliedEquity), impliedPrice: finite(impliedPrice), distancePct: finite(distancePct), currency, formula: "Implied equity value = EBITDA × verified reference multiple − net debt; implied price = implied equity value ÷ shares outstanding; distance = implied price ÷ current price − 1." }, lenses };
}

const keyedValuationFactSchema = z.object({
  key: z.string().min(1).max(80), label: z.string().min(1).max(120), value: z.number().nullable(), unit: z.string().min(1).max(40), period: z.string().min(1).max(80), provider: z.enum(["Finnhub", "Alpha Vantage"]), asOf: z.string().min(1).max(80),
});
const valuationCompetitorSchema = z.object({ name: z.string().min(1).max(160), symbol: z.string().max(30).nullable(), relationship: z.string().min(1).max(300), evidence: z.string().min(1).max(600), sourceLabel: z.string().min(1).max(160), sourceUrl: z.string().url().nullable(), asOf: z.string().min(1).max(80) });
const valuationClaimSchema = z.object({ section: z.enum(["revenue_quality", "standing", "edge", "adjustments"]), text: z.string().min(1).max(800), sourceLabel: z.string().min(1).max(160), sourceUrl: z.string().url().nullable(), asOf: z.string().min(1).max(80) });
const valuationPeerMetricSchema = z.object({ symbol: z.string().min(1).max(30), name: z.string().min(1).max(160), pe: z.number().nullable(), evEbitda: z.number().nullable(), ps: z.number().nullable(), fcfYieldPct: z.number().nullable(), asOf: z.string().min(1).max(80), provider: z.enum(["Finnhub", "Alpha Vantage"]), sourceUrl: z.string().url().nullable() });
const keyedValuationPayloadSchema = z.object({ facts: z.array(keyedValuationFactSchema).max(80), competitors: z.array(valuationCompetitorSchema).max(6), claims: z.array(valuationClaimSchema).max(16), peerMetrics: z.array(valuationPeerMetricSchema).max(6), notes: z.array(z.string().max(500)).max(12) });
const valuationSourceSchema = z.object({ id: z.string(), label: z.string(), asOf: z.string(), url: z.string().nullable() });
const valuationMetricViewSchema = z.object({ label: z.string(), value: z.string(), status: z.enum(["available", "missing"]), detail: z.string(), sourceIds: z.array(z.string()) });
const valuationSectionSchema = z.object({ number: z.number().int().min(1).max(8), key: z.string(), title: z.string(), verdict: z.enum(["cheap", "fair", "rich", "supportive", "caution", "mixed", "unavailable"]), summary: z.string(), metrics: z.array(valuationMetricViewSchema), evidence: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()) })) });
const stockValuationResponse = z.object({
  status: z.enum(["ok", "partial", "unavailable"]), symbol: z.string(), currency: z.string().nullable(), asOf: z.string(), note: z.string(), assumptions: z.array(z.string()), sources: z.array(valuationSourceSchema), sections: z.array(valuationSectionSchema).length(8),
  refresh: z.object({ state: z.enum(["not_needed", "queued", "running", "failed", "unavailable"]), taskId: z.string().nullable(), note: z.string() }),
});
type KeyedValuationPayload = z.infer<typeof keyedValuationPayloadSchema>;
type ValuationSource = z.infer<typeof valuationSourceSchema>;
type ValuationMetricView = z.infer<typeof valuationMetricViewSchema>;
type ValuationSection = z.infer<typeof valuationSectionSchema>;
function parseKeyedValuation(value: string | null): KeyedValuationPayload | null { try { return value ? keyedValuationPayloadSchema.parse(JSON.parse(value)) : null; } catch { return null; } }
function quoteStatementRows(root: Record<string, QuoteModule>, moduleName: string, key: string): QuoteModule[] { const mod = moduleObject(root, moduleName); const rows = mod[key]; return Array.isArray(rows) ? rows.filter((row): row is QuoteModule => Boolean(row && typeof row === "object")) : []; }
function median(values: Array<number | null>): number | null { const clean = values.filter((value): value is number => value != null && Number.isFinite(value)).sort((a,b)=>a-b); if (!clean.length) return null; const middle = Math.floor(clean.length / 2); const value = clean[middle]; if (value == null) return null; return clean.length % 2 ? value : ((clean[middle - 1] ?? value) + value) / 2; }
function reverseDcfGrowth(fcf: number | null, enterpriseValue: number | null): number | null { if (fcf == null || enterpriseValue == null || fcf <= 0 || enterpriseValue <= 0) return null; const discount = .10, terminal = .03; const valueAt = (growth: number) => { let pv = 0, next = fcf; for (let year = 1; year <= 5; year++) { next *= 1 + growth; pv += next / ((1 + discount) ** year); } const tv = next * (1 + terminal) / (discount - terminal); return pv + tv / ((1 + discount) ** 5); }; let low = -.5, high = 1.5; if (valueAt(low) > enterpriseValue || valueAt(high) < enterpriseValue) return null; for (let i = 0; i < 90; i++) { const mid = (low + high) / 2; if (valueAt(mid) < enterpriseValue) low = mid; else high = mid; } return (low + high) / 2 * 100; }
function valuationNumber(value: number | null, unit: "money"|"percent"|"multiple"|"shares"|"number", currency: string | null): string { if (value == null) return "Missing"; if (unit === "percent") return `${round(value, 2)}%`; if (unit === "multiple") return `${round(value, 2)}×`; if (unit === "money") return `${currency ?? "currency unavailable"} ${numText(value)}`; return numText(value); }
function valuationMetric(label: string, value: number | null, unit: "money"|"percent"|"multiple"|"shares"|"number", currency: string | null, detail: string, sourceIds: string[]): ValuationMetricView { return { label, value: valuationNumber(value, unit, currency), status: value == null ? "missing" : "available", detail: value == null ? `${detail} Missing from the available provider fields; not estimated.` : detail, sourceIds: value == null ? [] : sourceIds }; }
function firstFact(payload: KeyedValuationPayload | null, key: string): z.infer<typeof keyedValuationFactSchema> | null { return payload?.facts.find((fact) => fact.key === key && fact.value != null) ?? null; }
function factOrYahoo(payload: KeyedValuationPayload | null, key: string, yahoo: number | null): { value: number | null; ids: string[] } { const fact = firstFact(payload, key); return fact ? { value: fact.value, ids: [`K-${fact.provider.replace(/\s+/g, "-")}`] } : { value: yahoo, ids: yahoo == null ? [] : ["Y1"] }; }
type SecFactRow = { start?: string; end?: string; val?: number; accn?: string; fy?: number; fp?: string; form?: string; filed?: string; frame?: string };
type SecCompanyFacts = { entityName?: string; facts?: Record<string, Record<string, { units?: Record<string, SecFactRow[]> }>> };
function secFactRows(payload: SecCompanyFacts, taxonomy: string, tags: string[], units: string[]): SecFactRow[] { for (const tag of tags) { const fact=payload.facts?.[taxonomy]?.[tag]; if (!fact) continue; const rows=units.flatMap((unit)=>fact.units?.[unit]??[]).filter((row)=>typeof row.val==="number"&&Number.isFinite(row.val)); if (rows.length) return rows; } return []; }
function secAnnualRows(payload:SecCompanyFacts,taxonomy:string,tags:string[],units:string[]){const rows=secFactRows(payload,taxonomy,tags,units).filter((row)=>row.form==="10-K"&&row.fp==="FY"&&row.start&&row.end);const byEnd=new Map<string,SecFactRow>();for(const row of rows.sort((a,b)=>(b.filed??"").localeCompare(a.filed??""))){if(row.end&&!byEnd.has(row.end))byEnd.set(row.end,row);}return [...byEnd.values()].sort((a,b)=>(b.end??"").localeCompare(a.end??""));}
function secInstant(payload:SecCompanyFacts,taxonomy:string,tags:string[],units:string[]):SecFactRow|null{return secFactRows(payload,taxonomy,tags,units).filter((row)=>row.end&&(row.form==="10-K"||row.form==="10-Q")).sort((a,b)=>(b.end??"").localeCompare(a.end??"")||(b.filed??"").localeCompare(a.filed??""))[0]??null;}
async function secValuationRoot(symbol:string, preloadedSeries?: YahooSeries):Promise<{root:Record<string,QuoteModule>;sourceUrl:string;asOf:string}|null>{
  try{const tickers=await secJson<Record<string,{cik_str:number;ticker:string;title:string}>>("https://www.sec.gov/files/company_tickers.json");const match=Object.values(tickers).find((row)=>row.ticker.toUpperCase()===symbol);if(!match)return null;const cik=String(match.cik_str).padStart(10,"0");const sourceUrl=`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;const facts=await secJson<SecCompanyFacts>(sourceUrl);const chart=preloadedSeries ?? await yahooSeries(symbol,"5d").catch(()=>null);const revenue=secAnnualRows(facts,"us-gaap",["RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet"],["USD"]);const netIncome=secAnnualRows(facts,"us-gaap",["NetIncomeLoss","ProfitLoss"],["USD"]);const operatingIncome=secAnnualRows(facts,"us-gaap",["OperatingIncomeLoss"],["USD"]);const operatingCash=secAnnualRows(facts,"us-gaap",["NetCashProvidedByUsedInOperatingActivities"],["USD"]);const capex=secAnnualRows(facts,"us-gaap",["PaymentsToAcquirePropertyPlantAndEquipment"],["USD"]);const dividends=secAnnualRows(facts,"us-gaap",["PaymentsOfDividends","PaymentsOfDividendsCommonStock"],["USD"]);const buybacks=secAnnualRows(facts,"us-gaap",["PaymentsForRepurchaseOfCommonStock"],["USD"]);const sbc=secAnnualRows(facts,"us-gaap",["ShareBasedCompensation","AllocatedShareBasedCompensationExpense"],["USD"]);const eps=secAnnualRows(facts,"us-gaap",["EarningsPerShareDiluted"],["USD/shares"]);const dilutedShares=secAnnualRows(facts,"us-gaap",["WeightedAverageNumberOfDilutedSharesOutstanding"],["shares"]);const cash=secInstant(facts,"us-gaap",["CashAndCashEquivalentsAtCarryingValue","CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],["USD"]);const debtCurrent=secInstant(facts,"us-gaap",["LongTermDebtCurrent","ShortTermBorrowings"],["USD"]);const debtLong=secInstant(facts,"us-gaap",["LongTermDebtNoncurrent","LongTermDebt"],["USD"]);const entityShares=secInstant(facts,"dei",["EntityCommonStockSharesOutstanding"],["shares"]);const latestRevenue=revenue[0]?.val??null,priorRevenue=revenue[1]?.val??null,latestOp=operatingIncome[0]?.val??null,latestCfo=operatingCash[0]?.val??null,latestCapex=capex[0]?.val??null,fcf=latestCfo==null?null:latestCfo-(latestCapex??0),currentShares=entityShares?.val??dilutedShares[0]?.val??null,price=chart?.meta.regularMarketPrice??chart?.points.at(-1)?.close??null,currency=chart?.meta.currency??"USD",marketCap=price!=null&&currentShares!=null?price*currentShares:null,totalDebt=(debtCurrent?.val??0)+(debtLong?.val??0),totalCash=cash?.val??null,enterpriseValue=marketCap!=null?marketCap+totalDebt-(totalCash??0):null,trailingEps=eps[0]?.val??null;const incomeRows=[0,1].flatMap((index)=>{const rev=revenue[index]?.val,ni=netIncome[index]?.val,op=operatingIncome[index]?.val,shares=dilutedShares[index]?.val;if(rev==null&&ni==null&&op==null&&shares==null)return[];return[{totalRevenue:{raw:rev},netIncome:{raw:ni},operatingIncome:{raw:op},dilutedAverageShares:{raw:shares}}]});const cashRows=[{totalCashFromOperatingActivities:{raw:latestCfo},capitalExpenditures:{raw:latestCapex},cashDividendsPaid:{raw:dividends[0]?.val},repurchaseOfCapitalStock:{raw:buybacks[0]?.val},stockBasedCompensation:{raw:sbc[0]?.val}}];const root:Record<string,QuoteModule>={price:{currency,regularMarketPrice:{raw:price},marketCap:{raw:marketCap}},summaryDetail:{marketCap:{raw:marketCap},trailingPE:{raw:price!=null&&trailingEps?price/trailingEps:null},priceToSalesTrailing12Months:{raw:marketCap!=null&&latestRevenue?marketCap/latestRevenue:null}},defaultKeyStatistics:{enterpriseValue:{raw:enterpriseValue},trailingEps:{raw:trailingEps},sharesOutstanding:{raw:currentShares}},financialData:{totalRevenue:{raw:latestRevenue},revenueGrowth:{raw:latestRevenue!=null&&priorRevenue?latestRevenue/priorRevenue-1:null},freeCashflow:{raw:fcf},operatingMargins:{raw:latestOp!=null&&latestRevenue?latestOp/latestRevenue:null},totalCash:{raw:totalCash},totalDebt:{raw:totalDebt},operatingCashflow:{raw:latestCfo}},assetProfile:{},incomeStatementHistory:{incomeStatementHistory:incomeRows},cashflowStatementHistory:{cashflowStatements:cashRows}};const asOf=[revenue[0]?.filed,cash?.filed,entityShares?.filed,chart?.points.at(-1)?.date].filter((value):value is string=>Boolean(value)).sort().at(-1)??new Date().toISOString();return{root,sourceUrl,asOf};}catch{return null;}
}
async function stockValuation(ctx: Ctx, symbol: string, preloaded?: { series: YahooSeries }): Promise<z.infer<typeof stockValuationResponse>> {
  const normalized = symbol.trim().toUpperCase(); const db = ctx.db<typeof schema>(); const now = new Date();
  const sourceUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(normalized)}?modules=price%2CsummaryDetail%2CdefaultKeyStatistics%2CfinancialData%2CassetProfile%2CincomeStatementHistory%2CincomeStatementHistoryQuarterly%2CcashflowStatementHistory%2CcashflowStatementHistoryQuarterly%2CbalanceSheetHistory`;
  let row = (await db.select().from(schema.equityValuationSnapshots).where(eq(schema.equityValuationSnapshots.symbol, normalized)))[0]; let payload: QuoteSummaryPayload | null = null; let yahooFetchedAt = row?.yahooFetchedAt ?? null;
  if (row?.yahooFetchedAt && Date.now() - row.yahooFetchedAt.getTime() < 6 * 3600000) { try { payload = JSON.parse(row.yahooPayloadJson) as QuoteSummaryPayload; } catch { payload = null; } }
  let usedSecChartLayer = false;
  if (!payload && preloaded?.series) {
    const fallback = await secValuationRoot(normalized, preloaded.series);
    if (fallback) {
      payload = { quoteSummary: { result: [fallback.root] } };
      usedSecChartLayer = true;
      yahooFetchedAt = now;
      const values = { yahooPayloadJson: JSON.stringify(payload), yahooSourceUrl: fallback.sourceUrl, yahooFetchedAt, updatedAt: now };
      if (row) await db.update(schema.equityValuationSnapshots).set(values).where(eq(schema.equityValuationSnapshots.id, row.id)); else await db.insert(schema.equityValuationSnapshots).values({ symbol: normalized, ...values });
      row = (await db.select().from(schema.equityValuationSnapshots).where(eq(schema.equityValuationSnapshots.symbol, normalized)))[0];
    }
  }
  if (!payload) { try { const response = await pacedYahooFetch(sourceUrl); if (!response.ok) throw new Error(`HTTP ${response.status}`); payload = await response.json() as QuoteSummaryPayload; yahooFetchedAt = now; const values = { yahooPayloadJson: JSON.stringify(payload), yahooSourceUrl: sourceUrl, yahooFetchedAt, updatedAt: now }; if (row) await db.update(schema.equityValuationSnapshots).set(values).where(eq(schema.equityValuationSnapshots.id, row.id)); else await db.insert(schema.equityValuationSnapshots).values({ symbol: normalized, ...values }); row = (await db.select().from(schema.equityValuationSnapshots).where(eq(schema.equityValuationSnapshots.symbol, normalized)))[0]; } catch { payload = null; } }
  let root = payload?.quoteSummary?.result?.[0]; let freeLabel=usedSecChartLayer?`SEC Companyfacts + reused Yahoo chart · ${normalized}`:`Yahoo Finance quoteSummary · ${normalized}`; let freeUrl=row?.yahooSourceUrl??sourceUrl; let freeAsOf=yahooFetchedAt?.toISOString()??now.toISOString();
  if(!root){const fallback=await secValuationRoot(normalized, preloaded?.series);if(fallback){root=fallback.root;freeLabel=`SEC Companyfacts + ${preloaded?.series?"reused ":""}Yahoo chart free layer · ${normalized}`;freeUrl=fallback.sourceUrl;freeAsOf=fallback.asOf;yahooFetchedAt=new Date(Number.isFinite(Date.parse(fallback.asOf))?Date.parse(fallback.asOf):Date.now());}}
  const keyed = parseKeyedValuation(row?.keyedPayloadJson ?? null); const sources: ValuationSource[] = [];
  if (root) sources.push({ id: "Y1", label: freeLabel, asOf: freeAsOf, url: freeUrl });
  if (keyed) { for (const provider of ["Finnhub", "Alpha Vantage"] as const) { const providerRows = keyed.facts.filter((fact) => fact.provider === provider); if (providerRows.length) sources.push({ id: `K-${provider.replace(/\s+/g, "-")}`, label: `${provider} on-demand fundamentals`, asOf: providerRows.map((fact)=>fact.asOf).sort().at(-1) ?? row?.keyedAsOf ?? "date unavailable", url: null }); } }
  if (keyed) { const extra = [...keyed.competitors.map((item)=>({label:item.sourceLabel,url:item.sourceUrl,asOf:item.asOf})), ...keyed.claims.map((item)=>({label:item.sourceLabel,url:item.sourceUrl,asOf:item.asOf}))]; for (const item of extra) { const id = `E${sources.length + 1}`; if (!sources.some((source)=>source.label===item.label&&source.url===item.url)) sources.push({ id, label:item.label, asOf:item.asOf, url:item.url }); } }
  const sourceIdFor = (label:string,url:string|null) => sources.find((source)=>source.label===label&&source.url===url)?.id;
  let refreshState: "not_needed"|"queued"|"running"|"failed"|"unavailable" = "not_needed"; let taskId: string | null = row?.taskId ?? null; let refreshNote = "Finnhub and Alpha Vantage snapshot is current for this on-demand valuation.";
  const keyedFresh = row?.keyedAsOf && Number.isFinite(Date.parse(row.keyedAsOf)) && Date.now() - Date.parse(row.keyedAsOf) < 24 * 3600000;
  if (!keyedFresh) {
    try { const started = await ctx.agent.spawnTask(`Research an equity valuation snapshot for listed ticker ${normalized}. This request was explicitly triggered by the user in the terminal. Use the connected Finnhub and Alpha Vantage skills now, and only now, for company profile/basic metrics plus annual and quarterly income-statement, balance-sheet and cash-flow facts. Also use public web research to identify up to four NAMED operating competitors and source-backed evidence for revenue quality/segment mix, moat or market standing, competitive edge, and cyclicality/accounting/regulatory/key-man/customer-concentration adjustments. Never invent a value. Every numeric fact needs provider and as-of/period. Return these canonical fact keys when available: revenueTtm, revenueGrowthPct, epsTtm, freeCashFlowTtm, operatingMarginPct, operatingMarginPriorPct, cash, debt, sharesCurrent, sharesPrior, dividendsTtm, buybacksTtm, stockCompTtm, netIncomeTtm, pe, evEbitda, ps, peg. Include current peer multiples only for competitors directly supported by evidence. Do not include an API key, credential, surrogate, or authenticated query string in any sourceUrl; API-backed facts may use a null sourceUrl.`, { expectsAction: "saveValuationFundamentals", dedupeKey: `valuestock:${normalized}:${now.toISOString().slice(0,10)}` }); if (started.ok) { taskId = started.taskId; refreshState = "queued"; refreshNote = "On-demand Finnhub + Alpha Vantage enrichment is queued. This block already shows the free layer; rerun after the refresh completes for the keyed cross-check and sourced competitor evidence."; if (row) await db.update(schema.equityValuationSnapshots).set({ taskId, updatedAt: now }).where(eq(schema.equityValuationSnapshots.id, row.id)); } else { refreshState = "failed"; refreshNote = "The on-demand keyed enrichment could not start; the free layer and explicit gaps remain visible."; }
    } catch { refreshState = "unavailable"; refreshNote = "The on-demand research worker is unavailable in this environment; the free layer and explicit gaps remain visible."; }
  }
  if (!root) {
    const unavailable = (number:number,key:string,title:string):ValuationSection => ({ number,key,title,verdict:"unavailable",summary:"Required fundamentals were unavailable; no valuation claim was inferred.",metrics:[],evidence:[] });
    return { status:"unavailable", symbol:normalized, currency:null, asOf:now.toISOString(), note:"Yahoo quoteSummary returned no usable fundamentals. Missing values are not estimated.", assumptions:["No price target is produced.","Reverse DCF uses a 10% discount rate, 3% terminal growth and a five-year explicit period only when positive free cash flow and enterprise value are both available."], sources, sections:[unavailable(1,"revenue_quality","Revenue quality"),unavailable(2,"accrual","Accrual to shareholders"),unavailable(3,"supply","Share-count supply"),unavailable(4,"multiples","Multiples + reverse DCF"),unavailable(5,"standing","Standing"),unavailable(6,"edge","Edge vs named competitors"),unavailable(7,"adjustments","Adjustments"),unavailable(8,"verdict","Verdict")], refresh:{state:refreshState,taskId,note:refreshNote} };
  }
  const price = moduleObject(root,"price"), summary = moduleObject(root,"summaryDetail"), stats = moduleObject(root,"defaultKeyStatistics"), financial = moduleObject(root,"financialData"), profile = moduleObject(root,"assetProfile"); const currency = rawText(price.currency); const marketCap = rawNumber(price.marketCap) ?? rawNumber(summary.marketCap); const enterpriseValue = rawNumber(stats.enterpriseValue); const yahooRevenue = rawNumber(financial.totalRevenue); const yahooRevenueGrowth = rawNumber(financial.revenueGrowth); const yahooFcf = rawNumber(financial.freeCashflow); const yahooOpMargin = rawNumber(financial.operatingMargins); const yahooCash = rawNumber(financial.totalCash); const yahooDebt = rawNumber(financial.totalDebt); const yahooEps = rawNumber(stats.trailingEps); const yahooShares = rawNumber(stats.sharesOutstanding); const yahooPe = rawNumber(summary.trailingPE) ?? rawNumber(stats.trailingPE); const yahooEvEbitda = rawNumber(stats.enterpriseToEbitda); const yahooPs = rawNumber(summary.priceToSalesTrailing12Months); const yahooPeg = rawNumber(stats.pegRatio); const annualIncome = quoteStatementRows(root,"incomeStatementHistory","incomeStatementHistory"); const annualCash = quoteStatementRows(root,"cashflowStatementHistory","cashflowStatements"); const latestIncome = annualIncome[0] ?? {}, priorIncome = annualIncome[1] ?? {}, latestCash = annualCash[0] ?? {}; const annualShares = rawNumber(latestIncome.dilutedAverageShares); const priorShares = rawNumber(priorIncome.dilutedAverageShares); const annualOpMargin = (()=>{const op=rawNumber(latestIncome.operatingIncome),rev=rawNumber(latestIncome.totalRevenue);return op!=null&&rev?op/rev:null})(); const priorOpMargin = (()=>{const op=rawNumber(priorIncome.operatingIncome),rev=rawNumber(priorIncome.totalRevenue);return op!=null&&rev?op/rev:null})(); const annualDividends = rawNumber(latestCash.cashDividendsPaid); const annualBuybacks = rawNumber(latestCash.repurchaseOfCapitalStock); const annualSbc = rawNumber(latestCash.stockBasedCompensation); const annualNetIncome = rawNumber(latestIncome.netIncome);
  const baseOpMargin=yahooOpMargin??annualOpMargin; const revenue = factOrYahoo(keyed,"revenueTtm",yahooRevenue); const revenueGrowth = factOrYahoo(keyed,"revenueGrowthPct",yahooRevenueGrowth == null ? null : yahooRevenueGrowth*100); const eps = factOrYahoo(keyed,"epsTtm",yahooEps); const fcf = factOrYahoo(keyed,"freeCashFlowTtm",yahooFcf); const opMargin = factOrYahoo(keyed,"operatingMarginPct",baseOpMargin==null?null:baseOpMargin*100); const priorMargin = factOrYahoo(keyed,"operatingMarginPriorPct",priorOpMargin==null?null:priorOpMargin*100); const cash = factOrYahoo(keyed,"cash",yahooCash); const debt = factOrYahoo(keyed,"debt",yahooDebt); const sharesCurrent = factOrYahoo(keyed,"sharesCurrent",yahooShares ?? annualShares); const sharesPrior = factOrYahoo(keyed,"sharesPrior",priorShares); const dividends = factOrYahoo(keyed,"dividendsTtm",annualDividends==null?null:Math.abs(annualDividends)); const buybacks = factOrYahoo(keyed,"buybacksTtm",annualBuybacks==null?null:Math.abs(annualBuybacks)); const stockComp = factOrYahoo(keyed,"stockCompTtm",annualSbc); const netIncome = factOrYahoo(keyed,"netIncomeTtm",annualNetIncome); const pe = factOrYahoo(keyed,"pe",yahooPe); const evEbitda = factOrYahoo(keyed,"evEbitda",yahooEvEbitda); const ps = factOrYahoo(keyed,"ps",yahooPs); const peg = factOrYahoo(keyed,"peg",yahooPeg); const fcfYield = fcf.value!=null&&marketCap?fcf.value/marketCap*100:null; const shareTrend = sharesCurrent.value!=null&&sharesPrior.value?((sharesCurrent.value/sharesPrior.value)-1)*100:null; const impliedGrowth = reverseDcfGrowth(fcf.value,enterpriseValue); const netDebt = debt.value!=null&&cash.value!=null?debt.value-cash.value:null; const cashConversion = fcf.value!=null&&netIncome.value!=null&&netIncome.value!==0?fcf.value/netIncome.value*100:null; const peerPe=median(keyed?.peerMetrics.map((item)=>item.pe)??[]),peerEv=median(keyed?.peerMetrics.map((item)=>item.evEbitda)??[]),peerPs=median(keyed?.peerMetrics.map((item)=>item.ps)??[]),peerFcf=median(keyed?.peerMetrics.map((item)=>item.fcfYieldPct)??[]);
  const claimEvidence = (section:z.infer<typeof valuationClaimSchema>["section"]) => (keyed?.claims.filter((claim)=>claim.section===section)??[]).map((claim)=>({text:claim.text,sourceIds:[sourceIdFor(claim.sourceLabel,claim.sourceUrl)].filter((id):id is string=>Boolean(id))}));
  const competitorEvidence = (keyed?.competitors??[]).map((item)=>({text:`${item.name}${item.symbol?` (${item.symbol})`:""}: ${item.relationship} ${item.evidence}`,sourceIds:[sourceIdFor(item.sourceLabel,item.sourceUrl)].filter((id):id is string=>Boolean(id))}));
  const peerRows=(keyed?.peerMetrics??[]).map((item)=>({text:`${item.name} (${item.symbol}) · P/E ${valuationNumber(item.pe,"multiple",currency)}, EV/EBITDA ${valuationNumber(item.evEbitda,"multiple",currency)}, P/S ${valuationNumber(item.ps,"multiple",currency)}, FCF yield ${valuationNumber(item.fcfYieldPct,"percent",currency)} · ${item.provider} as of ${item.asOf}`,sourceIds:[]}));
  const richSignals = [pe.value!=null&&peerPe!=null&&pe.value>peerPe*1.25,evEbitda.value!=null&&peerEv!=null&&evEbitda.value>peerEv*1.25,ps.value!=null&&peerPs!=null&&ps.value>peerPs*1.25,fcfYield!=null&&peerFcf!=null&&fcfYield<peerFcf*.75,impliedGrowth!=null&&revenueGrowth.value!=null&&impliedGrowth>revenueGrowth.value+8].filter(Boolean).length; const cheapSignals=[pe.value!=null&&peerPe!=null&&pe.value<peerPe*.75,evEbitda.value!=null&&peerEv!=null&&evEbitda.value<peerEv*.75,ps.value!=null&&peerPs!=null&&ps.value<peerPs*.75,fcfYield!=null&&peerFcf!=null&&fcfYield>peerFcf*1.25,impliedGrowth!=null&&revenueGrowth.value!=null&&impliedGrowth<revenueGrowth.value-8].filter(Boolean).length; const verdict: "cheap"|"fair"|"rich"|"unavailable" = richSignals>=2?"rich":cheapSignals>=2?"cheap":richSignals+cheapSignals>0?"fair":"unavailable"; const sector=rawText(profile.sector),industry=rawText(profile.industry);
  const sections: ValuationSection[] = [
    {number:1,key:"revenue_quality",title:"Revenue quality",verdict:revenue.value==null?"unavailable":revenueGrowth.value!=null&&revenueGrowth.value>0?"supportive":"mixed",summary:claimEvidence("revenue_quality")[0]?.text??"Recurring mix, segment durability and one-time revenue treatment need sourced filing evidence; they are not inferred from a growth rate alone.",metrics:[valuationMetric("Revenue · TTM",revenue.value,"money",currency,"Trailing revenue.",revenue.ids),valuationMetric("Revenue growth",revenueGrowth.value,"percent",currency,"Provider-reported period-over-period growth.",revenueGrowth.ids),valuationMetric("Operating margin",opMargin.value,"percent",currency,"Current operating margin.",opMargin.ids),valuationMetric("Prior operating margin",priorMargin.value,"percent",currency,"Prior comparable operating margin; used only when the provider supplies a comparable period.",priorMargin.ids)],evidence:claimEvidence("revenue_quality")},
    {number:2,key:"accrual",title:"Accrual to shareholders",verdict:buybacks.value!=null||dividends.value!=null?"mixed":"unavailable",summary:"Cash distributions and retained earnings are shown separately. Stock-based compensation is surfaced as a transfer that can offset buybacks; ROIC is not claimed unless sourced.",metrics:[valuationMetric("Dividends · latest period",dividends.value,"money",currency,"Cash dividends paid.",dividends.ids),valuationMetric("Gross buybacks · latest period",buybacks.value,"money",currency,"Repurchases of capital stock; gross repurchases are not net share shrink.",buybacks.ids),valuationMetric("Stock compensation · latest period",stockComp.value,"money",currency,"Stock-based compensation, a potential offset to repurchases.",stockComp.ids),valuationMetric("Net income · latest period",netIncome.value,"money",currency,"Net income available for distribution or reinvestment.",netIncome.ids)],evidence:[]},
    {number:3,key:"supply",title:"Share-count supply",verdict:shareTrend==null?"unavailable":shareTrend<0?"supportive":shareTrend>0?"caution":"mixed",summary:shareTrend==null?"A comparable prior-period diluted share count is missing, so dilution or shrinkage is not inferred.":shareTrend<0?"Comparable diluted shares declined; the float signal is shrinking before any qualitative adjustment.":shareTrend>0?"Comparable diluted shares increased. Treat buyback headlines cautiously until net dilution is reconciled.":"Comparable diluted shares were broadly unchanged.",metrics:[valuationMetric("Diluted shares · current",sharesCurrent.value,"shares",currency,"Current/provider share count.",sharesCurrent.ids),valuationMetric("Diluted shares · prior",sharesPrior.value,"shares",currency,"Prior comparable share count.",sharesPrior.ids),valuationMetric("Share-count change",shareTrend,"percent",currency,"(current ÷ prior − 1) × 100.",[...new Set([...sharesCurrent.ids,...sharesPrior.ids])])],evidence:[]},
    {number:4,key:"multiples",title:"Multiples + reverse DCF",verdict:verdict,summary:"Current multiples are compared with sourced named peers when available. Company-history multiples remain missing unless a provider supplies a comparable series. Reverse DCF solves the constant five-year FCF growth implied by enterprise value under the stated assumptions.",metrics:[valuationMetric("P/E · trailing",pe.value,"multiple",currency,"Trailing price/earnings.",pe.ids),valuationMetric("EV / EBITDA",evEbitda.value,"multiple",currency,"Enterprise value divided by EBITDA.",evEbitda.ids),valuationMetric("Price / sales",ps.value,"multiple",currency,"Trailing price-to-sales.",ps.ids),valuationMetric("FCF yield",fcfYield,"percent",currency,"TTM free cash flow ÷ current market capitalization.",[...new Set([...fcf.ids,"Y1"])]),valuationMetric("PEG",peg.value,"multiple",currency,"Provider PEG ratio.",peg.ids),valuationMetric("Peer median P/E",peerPe,"multiple",currency,"Median across sourced named peers.",[]),valuationMetric("Own-history multiple",null,"multiple",currency,"A comparable historical multiple series is not available in the current providers.",[]),valuationMetric("Reverse-DCF implied FCF growth",impliedGrowth,"percent",currency,"Five-year constant FCF growth solving PV = current enterprise value at 10% discount rate and 3% terminal growth.",[...new Set([...fcf.ids,"Y1"])])],evidence:peerRows},
    {number:5,key:"standing",title:"Standing",verdict:claimEvidence("standing").length?"mixed":"unavailable",summary:sector||industry?`${sector??"Sector unavailable"} · ${industry??"industry unavailable"}. Market share and moat are reported only when a source establishes them.`:"Sector, market share and moat evidence are unavailable.",metrics:[],evidence:claimEvidence("standing")},
    {number:6,key:"edge",title:"Edge vs named competitors",verdict:competitorEvidence.length||claimEvidence("edge").length?"mixed":"unavailable",summary:competitorEvidence.length?"Named competitors and claimed edges are evidence-linked below; no generic peer is invented.":"No source-backed named competitor relationship has completed yet.",metrics:[],evidence:[...competitorEvidence,...claimEvidence("edge")]},
    {number:7,key:"adjustments",title:"Adjustments",verdict:claimEvidence("adjustments").length||cashConversion!=null||netDebt!=null?"mixed":"unavailable",summary:"Cyclicality, accounting quality and concentrated overhangs can change what a headline multiple means. Cash conversion and net debt are mechanical checks; other claims require sourced evidence.",metrics:[valuationMetric("FCF / net income",cashConversion,"percent",currency,"Free cash flow ÷ net income; negative or unusually high ratios need statement-level review.",[...new Set([...fcf.ids,...netIncome.ids])]),valuationMetric("Net debt",netDebt,"money",currency,"Total debt − cash.",[...new Set([...debt.ids,...cash.ids])])],evidence:claimEvidence("adjustments")},
    {number:8,key:"verdict",title:"Verdict",verdict,summary:verdict==="unavailable"?"FAIR / RICH / CHEAP is withheld: there are not enough independent peer or reverse-DCF comparisons. No price target is produced.":`${verdict.toUpperCase()} on the available math: ${richSignals} rich flag${richSignals===1?"":"s"}, ${cheapSignals} cheap flag${cheapSignals===1?"":"s"}. A label requires at least two same-direction flags; otherwise the result is fair. This is not a price target.`,metrics:[valuationMetric("Revenue · TTM",revenue.value,"money",currency,"Used as a business-scale check, not a target.",revenue.ids),valuationMetric("EPS · TTM",eps.value,"number",currency,"Trailing earnings per share.",eps.ids),valuationMetric("Free cash flow · TTM",fcf.value,"money",currency,"Cash basis for yield and reverse DCF.",fcf.ids),valuationMetric("Cash",cash.value,"money",currency,"Balance-sheet cash.",cash.ids),valuationMetric("Debt",debt.value,"money",currency,"Balance-sheet debt.",debt.ids)],evidence:[]},
  ];
  const available=sections.flatMap((section)=>section.metrics).filter((metric)=>metric.status==="available").length; const missing=sections.flatMap((section)=>section.metrics).filter((metric)=>metric.status==="missing").length; return {status:available?missing||!keyed?"partial":"ok":"unavailable",symbol:normalized,currency,asOf:yahooFetchedAt?.toISOString()??now.toISOString(),note:`${available} numeric fields available; ${missing} explicitly missing. Keyed and qualitative enrichment is ${keyedFresh?"current":"requested only by this valuation action"}.`,assumptions:["No price target is produced.","Reverse DCF: 10% discount rate, 3% terminal growth, five-year explicit period, constant free-cash-flow growth.","Rich/cheap flags use a 25% peer-multiple or FCF-yield gap and an 8 percentage-point implied-growth gap. At least two same-direction flags are required; otherwise fair or unavailable.","Gross buybacks do not equal net value accrual when stock compensation or issuance offsets them."],sources,sections,refresh:{state:refreshState,taskId,note:refreshNote}};
}

const interimSnapshotShape = z.object({ id: z.number(), capturedDay: z.string(), capturedAt: z.string(), currentPrice: z.number(), returnPct: z.number(), distanceTarget1Pct: z.number(), distanceInvalidationPct: z.number(), daysSinceEntry: z.number().int().nonnegative() });
const dailyBriefShape = z.object({ id: z.number(), capturedDay: z.string(), summary: z.string(), trackedCount: z.number(), approachingTargetCount: z.number(), approachingInvalidationCount: z.number(), sourceAsOf: z.string(), createdAt: z.string() });
const trackerEvaluationShape = z.object({ cohortKey: z.string(), verdict: z.enum(["HIT", "MISS", "AMBIGUOUS", "UNVERIFIED", "TIME_EXIT", "OPEN"]), reason: z.string(), grossReturnPct: z.number().nullable(), modeledNetReturnPct: z.number().nullable(), costStatus: z.enum(["unknown", "modeled", "measured"]), evaluatorVersion: z.string(), product: z.enum(["direction_forecast", "trade_setup"]), horizon: z.number(), horizonUnit: z.string() }).nullable();
const trackerSignalShape = z.object({ id: z.number(), symbol: z.string(), name: z.string(), setupType: z.string(), direction: z.enum(["long", "short"]), signalScore: z.number(), rawScore: z.number(), redundancyAdjustment: z.number(), entryPrice: z.number(), signalDate: z.string(), factors: z.array(scanFactorSchema), formula: z.string(), invalidationLevel: z.number().nullable(), invalidationAtr14: z.number().nullable(), invalidationAtrMultiple: z.number().nullable(), invalidationMethod: z.string().nullable(), target1: z.number().nullable(), roomToBreatheAtr: z.number().nullable(), tightInvalidation: z.boolean().nullable(), invalidationGrade: z.literal("VOLATILITY").nullable(), sourceAsOf: z.string().nullable(), barTimestamp: z.string().nullable(), barState: z.enum(["closed", "forming"]), sourceUrl: z.string().nullable(), return5d: z.number().nullable(), return14d: z.number().nullable(), return30d: z.number().nullable(), tradeSetupEvaluation: trackerEvaluationShape, directionEvaluation: trackerEvaluationShape, history: z.array(interimSnapshotShape) });
const trackerStatShape = z.object({ cohortKey: z.string(), setupType: z.string(), agreementBand: z.string(), samples: z.number(), hits: z.number(), hitRate: z.number(), avgReturn: z.number(), avgWin: z.number(), avgLoss: z.number(), expectancy: z.number(), killSuggested: z.boolean() });
const signalTrackerResponse = z.object({ cohort: z.object({ strategyId: z.string(), strategyVersion: z.string(), parameterHash: z.string(), evaluatorVersion: z.string(), horizon: z.number(), horizonUnit: z.string(), priceConvention: z.string(), costScenario: z.string() }), signals: z.array(trackerSignalShape), stats: z.array(trackerStatShape), outcomeCounts: z.object({ issued: z.number(), open: z.number(), resolved: z.number(), ambiguous: z.number(), unverified: z.number() }), latestBrief: dailyBriefShape.nullable(), nextCursor: z.number().nullable() });
const openSignalSummaryResponse = z.object({
  generatedAt: z.string(),
  totalOpen: z.number().int().nonnegative(),
  latestBrief: dailyBriefShape.nullable(),
  signals: z.array(z.object({
    id: z.number(), symbol: z.string(), name: z.string(), direction: z.enum(["long", "short"]), entryPrice: z.number(), currentPrice: z.number().nullable(), invalidationLevel: z.number().nullable(), target1: z.number().nullable(), returnPct: z.number().nullable(), daysOpen: z.number().int().nonnegative(), signalDate: z.string(), sourceAsOf: z.string().nullable(),
  })).max(12),
});
const scorecardVerdict = z.enum(["HIT", "MISS", "AMBIGUOUS", "STALE", "UNVERIFIED"]);
const scorecardSplit = z.object({ label: z.string(), hits: z.number().int().nonnegative(), closed: z.number().int().nonnegative() });
const scorecardResponse = z.object({
  cohort: z.object({ strategyId: z.string(), strategyVersion: z.string(), parameterHash: z.string(), evaluatorVersion: z.string(), horizon: z.number(), horizonUnit: z.string(), priceConvention: z.string(), costScenario: z.string() }),
  trackRecord: z.object({
    tracked: z.number().int().nonnegative(),
    gradedClosed: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    hits: z.number().int().nonnegative(),
    misses: z.number().int().nonnegative(),
    hitRate: z.number().nullable(),
    sampleNote: z.string(),
    excluded: z.object({ ambiguous: z.number().int().nonnegative(), stale: z.number().int().nonnegative(), unverified: z.number().int().nonnegative() }),
    byDirection: z.array(scorecardSplit),
    byScoreBand: z.array(scorecardSplit),
  }),
  expectancy: z.object({ status: z.enum(["collecting", "measured"]), closed: z.number().int().nonnegative(), minimum: z.number().int().positive(), averageNetR: z.number().nullable(), buyAndHoldNetR: z.number().nullable(), randomEntryNetR: z.number().nullable(), costBps: z.number(), note: z.string() }),
  runnerRecall: z.object({ status: z.enum(["no_live_runs", "measured"]), firstLiveRun: z.string(), fast: z.object({ caught: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).nullable(), slow: z.object({ caught: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).nullable(), note: z.string(), dryRunNote: z.string() }),
  calibration: z.object({ status: z.literal("collecting"), minimum: z.number().int().positive(), note: z.string() }),
  honesty: z.object({ sources: z.array(z.object({ label: z.string(), asOf: z.string().nullable() })), asOf: z.string(), exclusionSummary: z.string(), verdictLedgerSettled: z.number().int().nonnegative(), terminalBriefSettled: z.number().int().nonnegative(), disagreement: z.boolean(), note: z.string() }),
});
const recordSignalVerdictResponse = z.object({ ok: z.boolean(), message: z.string() });
const snapshotRunResponse = z.object({ ok: z.boolean(), capturedDay: z.string(), trackedCount: z.number(), snapshotCount: z.number(), approachingTargetCount: z.number(), approachingInvalidationCount: z.number(), settlementUpdatedRows: z.number(), settlementFilledHorizons: z.number(), settlementPendingRows: z.number(), summary: z.string(), errors: z.array(z.string()) });
export async function computeDailySignalSnapshots(ctx: Ctx, dependencies: SignalJobDependencies = {}): Promise<z.infer<typeof snapshotRunResponse>> {
  // The scheduled post-mortem runs the authoritative append-only evaluator first.
  // Repeated jobs are idempotent because evidence identities dedupe identical revisions.
  const reconciliation = await reconcileSignalHistory(ctx, dependencies);
  const settlement = { updatedRows: reconciliation.revisionsInserted, filledHorizons: reconciliation.revisionsInserted, pendingRows: reconciliation.tradeSetup.open + reconciliation.tradeSetup.unverified, failures: reconciliation.ok ? [] as string[] : [reconciliation.note] };
  const db = ctx.db<typeof schema>(); const now = dependencies.now?.() ?? new Date(); const capturedDay = now.toISOString().slice(0, 10);
  const [rows, liveState] = await Promise.all([
    db.select().from(schema.trackedSignals).orderBy(desc(schema.trackedSignals.signalDate)),
    readLiveTrackerState(ctx),
  ]);
  const tracked = rows.filter((row) => !liveState.settledIds.has(row.id) && row.return30d == null && row.invalidationLevel != null && parseScanFactors(row.factorBreakdownJson).length > 0 && Math.floor((now.getTime() - Date.parse(`${row.signalDate}T00:00:00Z`)) / 86400000) <= 45);
  const existing = await db.select().from(schema.signalInterimSnapshots).where(eq(schema.signalInterimSnapshots.capturedDay, capturedDay)); const existingBySignal = new Map(existing.map((row) => [row.signalId, row]));
  const snapshotRows: Array<{ signalId: number; symbol: string; returnPct: number; distanceTarget1Pct: number; distanceInvalidationPct: number }> = []; const errors: string[] = [...settlement.failures]; const sourceDates: string[] = [];
  const settledSignalIds = new Set<number>([...liveState.current.entries()].filter(([key, row]) => key.endsWith("|trade_setup") && ["HIT", "MISS", "TIME_EXIT"].includes(row.verdict)).map(([key]) => Number(key.split("|")[0]))); const candleGapSignals: string[] = [];
  for (const signal of tracked) {
    const target1 = signal.target1;
    try {
      let series: YahooSeries | null = null; try { series = await (dependencies.loadFreshHistory ?? ((innerCtx, innerSymbol) => yahooFullHistory(innerCtx, innerSymbol)))(ctx, signal.symbol); } catch { series = await (dependencies.loadCachedHistory ?? cachedHistoryOnly)(ctx, signal.symbol); }
      const latest = series?.points.at(-1);
      const acceptedSetup = liveState.current.get(`${signal.id}|trade_setup`);
      if (acceptedSetup && ["AMBIGUOUS", "UNVERIFIED"].includes(acceptedSetup.verdict)) candleGapSignals.push(`${signal.symbol} #${signal.id} ${acceptedSetup.verdict.toLowerCase()}: ${acceptedSetup.reason}`);
      if (!latest || target1 == null || signal.invalidationLevel == null || !(latest.close > 0)) { errors.push(`${signal.symbol}: current or cached price, target, or invalidation unavailable`); continue; }
      const currentPrice = latest.close; const returnPct = signal.direction === "long" ? ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100 : ((signal.entryPrice - currentPrice) / signal.entryPrice) * 100;
      const distanceTarget1Pct = signal.direction === "long" ? ((target1 - currentPrice) / currentPrice) * 100 : ((currentPrice - target1) / currentPrice) * 100;
      const distanceInvalidationPct = signal.direction === "long" ? ((currentPrice - signal.invalidationLevel) / currentPrice) * 100 : ((signal.invalidationLevel - currentPrice) / currentPrice) * 100;
      const daysSinceEntry = Math.max(0, Math.floor((Date.parse(`${latest.date}T00:00:00Z`) - Date.parse(`${signal.signalDate}T00:00:00Z`)) / 86400000));
      const values = { signalId: signal.id, symbol: signal.symbol, capturedDay, currentPrice: round(currentPrice, 4), returnPct: round(returnPct), distanceTarget1Pct: round(distanceTarget1Pct), distanceInvalidationPct: round(distanceInvalidationPct), daysSinceEntry, capturedAt: now };
      const prior = existingBySignal.get(signal.id); if (prior) await db.update(schema.signalInterimSnapshots).set(values).where(eq(schema.signalInterimSnapshots.id, prior.id)); else await db.insert(schema.signalInterimSnapshots).values(values);
      snapshotRows.push({ signalId: signal.id, symbol: signal.symbol, returnPct, distanceTarget1Pct, distanceInvalidationPct }); sourceDates.push(latest.date);
    } catch (error) {
      candleGapSignals.push(`${signal.symbol} #${signal.id}`);
      errors.push(`${signal.symbol}: ${String(error).replace(/^Error:\s*/, "")}`);
    }
  }
  const uniqueCandleGapSignals = [...new Set(candleGapSignals)];
  if (uniqueCandleGapSignals.length) errors.push(`Daily OHLC path missing for ${uniqueCandleGapSignals.join(", ")}; counted open (fail-closed).`);
  const openSnapshotRows = snapshotRows.filter((row) => !settledSignalIds.has(row.signalId));
  const approachingTarget = openSnapshotRows.filter((row) => row.distanceTarget1Pct <= 3); const approachingInvalidation = openSnapshotRows.filter((row) => row.distanceInvalidationPct <= 3); const positive = openSnapshotRows.filter((row) => row.returnPct > 0).length; const negative = openSnapshotRows.filter((row) => row.returnPct < 0).length; const targetNames = [...new Set(approachingTarget.map((row) => row.symbol))]; const invalidationNames = [...new Set(approachingInvalidation.map((row) => row.symbol))];
  const gapNote = uniqueCandleGapSignals.length ? ` Candle history gaps: ${uniqueCandleGapSignals.join(", ")} — counted open.` : "";
  const summary = `${liveState.trackedCount} tracked: ${liveState.openCount} open, ${liveState.settledCount} settled by first target 1 / invalidation touch.${openSnapshotRows.length ? ` Open marks: ${positive} positive, ${negative} negative${openSnapshotRows.length - positive - negative ? `, ${openSnapshotRows.length - positive - negative} flat` : ""}. ${targetNames.length ? `Within 3% of target 1: ${targetNames.join(", ")}.` : "None are within 3% of target 1."} ${invalidationNames.length ? `Within 3% of invalidation: ${invalidationNames.join(", ")}.` : "None are within 3% of invalidation."}` : " No open call had a usable current or cached price."}${gapNote} ${settlement.filledHorizons ? `Filled ${settlement.filledHorizons} newly mature horizon${settlement.filledHorizons === 1 ? "" : "s"} across ${settlement.updatedRows} signal${settlement.updatedRows === 1 ? "" : "s"}.` : "No new completed-session horizon matured in this run."} Interim returns are noise and tracking only; formal 5D / 14D / 30D settlement uses completed trading sessions.`;
  const latestSourceDay = [...sourceDates].sort().at(-1) ?? capturedDay; const sourceAsOf = new Date(`${latestSourceDay}T23:59:59Z`); const briefValues = { capturedDay, summary, trackedCount: liveState.trackedCount, approachingTargetCount: approachingTarget.length, approachingInvalidationCount: approachingInvalidation.length, sourceAsOf, createdAt: now };
  const priorBrief = (await db.select().from(schema.signalDailyBriefs).where(eq(schema.signalDailyBriefs.capturedDay, capturedDay)).limit(1))[0]; if (priorBrief) await db.update(schema.signalDailyBriefs).set(briefValues).where(eq(schema.signalDailyBriefs.id, priorBrief.id)); else await db.insert(schema.signalDailyBriefs).values(briefValues);
  ctx.invalidateQueries(); return { ok: errors.length === 0, capturedDay, trackedCount: liveState.trackedCount, snapshotCount: snapshotRows.length, approachingTargetCount: approachingTarget.length, approachingInvalidationCount: approachingInvalidation.length, settlementUpdatedRows: settlement.updatedRows, settlementFilledHorizons: settlement.filledHorizons, settlementPendingRows: settlement.pendingRows, summary, errors };
}

const reconcileHistoryResponse = z.object({ ok: z.boolean(), evaluationVersion: z.string(), signalsReviewed: z.number(), fetchFailures: z.number(), tradeSetup: z.object({ hit: z.number(), miss: z.number(), ambiguous: z.number(), timeExit: z.number(), open: z.number(), unverified: z.number() }), directionForecast: z.object({ hit: z.number(), miss: z.number(), open: z.number(), unverified: z.number() }), transitions: z.record(z.string(), z.number()), revisionsInserted: z.number(), note: z.string() });
const persistedReplaySnapshotSchema = z.object({ availableThrough: z.string(), rawBars: z.array(z.object({ date: z.string(), open: z.number().nullable(), high: z.number().nullable(), low: z.number().nullable(), close: z.number().nullable(), volume: z.number().nullable().optional(), availableAt: z.string().nullable().optional() })), factors: z.unknown(), decision: z.object({ direction: z.enum(["long", "short"]), score: z.number() }), levels: z.object({ entryPrice: z.number(), stopPrice: z.number(), target1: z.number(), target2: z.number(), atr14: z.number().optional() }), canonicalParameters: z.object({ invalidationAtrMultiple: z.number().optional(), target1R: z.number().optional(), target2R: z.number().optional(), weights: z.record(z.string(), z.number()).optional() }).optional() });
const replaySnapshotResponse = z.object({ ok: z.boolean(), reconstructionStatus: z.enum(["reconstructed", "partial", "unavailable"]), matchesSaved: z.boolean(), mismatches: z.array(z.object({ field: z.string(), saved: z.unknown(), recomputed: z.unknown() })), signalId: z.number(), snapshotId: z.string().nullable(), decisionAt: z.string().nullable(), availableThrough: z.string().nullable(), eligibleBarCount: z.number(), eligibleLastBar: z.string().nullable(), decision: z.object({ direction: z.enum(["long", "short"]), score: z.number(), rawScore: z.number(), redundancyAdjustment: z.number() }).nullable(), levels: z.object({ entryPrice: z.number(), stopPrice: z.number(), target1: z.number(), target2: z.number(), atr14: z.number() }).nullable(), note: z.string() });
const measurementExportResponse = z.object({ evaluatorVersion: z.string(), cohort: z.object({ strategyId: z.string(), strategyVersion: z.string(), parameterHash: z.string(), evaluatorVersion: z.string(), horizon: z.number(), horizonUnit: z.string(), priceConvention: z.string(), costScenario: z.string() }), rows: z.array(z.object({ signalId: z.number(), symbol: z.string(), strategyVersion: z.string(), parameterHash: z.string(), inputSnapshotId: z.string().nullable(), oldVerdict: z.string().nullable(), tradeSetupVerdict: z.string().nullable(), tradeSetupReason: z.string().nullable(), directionForecastVerdict: z.string().nullable(), directionForecastReason: z.string().nullable(), grossReturnPct: z.number().nullable(), modeledNetReturnPct: z.number().nullable(), costStatus: z.string().nullable() })), counts: z.object({ issued: z.number(), resolved: z.number(), open: z.number(), ambiguous: z.number(), unverified: z.number() }), nextCursor: z.number().nullable(), note: z.string() });
const RECONCILIATION_VERSION = SIGNAL_EVALUATOR_VERSION;
export type SignalJobDependencies = {
  loadFreshHistory?: (ctx: Ctx, symbol: string) => Promise<YahooSeries>;
  loadCachedHistory?: (ctx: Ctx, symbol: string) => Promise<YahooSeries | null>;
  now?: () => Date;
};
function frozenEvaluationSignal(signal: typeof schema.trackedSignals.$inferSelect): FrozenEvaluationSignal | null {
  if (!signal.issuedAt || !signal.entryAt || signal.target1 == null || signal.invalidationLevel == null || signal.exchangeCalendar !== "XNYS" || signal.horizonUnit !== "trading_sessions") return null;
  return { signalId: signal.id, direction: signal.direction, entryPrice: signal.entryPrice, stopPrice: signal.invalidationLevel, targetPrice: signal.target1, entryAt: signal.entryAt, issuedAt: signal.issuedAt, expiresAt: signal.expiresAt, primaryHorizon: signal.primaryHorizon, horizonUnit: "trading_sessions", exchangeCalendar: "XNYS", entryRule: signal.entryRule };
}
function evidenceBars(points: Point[]): DailyEvidenceBar[] { return points.map((point) => ({ date: point.date, open: point.open, high: point.high, low: point.low, close: point.close, availableAt: xnysSessionBounds(point.date)?.end ?? null })); }
type RevisionProduct = "trade_setup" | "direction_forecast";
type PersistedEvaluation = ReturnType<typeof evaluateEquityTradeSetup>;
async function appendEvaluationRevision(ctx: Ctx, signal: typeof schema.trackedSignals.$inferSelect, product: RevisionProduct, evaluation: PersistedEvaluation, oldVerdict: string | null, sourceUrl: string, existingRows: Array<typeof schema.signalEvaluationRevisions.$inferSelect>): Promise<boolean> {
  const db = ctx.db<typeof schema>();
  const current = acceptedEvaluationRevisions(existingRows).get(`${signal.id}|${product}`);
  const evidence = { sourceUrl, inputSnapshotId: signal.inputSnapshotId, evaluatedAgainst: evaluation.observedSessions, expectedSessions: evaluation.expectedSessions, result: evaluation };
  const evidenceIdentity = await contentHash({ signalId: signal.id, evaluatorVersion: RECONCILIATION_VERSION, product, inputSnapshotId: signal.inputSnapshotId, observedSessions: evaluation.observedSessions, expectedSessions: evaluation.expectedSessions, result: evaluation });
  if (existingRows.some((row) => row.signalId === signal.id && row.evaluatorVersion === RECONCILIATION_VERSION && row.product === product && row.evidenceIdentity === evidenceIdentity)) return false;
  const cohortKey = `${signal.strategyId}|${signal.strategyVersion}|${signal.parameterHash}|${product}|${signal.primaryHorizon}:${signal.horizonUnit}|${signal.priceBasis}|${signal.entryRule}|${evaluation.costStatus}:${evaluation.costBps ?? "unknown"}`;
  const revisionInsert = db.insert(schema.signalEvaluationRevisions).values({ signalId: signal.id, evaluatorVersion: RECONCILIATION_VERSION, product, cohortKey, verdict: evaluation.verdict, reasonCode: evaluation.reasonCode, reason: evaluation.reason, evidenceIdentity, evidenceJson: JSON.stringify(evidence), predecessorRevisionId: current?.id ?? null, accepted: true, grossReturnPct: evaluation.grossReturnPct == null ? null : round(evaluation.grossReturnPct, 4), grossR: evaluation.grossR == null ? null : round(evaluation.grossR, 4), modeledNetReturnPct: evaluation.modeledNetReturnPct == null ? null : round(evaluation.modeledNetReturnPct, 4), modeledNetR: evaluation.modeledNetR == null ? null : round(evaluation.modeledNetR, 4), costStatus: evaluation.costStatus, costBps: evaluation.costBps });
  if (current) await db.batch([db.update(schema.signalEvaluationRevisions).set({ accepted: false }).where(eq(schema.signalEvaluationRevisions.id, current.id)), revisionInsert]); else await revisionInsert;
  // Preserve the Phase 1 export table as a legacy projection. Gross values are
  // deliberately not written into its historical net_* columns.
  if (!current) await db.insert(schema.signalEvaluationsV2).values({ signalId: signal.id, evaluationVersion: RECONCILIATION_VERSION, product, oldVerdict, newVerdict: evaluation.verdict === "OPEN" ? "UNVERIFIED" : evaluation.verdict, reason: `${evaluation.reason} Gross returns live in signal_evaluation_revisions; costs are ${evaluation.costStatus}.`, evidenceJson: JSON.stringify(evidence), netReturnPct: null, netR: null }).onConflictDoNothing({ target: [schema.signalEvaluationsV2.signalId, schema.signalEvaluationsV2.evaluationVersion, schema.signalEvaluationsV2.product] });
  return true;
}
export async function reconcileSignalHistory(ctx: Ctx, dependencies: SignalJobDependencies = {}): Promise<z.infer<typeof reconcileHistoryResponse>> {
  const db = ctx.db<typeof schema>();
  const [signals, verdicts, priorRevisions] = await Promise.all([db.select().from(schema.trackedSignals).orderBy(asc(schema.trackedSignals.id)), db.select().from(schema.scorecardVerdicts), db.select().from(schema.signalEvaluationRevisions).orderBy(asc(schema.signalEvaluationRevisions.id))]);
  const oldBySignal = new Map(verdicts.map((row) => [row.signalId, row.verdict]));
  const tradeSetup = { hit: 0, miss: 0, ambiguous: 0, timeExit: 0, open: 0, unverified: 0 }; const directionForecast = { hit: 0, miss: 0, open: 0, unverified: 0 }; const transitions: Record<string, number> = {}; let revisionsInserted = 0; let fetchFailures = 0;
  const evidenceBySymbol = new Map<string, { points: Point[]; sourceUrl: string; fresh: boolean }>();
  await Promise.all([...new Set(signals.map((signal) => signal.symbol))].map(async (symbol) => {
    try { const series = await (dependencies.loadFreshHistory ?? ((innerCtx, innerSymbol) => yahooFullHistory(innerCtx, innerSymbol, "background", true)))(ctx, symbol); evidenceBySymbol.set(symbol, { points: series.points, sourceUrl: series.sourceUrl, fresh: true }); }
    catch { try { const cached = await (dependencies.loadCachedHistory ?? cachedHistoryOnly)(ctx, symbol); evidenceBySymbol.set(symbol, { points: cached?.points ?? [], sourceUrl: cached?.sourceUrl ?? "", fresh: false }); } catch { evidenceBySymbol.set(symbol, { points: [], sourceUrl: "", fresh: false }); } }
  }));
  fetchFailures = [...evidenceBySymbol.values()].filter((row) => !row.fresh).length;
  const mutableRevisionRows = [...priorRevisions];
  for (const signal of signals) {
    const evidence = evidenceBySymbol.get(signal.symbol); const points = evidence?.points ?? []; const sourceUrl = evidence?.sourceUrl ?? "";
    const frozen = frozenEvaluationSignal(signal); const bars = evidenceBars(points); const evaluatedAt = (dependencies.now?.() ?? new Date()).toISOString();
    const unavailable: EquityEvaluation = { verdict: "UNVERIFIED", reasonCode: "legacy_contract_incomplete", reason: "The legacy signal lacks an immutable issuance/entry contract or supported calendar.", grossReturnPct: null, grossR: null, modeledNetReturnPct: null, modeledNetR: null, costStatus: "unknown", costBps: null, exitPrice: null, exitObservedAt: null, evidenceStartAt: null, evidenceEndAt: null, expectedSessions: [], observedSessions: [] };
    const trade = frozen ? evaluateEquityTradeSetup(frozen, bars, evaluatedAt, { kind: "unknown" }) : unavailable;
    const direction = frozen ? evaluateEquityDirectionForecast(frozen, bars, evaluatedAt) : unavailable;
    const oldVerdict = oldBySignal.get(signal.id) ?? null; const transition = `${oldVerdict ?? "NONE"}→${trade.verdict}`; transitions[transition] = (transitions[transition] ?? 0) + 1;
    if (await appendEvaluationRevision(ctx, signal, "trade_setup", trade, oldVerdict, sourceUrl, mutableRevisionRows)) revisionsInserted++;
    if (await appendEvaluationRevision(ctx, signal, "direction_forecast", direction, oldVerdict, sourceUrl, mutableRevisionRows)) revisionsInserted++;
    if (trade.verdict === "HIT") tradeSetup.hit++; else if (trade.verdict === "MISS") tradeSetup.miss++; else if (trade.verdict === "AMBIGUOUS") tradeSetup.ambiguous++; else if (trade.verdict === "TIME_EXIT") tradeSetup.timeExit++; else if (trade.verdict === "OPEN") tradeSetup.open++; else tradeSetup.unverified++;
    if (direction.verdict === "HIT") directionForecast.hit++; else if (direction.verdict === "MISS") directionForecast.miss++; else if (direction.verdict === "OPEN") directionForecast.open++; else directionForecast.unverified++;
  }
  ctx.invalidateQueries(); return { ok: fetchFailures === 0, evaluationVersion: RECONCILIATION_VERSION, signalsReviewed: signals.length, fetchFailures, tradeSetup, directionForecast, transitions, revisionsInserted, note: `Versioned evaluations are append-only. ${fetchFailures} fresh evidence fetch${fetchFailures === 1 ? "" : "es"} failed; cached evidence was used when present and missing coverage remained unverified. Actual issuedAt/entryAt, frozen levels, exact supported XNYS sessions, complete OHLC coverage, and fixed horizons are authoritative. Research-reference entries remain unverified trade setups. Gross returns are separate; execution costs remain unknown unless an explicit modeled scenario is attached.` };
}

const sourceJobSchema = z.object({ source: z.string(), job: z.string(), feeds: z.array(z.string()), quota: z.object({ used: z.number().nullable(), cap: z.number().nullable(), resets: z.string() }) });
const sourceJobsResponse = z.object({ refreshedAt: z.string(), jobs: z.array(sourceJobSchema) });

const signalTapeResponse = z.object({ symbol: z.string(), sourceAsOf: z.string().nullable(), sourceUrl: z.string().nullable(), signals: z.array(tapeSignalSchema), disclaimer: z.string() });
const signalTapeAction = defineAction({
  request: z.object({ query: z.string().min(1).max(80) }),
  response: signalTapeResponse,
  async handler(ctx, args): Promise<z.infer<typeof signalTapeResponse>> {
    const [result, spy] = await Promise.all([analyze(ctx, args.query, false), analyze(ctx, "SPY", false)]);
    if (result.status !== "ok" || !result.instrument) return { symbol: args.query.toUpperCase(), sourceAsOf: null, sourceUrl: null, signals: [], disclaimer: result.error ?? "Signal tape unavailable." };
    return { symbol: result.instrument.symbol, sourceAsOf: result.instrument.asOf, sourceUrl: result.instrument.sources[0]?.url ?? null, signals: buildSignalTape(result, spy.status === "ok" ? spy : null), disclaimer: "A directional rating requires at least 4 measured dimensions. Directional agreement is calculated only across measured dimensions; coverage is reported separately, and HIGH requires all five measured and aligned. Confidence is evidence quality, never win probability." };
  },
});

const DOSSIER_SYNTHESIS_RULE_VERSION = 2 as const;
const analyzeInstrumentResponse = analyzeResponse.extend({
  resolvedCoinId: z.string(),
  delivery: z.object({ cacheHit: z.boolean(), tradingDay: z.string(), generatedAt: z.string(), durationMs: z.number(), payloadBytes: z.number(), synthesisRuleVersion: z.literal(DOSSIER_SYNTHESIS_RULE_VERSION) }),
});
const walkForwardPageResponse = z.object({
  symbol: z.string(), observations: z.number(), qualified: z.boolean(), hitRate: z.number().nullable(), averageDirectionalReturn: z.number().nullable(),
  offset: z.number(), limit: z.number(), nextOffset: z.number().nullable(),
  decisions: z.array(z.object({ decisionAt: z.string(), outcomeAt: z.string(), score: z.number(), direction: z.enum(["long", "short"]), entryClose: z.number(), outcomeClose: z.number(), directionalReturnPct: z.number() })),
});
const dossierSeriesResponse = z.object({ symbol: z.string(), kind: z.enum(["daily", "weekly"]), total: z.number(), offset: z.number(), limit: z.number(), nextOffset: z.number().nullable(), sourceUrl: z.string(), rows: z.array(pointSchema) });
function easternTradingDay(now = new Date()): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now); const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""; return `${part("year")}-${part("month")}-${part("day")}`; }

const freshnessInputSchema = z.object({
  kind: z.enum(["quote", "completed_candle", "forming_candle", "expensive_analysis"]), label: z.string(), value: z.number().nullable(), open: z.number().nullable(), high: z.number().nullable(), low: z.number().nullable(), close: z.number().nullable(), volume: z.number().nullable(), eventAt: z.string().nullable(), receivedAt: z.string().nullable(), lastSuccessAt: z.string().nullable(), providerAgeSeconds: z.number().nullable(), fetchAgeSeconds: z.number().nullable(), cacheAgeSeconds: z.number().nullable(), stale: z.boolean(), state: z.enum(["fresh", "stale", "error", "market_closed", "not_available"]), candleState: z.enum(["forming", "closed", "not_applicable"]), source: z.string(), venue: z.string(), quoteCurrency: z.string().nullable(), entitlement: z.string(), error: z.string().nullable(), trace: z.string(),
});
const freshnessSymbolSchema = z.object({ symbol: z.string(), marketKind: z.enum(["equity", "crypto"]), inputs: z.array(freshnessInputSchema), statusEvents: z.array(z.object({ signalId: z.number(), status: z.enum(["target_observed", "stop_observed", "stale", "entry_no_longer_eligible"]), settlement: z.enum(["observed_only", "unsettled", "evaluated"]), observedAt: z.string(), note: z.string() })).max(20) });
const freshnessDashboardResponse = z.object({ generatedAt: z.string(), provider: z.string(), transport: z.string(), entitlement: z.string(), cadenceMinutes: z.number(), lanes: z.array(z.object({ lane: z.string(), cadence: z.string(), dependency: z.string() })), budget: z.object({ activeInstruments: z.number(), cadenceMinutes: z.number(), runsPerDay: z.number(), requestsPerRun: z.number(), dailyRequests: z.number(), monthlyRequests30d: z.number() }), symbols: z.array(freshnessSymbolSchema), lastRun: z.object({ id: z.number(), status: z.enum(["running", "ok", "partial", "failed"]), trigger: z.enum(["manual", "scheduled", "diagnostic"]), requestedCount: z.number(), refreshedCount: z.number(), staleCount: z.number(), errorCount: z.number(), startedAt: z.string(), finishedAt: z.string().nullable(), note: z.string() }).nullable(), note: z.string() });
const refreshMarketDataResponse = z.object({ ok: z.boolean(), runId: z.number(), status: z.enum(["ok", "partial", "failed"]), startedAt: z.string(), finishedAt: z.string(), symbols: z.array(z.object({ symbol: z.string(), status: z.enum(["fresh", "stale", "error", "market_closed"]), quoteEventAt: z.string().nullable(), quoteReceivedAt: z.string().nullable(), quotePrice: z.number().nullable(), completedCandleAt: z.string().nullable(), formingCandleAt: z.string().nullable(), observationsWritten: z.number(), observationsReused: z.number(), statusEventsAppended: z.number(), error: z.string().nullable() })), budget: z.object({ activeInstruments: z.number(), cadenceMinutes: z.number(), runsPerDay: z.number(), requestsPerRun: z.number(), dailyRequests: z.number(), monthlyRequests30d: z.number() }), isolation: z.object({ expensiveAnalysisCalled: z.literal(false), decisionsCreated: z.literal(0), snapshotsMutated: z.literal(0) }) });

type RefreshSymbolResult = z.infer<typeof refreshMarketDataResponse>["symbols"][number];
const marketRefreshInflight = new Map<string, Promise<RefreshSymbolResult>>();
function equitySessionOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const bounds = xnysSessionBounds(`${get("year")}-${get("month")}-${get("day")}`);
  return bounds != null && now.getTime() >= Date.parse(bounds.start) && now.getTime() < Date.parse(bounds.end);
}
function observationEventAt(symbol: string, date: string, state: "forming" | "closed", quoteEventAt: string): string {
  if (state === "forming") return quoteEventAt;
  return marketKindForSymbol(symbol) === "crypto" ? `${date}T23:59:59.999Z` : newYorkCloseIso(date);
}
async function persistMarketObservation(ctx: Ctx, input: { runId: number; symbol: string; kind: ObservationKind; venue: string; currency: string | null; sourceUrl: string; eventAt: string; receivedAt: Date; state: "forming" | "closed" | "not_applicable"; price: number | null; point: Point | null; rawTrace: Record<string, unknown> }): Promise<{ id: number; written: boolean }> {
  const db = ctx.db<typeof schema>(); const identity = observationIdentity({ symbol: input.symbol, kind: input.kind, eventAt: input.eventAt, candleState: input.state === "not_applicable" ? "closed" : input.state, values: { price: input.price, open: input.point?.open ?? null, high: input.point?.high ?? null, low: input.point?.low ?? null, close: input.point?.close ?? null, volume: input.point?.volume ?? null } }); const hash = await contentHash(identity);
  const existing = (await db.select().from(schema.marketObservations).where(eq(schema.marketObservations.contentHash, hash)).limit(1))[0]; if (existing) return { id: existing.id, written: false };
  const sameEvent = await db.select().from(schema.marketObservations).where(and(eq(schema.marketObservations.symbol, input.symbol), eq(schema.marketObservations.observationKind, input.kind), eq(schema.marketObservations.eventAt, input.eventAt))).orderBy(desc(schema.marketObservations.correctionVersion), desc(schema.marketObservations.id)).limit(1); const prior = sameEvent[0];
  await db.insert(schema.marketObservations).values({ runId: input.runId, symbol: input.symbol, marketKind: marketKindForSymbol(input.symbol), observationKind: input.kind, venue: input.venue, quoteCurrency: input.currency, source: MARKET_REFRESH_CONFIG.provider, sourceUrl: input.sourceUrl, eventAt: input.eventAt, receivedAt: input.receivedAt, candleState: input.state, price: input.price, open: input.point?.open ?? null, high: input.point?.high ?? null, low: input.point?.low ?? null, close: input.point?.close ?? null, volume: input.point?.volume ?? null, correctionVersion: (prior?.correctionVersion ?? 0) + 1, priorObservationId: prior?.id ?? null, contentHash: hash, rawTraceJson: JSON.stringify(input.rawTrace) }).onConflictDoNothing({ target: schema.marketObservations.contentHash });
  const inserted = (await db.select().from(schema.marketObservations).where(eq(schema.marketObservations.contentHash, hash)).limit(1))[0]; if (!inserted) throw new Error(`Observation persistence failed for ${input.symbol}.`); return { id: inserted.id, written: true };
}
async function upsertRefreshState(ctx: Ctx, input: { symbol: string; kind: ObservationKind; observationId: number | null; status: "fresh" | "stale" | "error" | "market_closed"; attemptedAt: Date; successAt: Date | null; error: string | null }) {
  const db = ctx.db<typeof schema>(); await db.insert(schema.marketRefreshState).values({ symbol: input.symbol, observationKind: input.kind, latestObservationId: input.observationId, status: input.status, lastAttemptAt: input.attemptedAt, lastSuccessAt: input.successAt, error: input.error, nextRetryAt: input.error ? new Date(input.attemptedAt.getTime() + MARKET_REFRESH_CONFIG.retryBackoffSeconds[0] * 1000) : null, updatedAt: input.attemptedAt }).onConflictDoUpdate({ target: [schema.marketRefreshState.symbol, schema.marketRefreshState.observationKind], set: { latestObservationId: input.observationId, status: input.status, lastAttemptAt: input.attemptedAt, lastSuccessAt: input.successAt, error: input.error, nextRetryAt: input.error ? new Date(input.attemptedAt.getTime() + MARKET_REFRESH_CONFIG.retryBackoffSeconds[0] * 1000) : null, updatedAt: input.attemptedAt } });
}
async function appendStatusEvents(ctx: Ctx, input: { symbol: string; observationId: number; observedAt: Date; quote: number; providerEventAt: string; freshnessState: "fresh" | "stale" | "error" | "market_closed"; observationVenue: string }): Promise<number> {
  const db = ctx.db<typeof schema>(); const signals = await db.select().from(schema.trackedSignals).where(eq(schema.trackedSignals.symbol, input.symbol)); let appended = 0;
  for (const signal of signals) {
    const eligibility = signalObservationEligibility({ validationStatus: signal.validationStatus, issuedAt: signal.issuedAt, entryAt: signal.entryAt, exchangeCalendar: signal.exchangeCalendar, signalVenue: signal.venue, priceBasis: signal.priceBasis, observationVenue: input.observationVenue, observationEventAt: input.providerEventAt, freshnessState: input.freshnessState });
    if (!eligibility.eligible) continue;
    for (const planned of planSignalStatus({ id: signal.id, direction: signal.direction, entryPrice: signal.entryPrice, invalidationLevel: signal.invalidationLevel, target1: signal.target1, target2: signal.target2 }, input.quote)) {
      const support = { observationId: input.observationId, quote: input.quote, providerEventAt: input.providerEventAt, observedAt: input.observedAt.toISOString(), eligibility: eligibility.reason, frozen: { entryPrice: signal.entryPrice, invalidationLevel: signal.invalidationLevel, target1: signal.target1, target2: signal.target2 }, note: planned.note, authoritativeSettlement: false }; const dedupKey = await contentHash({ signalId: signal.id, status: planned.status, statusContract: "eligible-observed-once-v2" });
      const before = await db.select({ id: schema.signalStatusEvents.id }).from(schema.signalStatusEvents).where(eq(schema.signalStatusEvents.dedupKey, dedupKey)).limit(1); await db.insert(schema.signalStatusEvents).values({ signalId: signal.id, observationId: input.observationId, status: planned.status, settlement: planned.settlement, observedAt: input.observedAt, supportJson: JSON.stringify(support), dedupKey }).onConflictDoNothing({ target: schema.signalStatusEvents.dedupKey }); if (!before[0]) appended += 1;
    }
  }
  return appended;
}
export type MarketRefreshDependencies = { fetchSeries: typeof yahooSeries; now: () => Date; retryDelay: () => Promise<void> };
const marketRefreshDependencies: MarketRefreshDependencies = { fetchSeries: yahooSeries, now: () => new Date(), retryDelay: () => new Promise((resolve) => setTimeout(resolve, 250)) };
export async function refreshOneSymbol(ctx: Ctx, runId: number, rawSymbol: string, dependencies: MarketRefreshDependencies = marketRefreshDependencies): Promise<RefreshSymbolResult> {
  const symbol = rawSymbol.trim().toUpperCase(); const pending = marketRefreshInflight.get(symbol); if (pending) return pending;
  const task = (async (): Promise<RefreshSymbolResult> => { const attemptedAt = dependencies.now(); let receivedAt = attemptedAt; let written = 0, reused = 0, events = 0; try {
    let series: Awaited<ReturnType<typeof yahooSeries>>; try { series = await dependencies.fetchSeries(symbol, "5d", "background"); } catch (error) { if (!String(error).includes("429")) throw error; await dependencies.retryDelay(); series = await dependencies.fetchSeries(symbol, "5d", "background"); }
    receivedAt = dependencies.now();
    const quotePrice = finite(series.meta.regularMarketPrice) ?? series.points.at(-1)?.close ?? null;
    const quoteSeconds = series.meta.regularMarketTime;
    const providerQuoteEventAt = quoteSeconds != null && Number.isFinite(quoteSeconds) ? new Date(quoteSeconds * 1000).toISOString() : null;
    const storedQuoteEventAt = providerQuoteEventAt ?? receivedAt.toISOString();
    const observationVenue = series.meta.fullExchangeName ?? series.meta.exchangeName ?? "Yahoo Finance aggregate";
    const sessionOpen = marketKindForSymbol(symbol) === "crypto" ? true : equitySessionOpen(receivedAt);
    const quoteFreshness = classifyFreshness({ nowIso: receivedAt.toISOString(), eventAt: providerQuoteEventAt, kind: "quote", marketKind: marketKindForSymbol(symbol), marketOpen: sessionOpen, error: null });
    const quoteObs = await persistMarketObservation(ctx, { runId, symbol, kind: "quote", venue: observationVenue, currency: series.meta.currency ?? null, sourceUrl: series.sourceUrl, eventAt: storedQuoteEventAt, receivedAt, state: "not_applicable", price: quotePrice, point: null, rawTrace: { providerRegularMarketTime: quoteSeconds ?? null, providerTimestampMissing: providerQuoteEventAt == null, providerRegularMarketPrice: series.meta.regularMarketPrice ?? null, displayedPrice: quotePrice, entitlement: MARKET_REFRESH_CONFIG.entitlement } });
    quoteObs.written ? written++ : reused++;
    await upsertRefreshState(ctx, { symbol, kind: "quote", observationId: quoteObs.id, status: quoteFreshness.state, attemptedAt: receivedAt, successAt: receivedAt, error: null });
    if (quotePrice != null && providerQuoteEventAt != null) events += await appendStatusEvents(ctx, { symbol, observationId: quoteObs.id, observedAt: receivedAt, quote: quotePrice, providerEventAt: providerQuoteEventAt, freshnessState: quoteFreshness.state, observationVenue });
    let completedAt: string | null = null, formingAt: string | null = null; const last = series.points.at(-1); const previous = series.points.at(-2); if (last) { const state = candleState({ symbol, barDate: last.date, nowIso: receivedAt.toISOString(), equitySessionOpen: sessionOpen }); const forming = state === "forming" ? last : null; const completed = state === "forming" ? previous ?? null : last; if (forming) { formingAt = observationEventAt(symbol, forming.date, "forming", storedQuoteEventAt); const obs = await persistMarketObservation(ctx, { runId, symbol, kind: "forming_candle", venue: series.meta.fullExchangeName ?? series.meta.exchangeName ?? "Yahoo Finance aggregate", currency: series.meta.currency ?? null, sourceUrl: series.sourceUrl, eventAt: formingAt, receivedAt, state: "forming", price: forming.close, point: forming, rawTrace: { providerBarDate: forming.date, displayedClose: forming.close, displayedVolume: forming.volume, comparisonPolicy: "Forming volume is never compared with a completed full-session reference." } }); obs.written ? written++ : reused++; const fresh = classifyFreshness({ nowIso: receivedAt.toISOString(), eventAt: formingAt, kind: "forming_candle", marketKind: marketKindForSymbol(symbol), marketOpen: sessionOpen, error: null }); await upsertRefreshState(ctx, { symbol, kind: "forming_candle", observationId: obs.id, status: fresh.state, attemptedAt: receivedAt, successAt: receivedAt, error: null }); }
      if (completed) { completedAt = observationEventAt(symbol, completed.date, "closed", storedQuoteEventAt); const obs = await persistMarketObservation(ctx, { runId, symbol, kind: "completed_candle", venue: series.meta.fullExchangeName ?? series.meta.exchangeName ?? "Yahoo Finance aggregate", currency: series.meta.currency ?? null, sourceUrl: series.sourceUrl, eventAt: completedAt, receivedAt, state: "closed", price: completed.close, point: completed, rawTrace: { providerBarDate: completed.date, displayedClose: completed.close, displayedVolume: completed.volume, immutableDecisionEligibility: true } }); obs.written ? written++ : reused++; const fresh = classifyFreshness({ nowIso: receivedAt.toISOString(), eventAt: completedAt, kind: "completed_candle", marketKind: marketKindForSymbol(symbol), marketOpen: sessionOpen, error: null }); await upsertRefreshState(ctx, { symbol, kind: "completed_candle", observationId: obs.id, status: fresh.state, attemptedAt: receivedAt, successAt: receivedAt, error: null }); }
    }
    return { symbol, status: quoteFreshness.state, quoteEventAt: providerQuoteEventAt, quoteReceivedAt: receivedAt.toISOString(), quotePrice, completedCandleAt: completedAt, formingCandleAt: formingAt, observationsWritten: written, observationsReused: reused, statusEventsAppended: events, error: null };
  } catch (error) { const message = String(error).replace(/^Error:\s*/, ""); const db = ctx.db<typeof schema>(); const current = (await db.select().from(schema.marketRefreshState).where(and(eq(schema.marketRefreshState.symbol, symbol), eq(schema.marketRefreshState.observationKind, "quote"))).limit(1))[0]; await upsertRefreshState(ctx, { symbol, kind: "quote", observationId: current?.latestObservationId ?? null, status: "error", attemptedAt: receivedAt, successAt: current?.lastSuccessAt ?? null, error: message }); return { symbol, status: "error", quoteEventAt: null, quoteReceivedAt: receivedAt.toISOString(), quotePrice: null, completedCandleAt: null, formingCandleAt: null, observationsWritten: written, observationsReused: reused, statusEventsAppended: events, error: message }; } })();
  marketRefreshInflight.set(symbol, task); try { return await task; } finally { marketRefreshInflight.delete(symbol); }
}
async function activeRefreshSymbols(ctx: Ctx, requested: string[] | undefined): Promise<string[]> { if (requested?.length) return [...new Set(requested.map((value) => value.trim().toUpperCase()).filter(Boolean))].slice(0, MARKET_REFRESH_CONFIG.maxSymbolsPerRun); const db = ctx.db<typeof schema>(); const [watch, tracked] = await Promise.all([db.select({ symbol: schema.watchlist.symbol }).from(schema.watchlist), db.select({ symbol: schema.trackedSignals.symbol }).from(schema.trackedSignals)]); const active = [...new Set([...tracked, ...watch].map((row) => row.symbol.toUpperCase()))]; return (active.length ? active : ["BTC-USD", "ETH-USD", "SOL-USD", "SPY"]).slice(0, MARKET_REFRESH_CONFIG.maxSymbolsPerRun); }

export async function buildFreshnessDashboard(ctx: Ctx, requestedSymbol?: string, now: Date = new Date()): Promise<z.infer<typeof freshnessDashboardResponse>> {
  const db = ctx.db<typeof schema>(); const states = requestedSymbol ? await db.select().from(schema.marketRefreshState).where(eq(schema.marketRefreshState.symbol, requestedSymbol.toUpperCase())) : await db.select().from(schema.marketRefreshState); const observations = await db.select().from(schema.marketObservations).orderBy(desc(schema.marketObservations.receivedAt)); const statusEvents = await db.select().from(schema.signalStatusEvents).orderBy(desc(schema.signalStatusEvents.observedAt)); const latestRun = (await db.select().from(schema.marketRefreshRuns).where(eq(schema.marketRefreshRuns.lane, "market_data")).orderBy(desc(schema.marketRefreshRuns.startedAt)).limit(1))[0]; const dossier = await db.select().from(schema.dossierCaches).orderBy(desc(schema.dossierCaches.generatedAt)); const symbols = [...new Set(states.map((row) => row.symbol))];
  const mapped = symbols.map((symbol) => { const symbolStates = states.filter((row) => row.symbol === symbol); const inputs: z.infer<typeof freshnessInputSchema>[] = symbolStates.map((state) => { const observation = observations.find((row) => row.id === state.latestObservationId); let providerEventAt = observation?.eventAt ?? null; if (observation) { try { const raw = JSON.parse(observation.rawTraceJson) as { providerTimestampMissing?: unknown }; if (raw.providerTimestampMissing === true) providerEventAt = null; } catch { providerEventAt = null; } } const marketKind = marketKindForSymbol(symbol); const live = currentFreshness({ nowIso: now.toISOString(), providerEventAt, lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null, kind: state.observationKind, marketKind, marketOpen: marketKind === "crypto" ? true : equitySessionOpen(now), error: state.error }); const age = live.fetchAgeSeconds; return { kind: state.observationKind, label: state.observationKind === "quote" ? "Current mark" : state.observationKind === "forming_candle" ? "Forming daily candle / volume" : "Latest completed daily candle / volume", value: observation?.price ?? observation?.close ?? null, open: observation?.open ?? null, high: observation?.high ?? null, low: observation?.low ?? null, close: observation?.close ?? null, volume: observation?.volume ?? null, eventAt: providerEventAt, receivedAt: observation?.receivedAt.toISOString() ?? null, lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null, providerAgeSeconds: live.providerAgeSeconds, fetchAgeSeconds: live.fetchAgeSeconds, cacheAgeSeconds: age, stale: live.stale, state: live.state, candleState: observation?.candleState ?? "not_applicable", source: observation?.source ?? MARKET_REFRESH_CONFIG.provider, venue: observation?.venue ?? "Unavailable", quoteCurrency: observation?.quoteCurrency ?? null, entitlement: MARKET_REFRESH_CONFIG.entitlement, error: state.error, trace: observation ? `provider event ${providerEventAt ?? "missing"} → received ${observation.receivedAt.toISOString()} → displayed ${observation.price ?? observation.close ?? "—"}; correction v${observation.correctionVersion}` : "No successful observation yet." }; }); const cached = dossier.find((row) => row.symbol === symbol); inputs.push({ kind: "expensive_analysis", label: "Expensive dossier analysis", value: null, open: null, high: null, low: null, close: null, volume: null, eventAt: cached?.generatedAt.toISOString() ?? null, receivedAt: cached?.generatedAt.toISOString() ?? null, lastSuccessAt: cached?.generatedAt.toISOString() ?? null, providerAgeSeconds: cached ? Math.max(0, Math.floor((now.getTime() - cached.generatedAt.getTime()) / 1000)) : null, fetchAgeSeconds: cached ? Math.max(0, Math.floor((now.getTime() - cached.generatedAt.getTime()) / 1000)) : null, cacheAgeSeconds: cached ? Math.max(0, Math.floor((now.getTime() - cached.generatedAt.getTime()) / 1000)) : null, stale: !cached || easternTradingDay(cached.generatedAt) !== easternTradingDay(now), state: !cached ? "not_available" : easternTradingDay(cached.generatedAt) === easternTradingDay(now) ? "fresh" : "stale", candleState: "not_applicable", source: "Daily dossier cache", venue: "Terminal database", quoteCurrency: null, entitlement: "Cached separately; a market refresh never changes this timestamp.", error: null, trace: cached ? `dossier generated ${cached.generatedAt.toISOString()} → reused independently of market polling` : "No cached dossier for this symbol." }); const signalIds = new Set((observations.filter((row) => row.symbol === symbol)).map((row) => row.id)); const eventsForSymbol = statusEvents.filter((event) => signalIds.has(event.observationId)).slice(0, 20).map((event) => { let note = "Status appended from a market observation; issued levels remain frozen."; try { const parsed = JSON.parse(event.supportJson) as { note?: unknown }; if (typeof parsed.note === "string") note = parsed.note; } catch { /* retain fallback */ } return { signalId: event.signalId, status: event.status, settlement: event.settlement, observedAt: event.observedAt.toISOString(), note }; }); return { symbol, marketKind: marketKindForSymbol(symbol), inputs, statusEvents: eventsForSymbol }; }); const budget = requestBudget(symbols.length || 4);
  return { generatedAt: now.toISOString(), provider: MARKET_REFRESH_CONFIG.provider, transport: MARKET_REFRESH_CONFIG.transport, entitlement: MARKET_REFRESH_CONFIG.entitlement, cadenceMinutes: MARKET_REFRESH_CONFIG.cadenceMinutes, lanes: [{ lane: "market_data", cadence: "15 minutes when scheduled", dependency: "Independent bounded Yahoo chart polling" }, { lane: "expensive_analysis", cadence: "On demand / daily cache", dependency: "Never invoked by market-data refresh" }, { lane: "signal_monitoring", cadence: "After persisted observations", dependency: "Append-only observed statuses; existing evaluator owns settlement" }], budget, symbols: mapped, lastRun: latestRun ? { id: latestRun.id, status: latestRun.status, trigger: latestRun.trigger, requestedCount: latestRun.requestedCount, refreshedCount: latestRun.refreshedCount, staleCount: latestRun.staleCount, errorCount: latestRun.errorCount, startedAt: latestRun.startedAt.toISOString(), finishedAt: latestRun.finishedAt?.toISOString() ?? null, note: latestRun.note } : null, note: "Market polling writes append-only observations and status events. It never edits tracked_signals, signal_input_snapshots, issued levels, decisions, or evaluation evidence." };
}

export async function runMarketDataRefresh(ctx: Ctx, args: { symbols?: string[]; trigger: "manual" | "scheduled" | "diagnostic" }, dependencies: MarketRefreshDependencies = marketRefreshDependencies): Promise<z.infer<typeof refreshMarketDataResponse>> {
  const symbols = await activeRefreshSymbols(ctx, args.symbols); const db = ctx.db<typeof schema>(); const startedAt = dependencies.now();
  const insertedRuns = await db.insert(schema.marketRefreshRuns).values({ lane: "market_data", trigger: args.trigger, status: "running", requestedCount: symbols.length, startedAt }).returning(); const run = insertedRuns[0]; if (!run) throw new Error("Market refresh run could not be initialized.");
  const results = await Promise.all(symbols.map((symbol) => refreshOneSymbol(ctx, run.id, symbol, dependencies))); const refreshedCount = results.filter((row) => row.status === "fresh" || row.status === "market_closed").length; const staleCount = results.filter((row) => row.status === "stale").length; const errorCount = results.filter((row) => row.status === "error").length; const status = errorCount === results.length ? "failed" as const : errorCount || staleCount ? "partial" as const : "ok" as const; const finishedAt = dependencies.now(); const note = `Market-data lane only: ${refreshedCount}/${results.length} usable, ${staleCount} stale-content, ${errorCount} errors. Expensive analysis was not called.`; await db.update(schema.marketRefreshRuns).set({ status, refreshedCount, staleCount, errorCount, note, finishedAt }).where(eq(schema.marketRefreshRuns.id, run.id)); ctx.invalidateQueries(); return { ok: status !== "failed", runId: run.id, status, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), symbols: results, budget: requestBudget(symbols.length), isolation: { expensiveAnalysisCalled: false, decisionsCreated: 0, snapshotsMutated: 0 } };
}

export const Actions = {
  refreshMarketData: defineAction({
    request: z.object({ symbols: z.array(z.string().min(1).max(30)).max(20).optional(), trigger: z.enum(["manual", "scheduled", "diagnostic"]).default("manual") }), response: refreshMarketDataResponse,
    async handler(ctx, args): Promise<z.infer<typeof refreshMarketDataResponse>> { return runMarketDataRefresh(ctx, args); },
  }),
  getMarketFreshness: defineAction({ request: z.object({ symbol: z.string().min(1).max(30).optional() }), response: freshnessDashboardResponse, async handler(ctx, args): Promise<z.infer<typeof freshnessDashboardResponse>> { return buildFreshnessDashboard(ctx, args.symbol?.trim().toUpperCase()); } }),
  reconcileSignalHistory: defineAction({ request: z.object({}), response: reconcileHistoryResponse, async handler(ctx): Promise<z.infer<typeof reconcileHistoryResponse>> { return reconcileSignalHistory(ctx); } }),
  replaySignalSnapshot: defineAction({
    request: z.object({ signalId: z.number().int().positive() }), response: replaySnapshotResponse,
    async handler(ctx, args): Promise<z.infer<typeof replaySnapshotResponse>> {
      const db = ctx.db<typeof schema>(); const [signal] = await db.select().from(schema.trackedSignals).where(eq(schema.trackedSignals.id, args.signalId)).limit(1); if (!signal) return { ok: false, reconstructionStatus: "unavailable", matchesSaved: false, mismatches: [], signalId: args.signalId, snapshotId: null, decisionAt: null, availableThrough: null, eligibleBarCount: 0, eligibleLastBar: null, decision: null, levels: null, note: "Signal not found." };
      const [stored] = await db.select().from(schema.signalInputSnapshots).where(eq(schema.signalInputSnapshots.signalId, signal.id)).limit(1); if (!stored) return { ok: false, reconstructionStatus: "unavailable", matchesSaved: false, mismatches: [], signalId: signal.id, snapshotId: signal.inputSnapshotId, decisionAt: signal.decisionAt, availableThrough: null, eligibleBarCount: 0, eligibleLastBar: null, decision: null, levels: null, note: "No raw snapshot exists; this legacy issuance remains unreconstructable." };
      const parsed = persistedReplaySnapshotSchema.safeParse(JSON.parse(stored.rawInputsJson)); if (!parsed.success) return { ok: false, reconstructionStatus: "unavailable", matchesSaved: false, mismatches: [], signalId: signal.id, snapshotId: stored.id, decisionAt: signal.decisionAt, availableThrough: stored.availableThrough, eligibleBarCount: 0, eligibleLastBar: null, decision: null, levels: null, note: "The persisted snapshot failed the versioned replay schema." };
      const replay = deterministicReplaySnapshot(parsed.data, signal.decisionAt ?? stored.availableThrough); return { ok: replay.status === "reconstructed" && replay.matchesSaved, reconstructionStatus: replay.status, matchesSaved: replay.matchesSaved, mismatches: replay.mismatches, signalId: signal.id, snapshotId: stored.id, decisionAt: signal.decisionAt, availableThrough: replay.availableThrough, eligibleBarCount: replay.bars.length, eligibleLastBar: replay.bars.at(-1)?.date ?? null, decision: replay.decision, levels: replay.levels, note: replay.status === "reconstructed" ? `Offline reconstruction recomputed factors, score, direction and levels from the persisted raw window without provider access; ${replay.mismatches.length} saved-field mismatch${replay.mismatches.length === 1 ? "" : "es"}.` : `Offline reconstruction is partial: ${replay.reason}. No stored output was presented as a recomputed answer.` };
    },
  }),
  exportMeasurementClosure: defineAction({
    request: z.object({ limit: z.number().int().min(1).max(100).optional(), cursor: z.number().int().nonnegative().nullable().optional() }), response: measurementExportResponse,
    async handler(ctx, args): Promise<z.infer<typeof measurementExportResponse>> {
      const db = ctx.db<typeof schema>(); const [signals, revisions, legacyVerdicts] = await Promise.all([db.select().from(schema.trackedSignals).orderBy(asc(schema.trackedSignals.id)), db.select().from(schema.signalEvaluationRevisions).orderBy(asc(schema.signalEvaluationRevisions.id)), db.select().from(schema.scorecardVerdicts)]); const current = acceptedEvaluationRevisionsForCohort(revisions, activeCohortKeys); const oldBySignal = new Map(legacyVerdicts.map((row) => [row.signalId, row.verdict]));
      const mapped = signals.filter((signal) => signal.strategyId === SIGNAL_STRATEGY_ID && signal.strategyVersion === SIGNAL_STRATEGY_VERSION && signal.parameterHash === SIGNAL_PARAMETER_HASH && signal.primaryHorizon === 30 && signal.horizonUnit === "trading_sessions" && signal.priceBasis === cohortDescriptor.priceConvention).map((signal) => { const trade = current.get(`${signal.id}|trade_setup`); const direction = current.get(`${signal.id}|direction_forecast`); return { signalId: signal.id, symbol: signal.symbol, strategyVersion: signal.strategyVersion, parameterHash: signal.parameterHash, inputSnapshotId: signal.inputSnapshotId, oldVerdict: oldBySignal.get(signal.id) ?? null, tradeSetupVerdict: trade?.verdict ?? null, tradeSetupReason: trade?.reason ?? null, directionForecastVerdict: direction?.verdict ?? null, directionForecastReason: direction?.reason ?? null, grossReturnPct: direction?.grossReturnPct ?? null, modeledNetReturnPct: direction?.modeledNetReturnPct ?? null, costStatus: direction?.costStatus ?? null }; }); const page = pageSlice(mapped, args.limit ?? 100, args.cursor); const state = await readLiveTrackerState(ctx);
      return { evaluatorVersion: SIGNAL_EVALUATOR_VERSION, cohort: cohortDescriptor, rows: page.items, counts: { issued: state.trackedCount, resolved: state.settledCount, open: state.openCount, ambiguous: state.ambiguousCount, unverified: state.unverifiedCount }, nextCursor: page.nextCursor, note: "Machine-readable accepted-revision export. Legacy verdicts are preserved only as oldVerdict; they do not drive the current read model." };
    },
  }),
  getMarketRead: defineAction({
    request: z.object({ query: z.string().min(1).max(80).optional() }),
    response: z.object({ refreshedAt: z.string(), synthesis: z.string(), partial: z.boolean(), breadth15d: z.number().nullable(), activeFlags: z.number(), highAlignment: z.number(), leader: z.string().nullable(), instruments: z.array(z.object({ symbol: z.string(), status: z.enum(["refreshed", "unavailable"]), asOf: z.string().nullable(), return15d: z.number().nullable(), alignmentScore: z.number().nullable(), direction: z.enum(["long", "short", "mixed"]).nullable(), activeFlags: z.number(), error: z.string().nullable() })) }),
    async handler(ctx, args) {
      const watched = await ctx.db<typeof schema>().select().from(schema.watchlist).orderBy(asc(schema.watchlist.createdAt));
      const requested = args.query?.trim().toUpperCase();
      const symbols = [...new Set([...(requested ? [requested] : []), "SPY", "QQQ", "IWM", ...watched.map((row) => row.symbol)])].slice(0, 10);
      const analyses = await Promise.all(symbols.map(async (symbol) => ({ symbol, result: await analyze(ctx, symbol, false) })));
      const spy = analyses.find((item) => item.result.instrument?.symbol === "SPY")?.result ?? null;
      const instruments = analyses.map(({ symbol, result }) => {
        if (result.status !== "ok" || !result.instrument || !result.factorModel) return { symbol, status: "unavailable" as const, asOf: null, return15d: null, alignmentScore: null, direction: null, activeFlags: 0, error: result.error ?? "Yahoo Finance data unavailable" };
        const tape = buildSignalTape(result, spy); return { symbol: result.instrument.symbol, status: "refreshed" as const, asOf: result.instrument.asOf, return15d: getMetric(result.returns, "15d"), alignmentScore: result.factorModel.score, direction: result.factorModel.direction, activeFlags: tape.filter((signal) => signal.active).length, error: null };
      });
      const available = instruments.filter((item) => item.status === "refreshed"); const advancing = available.filter((item) => (item.return15d ?? 0) > 0).length; const measured = available.filter((item) => item.return15d != null); const breadth15d = measured.length ? round(advancing / measured.length * 100) : null; const activeFlags = available.reduce((sum, item) => sum + item.activeFlags, 0); const highAlignment = available.filter((item) => Math.abs(item.alignmentScore ?? 0) >= 60).length;
      const riskRows = analyses.flatMap(({ result }) => { if (!result.instrument?.price) return []; const ret30 = getMetric(result.returns, "30d"); const atrValue = getMetric(result.indicators, "ATR 14"); if (ret30 == null || atrValue == null || atrValue <= 0) return []; return [{ symbol: result.instrument.symbol, score: ret30 / (atrValue / result.instrument.price * 100) }]; }).sort((a, b) => b.score - a.score); const leader = riskRows[0]?.symbol ?? null;
      const partial = available.length !== instruments.length; const synthesis = measured.length ? `${advancing} of ${measured.length} measured instruments have positive 15-session breadth${leader ? `; ${leader} leads the 30-session return ÷ ATR% stack` : ""}; ${activeFlags} testable setup flags are active.` : `Breadth is unavailable; ${activeFlags} testable setup flags are active from the instruments that refreshed.`;
      return { refreshedAt: new Date().toISOString(), synthesis, partial, breadth15d, activeFlags, highAlignment, leader, instruments };
    },
  }),
  verifySignalIssuanceControls: defineAction({
    request: z.object({}),
    response: z.object({
      testedAt: z.string(),
      pipeline: z.literal("recordSignal → exactYahooIssuanceCheck → tracked_signals insert"),
      cases: z.array(z.object({ symbol: z.string(), direction: z.enum(["long", "short"]), signalDate: z.string(), sourceUrl: z.string(), signalDay: z.object({ open: z.number(), high: z.number(), low: z.number(), close: z.number() }), invalidation: z.number(), suppressed: z.boolean(), reason: z.string().nullable(), trackerCountBefore: z.number(), trackerCountAfter: z.number(), trackerInsertAborted: z.boolean(), logged: z.boolean() })).length(2),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const definitions = [{ symbol: "SPY", direction: "long" as const, factorScore: 1 as const }, { symbol: "QQQ", direction: "short" as const, factorScore: -1 as const }];
      const cases = [] as Array<{ symbol: string; direction: "long" | "short"; signalDate: string; sourceUrl: string; signalDay: { open: number; high: number; low: number; close: number }; invalidation: number; suppressed: boolean; reason: string | null; trackerCountBefore: number; trackerCountAfter: number; trackerInsertAborted: boolean; logged: boolean }>;
      for (const definition of definitions) {
        const fetched = await yahooSeries(definition.symbol, "1y"); const signalDay = latestCompletedSignalDay(fetched.points);
        if (!signalDay || signalDay.open == null || signalDay.high == null || signalDay.low == null) throw new Error(`No exact completed Yahoo OHLC candle was available for ${definition.symbol}.`);
        const invalidation = definition.direction === "long" ? signalDay.low : signalDay.high;
        const factors: SignalFactor[] = [{ name: "Real issuance self-check", weight: 100, score: definition.factorScore, contribution: 100 * definition.factorScore, reading: "Forced candidate direction; validation still uses the exact Yahoo signal-day candle." }];
        const trackerCountBefore = (await db.select().from(schema.trackedSignals).where(and(eq(schema.trackedSignals.symbol, definition.symbol), eq(schema.trackedSignals.signalDate, signalDay.date)))).length;
        const riskPerUnit = Math.abs(signalDay.close - invalidation); const levels: FrozenLevels = { entryPrice: signalDay.close, stopPrice: invalidation, target1: signalDay.close + (definition.direction === "long" ? 1 : -1) * 1.5 * riskPerUnit, target2: signalDay.close + (definition.direction === "long" ? 1 : -1) * 2.5 * riskPerUnit, riskPerUnit, direction: definition.direction, atr14: riskPerUnit, invalidationAtrMultiple: 1, invalidationBasis: "Deliberate signal-day boundary self-check" };
        const result = await recordSignal(ctx, definition.symbol, `${definition.symbol} real-pipeline verification`, "Real issuance self-check", definition.direction, 100, signalDay.date, { factors, levels, sourceAsOf: newYorkCloseIso(signalDay.date), barTimestamp: newYorkCloseIso(signalDay.date), barState: "closed", sourceUrl: fetched.sourceUrl, exchangeCalendar: "XNYS", instrumentType: "ETF" });
        const trackerCountAfter = (await db.select().from(schema.trackedSignals).where(and(eq(schema.trackedSignals.symbol, definition.symbol), eq(schema.trackedSignals.signalDate, signalDay.date)))).length;
        const loggedRows = await db.select().from(schema.suppressedSignalCandidates).where(and(eq(schema.suppressedSignalCandidates.symbol, definition.symbol), eq(schema.suppressedSignalCandidates.signalDate, signalDay.date))).orderBy(desc(schema.suppressedSignalCandidates.createdAt));
        const logged = loggedRows.some((row) => row.direction === definition.direction && row.reason === result.suppressedReason && row.invalidationLevel === invalidation && row.signalDayOpen === signalDay.open && row.signalDayHigh === signalDay.high && row.signalDayLow === signalDay.low && row.signalDayClose === signalDay.close);
        cases.push({ symbol: definition.symbol, direction: definition.direction, signalDate: signalDay.date, sourceUrl: fetched.sourceUrl, signalDay: { open: signalDay.open, high: signalDay.high, low: signalDay.low, close: signalDay.close }, invalidation, suppressed: !result.recorded, reason: result.suppressedReason, trackerCountBefore, trackerCountAfter, trackerInsertAborted: !result.recorded && trackerCountAfter === trackerCountBefore, logged });
      }
      ctx.invalidateQueries();
      return { testedAt: new Date().toISOString(), pipeline: "recordSignal → exactYahooIssuanceCheck → tracked_signals insert" as const, cases };
    },
  }),
  getAutoScan: defineAction({ request: z.object({}), response: autoScanResponse, async handler(ctx): Promise<z.infer<typeof autoScanResponse>> { return readAutoScan(ctx); } }),
  populateUniverseTierBatch: defineAction({ request: z.object({ universe: z.enum(["sp100", "sp500"]), offset: z.number().int().min(0).max(1000), limit: z.number().int().min(1).max(50) }), response: tierBatchResponse, async handler(ctx, args): Promise<z.infer<typeof tierBatchResponse>> { return populateUniverseTierBatch(ctx, args); } }),
  populateUniverseTiers: defineAction({ request: z.object({ universe: z.enum(["sp100", "sp500"]), batchSize: z.number().int().min(1).max(50).default(50) }), response: tierPopulationStatusResponse, async handler(ctx, args): Promise<z.infer<typeof tierPopulationStatusResponse>> { return populateUniverseTiers(ctx, args); } }),
  getUniverseTierPopulationStatus: defineAction({ request: z.object({ universe: z.enum(["sp100", "sp500"]) }), response: tierPopulationStatusResponse, async handler(ctx, args): Promise<z.infer<typeof tierPopulationStatusResponse>> { return readUniverseTierPopulationStatus(ctx, args.universe); } }),
  getOpenSignalSummary: defineAction({
    request: z.object({}), response: openSignalSummaryResponse,
    async handler(ctx): Promise<z.infer<typeof openSignalSummaryResponse>> {
      const db = ctx.db<typeof schema>();
      // Select only the scalar fields the home renders. In particular, do not
      // deserialize factorBreakdownJson or attach the full snapshot history.
      const [rows, liveState] = await Promise.all([
        db.select({
          id: schema.trackedSignals.id,
          symbol: schema.trackedSignals.symbol,
          name: schema.trackedSignals.instrumentName,
          direction: schema.trackedSignals.direction,
          entryPrice: schema.trackedSignals.entryPrice,
          invalidationLevel: schema.trackedSignals.invalidationLevel,
          target1: schema.trackedSignals.target1,
          signalDate: schema.trackedSignals.signalDate,
          sourceAsOf: schema.trackedSignals.sourceAsOf,
        }).from(schema.trackedSignals).orderBy(desc(schema.trackedSignals.signalDate), desc(schema.trackedSignals.id)),
        readLiveTrackerState(ctx),
      ]);
      const open = rows.filter((row) => { const evaluation = liveState.current.get(`${row.id}|trade_setup`); return !evaluation || evaluation.verdict === "OPEN"; });
      const shown = open.slice(0, 12); const ids = shown.map((row) => row.id);
      const [snapshots, briefs] = await Promise.all([
        ids.length ? db.select({ signalId: schema.signalInterimSnapshots.signalId, currentPrice: schema.signalInterimSnapshots.currentPrice, returnPct: schema.signalInterimSnapshots.returnPct, daysOpen: schema.signalInterimSnapshots.daysSinceEntry, capturedAt: schema.signalInterimSnapshots.capturedAt }).from(schema.signalInterimSnapshots).where(inArray(schema.signalInterimSnapshots.signalId, ids)).orderBy(desc(schema.signalInterimSnapshots.capturedAt)) : Promise.resolve([]),
        db.select().from(schema.signalDailyBriefs).orderBy(desc(schema.signalDailyBriefs.sourceAsOf)).limit(1),
      ]);
      const latestBySignal = new Map<number, (typeof snapshots)[number]>();
      for (const snapshot of snapshots) if (!latestBySignal.has(snapshot.signalId)) latestBySignal.set(snapshot.signalId, snapshot);
      const brief = briefs[0]; const today = Date.now();
      return {
        generatedAt: new Date().toISOString(),
        totalOpen: liveState.openCount,
        latestBrief: brief ? { id: brief.id, capturedDay: brief.capturedDay, summary: withLiveTrackerCounts(brief.summary, liveState), trackedCount: liveState.trackedCount, approachingTargetCount: brief.approachingTargetCount, approachingInvalidationCount: brief.approachingInvalidationCount, sourceAsOf: brief.sourceAsOf.toISOString(), createdAt: brief.createdAt.toISOString() } : null,
        signals: shown.map((row) => {
          const snapshot = latestBySignal.get(row.id);
          const fallbackDays = Math.max(0, Math.floor((today - Date.parse(`${row.signalDate}T00:00:00Z`)) / 86400000));
          return { id: row.id, symbol: row.symbol, name: row.name, direction: row.direction, entryPrice: row.entryPrice, currentPrice: snapshot?.currentPrice ?? null, invalidationLevel: row.invalidationLevel, target1: row.target1, returnPct: snapshot?.returnPct ?? null, daysOpen: snapshot?.daysOpen ?? fallbackDays, signalDate: row.signalDate, sourceAsOf: row.sourceAsOf };
        }),
      };
    },
  }),
  getMarketDayBrief: defineAction({ request: z.object({}), response: marketDayBriefResponse, async handler(ctx): Promise<z.infer<typeof marketDayBriefResponse>> { return readMarketDayBriefCache(ctx); } }),
  refreshMarketDayBriefCache: defineAction({
    request: z.object({}), response: marketDayBriefResponse,
    async handler(ctx): Promise<z.infer<typeof marketDayBriefResponse>> {
      const run = (await ctx.db<typeof schema>().select({ id: schema.marketScanRuns.id }).from(schema.marketScanRuns).orderBy(desc(schema.marketScanRuns.createdAt)).limit(1))[0];
      if (!run) throw new Error("No completed market scan exists to prepare a market brief.");
      const brief = await writeMarketDayBriefCache(ctx, run.id); ctx.invalidateQueries(); return brief;
    },
  }),
  measureHomeReadLatencies: defineAction({
    request: z.object({ samples: z.number().int().min(5).max(100).default(40) }),
    response: z.object({ measuredAt: z.string(), sampleSize: z.number(), openSignalP95Ms: z.number(), marketBriefP95Ms: z.number(), openSignalPayloadBytes: z.number(), marketBriefPayloadBytes: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>(); const openSamples: number[] = []; const briefSamples: number[] = []; let openBytes = 0; let briefBytes = 0;
      for (let i = 0; i < args.samples; i++) {
        let started = performance.now();
        const [trackedRows, liveState] = await Promise.all([db.select({ id: schema.trackedSignals.id, symbol: schema.trackedSignals.symbol, name: schema.trackedSignals.instrumentName, direction: schema.trackedSignals.direction, entryPrice: schema.trackedSignals.entryPrice, invalidationLevel: schema.trackedSignals.invalidationLevel, signalDate: schema.trackedSignals.signalDate, sourceAsOf: schema.trackedSignals.sourceAsOf }).from(schema.trackedSignals).orderBy(desc(schema.trackedSignals.signalDate), desc(schema.trackedSignals.id)), readLiveTrackerState(ctx)]);
        const open = trackedRows.filter((row) => !liveState.settledIds.has(row.id));
        const ids = open.slice(0, 12).map((row) => row.id);
        const [snapshots, briefs] = await Promise.all([ids.length ? db.select({ signalId: schema.signalInterimSnapshots.signalId, currentPrice: schema.signalInterimSnapshots.currentPrice, returnPct: schema.signalInterimSnapshots.returnPct, daysOpen: schema.signalInterimSnapshots.daysSinceEntry }).from(schema.signalInterimSnapshots).where(inArray(schema.signalInterimSnapshots.signalId, ids)) : Promise.resolve([]), db.select().from(schema.signalDailyBriefs).orderBy(desc(schema.signalDailyBriefs.sourceAsOf)).limit(1)]);
        openSamples.push(performance.now() - started); if (!openBytes) openBytes = new TextEncoder().encode(JSON.stringify({ open: open.slice(0, 12), snapshots, brief: briefs[0] ?? null })).length;
        started = performance.now(); const brief = await readMarketDayBriefCache(ctx); briefSamples.push(performance.now() - started); if (!briefBytes) briefBytes = new TextEncoder().encode(JSON.stringify(brief)).length;
      }
      const p95 = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return round(sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0, 3); };
      return { measuredAt: new Date().toISOString(), sampleSize: args.samples, openSignalP95Ms: p95(openSamples), marketBriefP95Ms: p95(briefSamples), openSignalPayloadBytes: openBytes, marketBriefPayloadBytes: briefBytes };
    },
  }),
  getSourceJobs: defineAction({ request: z.object({}), response: sourceJobsResponse, async handler(ctx): Promise<z.infer<typeof sourceJobsResponse>> {
    const db = ctx.db<typeof schema>();
    const [finnhubNews, finnhubInsiders, finnhubEarnings, finnhubFilings, sentiment] = await Promise.all([db.select().from(schema.finnhubNewsSnapshots), db.select().from(schema.finnhubInsiderSnapshots), db.select().from(schema.finnhubEarningsSnapshots), db.select().from(schema.finnhubFilingSnapshots), db.select().from(schema.sentimentSnapshots)]);
    const uncapped = (used: number) => ({ used, cap: null, resets: "Provider plan; cap not exposed to this terminal" });
    const publicQuota = { used: null, cap: null, resets: "Public source; no declared terminal quota" };
    return { refreshedAt: new Date().toISOString(), jobs: [
      { source: "Yahoo Finance", job: "Adjusted prices, OHLC history and technical factor inputs", feeds: ["analyzeinstrument", "rundeepanalysis", "signal tape", "tracker"], quota: publicQuota },
      { source: "SEC EDGAR", job: "Issuer filings, insider transactions and ownership disclosures", feeds: ["dossier", "smart money", "alerts"], quota: publicQuota },
      { source: "Finnhub", job: "Stored symbol-keyed news, insiders, earnings and filings", feeds: ["news", "dossier", "theory evidence"], quota: uncapped(finnhubNews.length + finnhubInsiders.length + finnhubEarnings.length + finnhubFilings.length) },
      { source: "Alpha Vantage", job: "Stored news sentiment snapshots", feeds: ["theory evidence", "social context"], quota: uncapped(sentiment.length) },
      { source: "Stocktwits + Reddit", job: "Public ticker discussion and theory counter-signals", feeds: ["Theory Watch"], quota: publicQuota },
      { source: "BLS", job: "US labor and inflation macro diagnostics", feeds: ["theory discovery", "macro context"], quota: publicQuota },
      { source: "Polymarket", job: "Crowd-market discovery and event research", feeds: ["crowd markets", "event map"], quota: publicQuota },
      { source: "Web search", job: "Current news and source-linked context", feeds: ["getnews", "dossier", "deep analysis", "theory discovery"], quota: publicQuota },
      { source: "Wikipedia", job: "Index-constituent universe discovery", feeds: ["automated scan"], quota: publicQuota },
      { source: "Terminal database", job: "Signals, outcomes, theories, evidence and cached snapshots", feeds: ["tracker", "Theory Watch", "engine hits", "dossier"], quota: publicQuota },
    ] };
  } }),
  synthesizeMarketTheories: defineAction({
    request: z.object({}),
    response: z.object({ retired: z.literal(true), message: z.string() }),
    async handler(): Promise<{ retired: true; message: string }> {
      return { retired: true, message: "Terminal-internal synthesis is retired. Theory synthesis is now agent-led: the agent pulls evidence via discovertheories/getmarketread/getnews/etc. and writes theories via savetheory + attachtheoryevidence." };
    },
  }),
  storefinnhubnews: defineAction({
    request: z.object({ ticker: z.string().min(1).max(30), asOf: z.string().min(1).max(80), articles: z.array(finnhubNewsArticleInput).max(250) }),
    response: z.object({ ok: z.literal(true), ticker: z.string(), asOf: z.string(), articleCount: z.number(), historyCount: z.number(), freshForTheoryUse: z.boolean(), source: z.literal("Finnhub") }),
    async handler(ctx, args): Promise<{ ok: true; ticker: string; asOf: string; articleCount: number; historyCount: number; freshForTheoryUse: boolean; source: "Finnhub" }> {
      const ticker = args.ticker.trim().toUpperCase(); if (!ticker || (!/^[A-Z0-9.^=-]{1,30}$/.test(ticker) && ticker !== "MARKET")) throw new Error("Ticker is invalid; use MARKET for general news."); if (!Number.isFinite(Date.parse(args.asOf))) throw new Error("asOf must be a valid timestamp."); for (const article of args.articles) if (!Number.isFinite(Date.parse(article.publishedAt))) throw new Error(`publishedAt must be valid for article: ${article.headline.slice(0, 80)}`);
      const db = ctx.db<typeof schema>(); const now = new Date(); const payloadJson = JSON.stringify(args.articles);
      await db.insert(schema.finnhubNewsSnapshots).values({ ticker, asOf: args.asOf, articlesJson: payloadJson, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.finnhubNewsSnapshots.ticker, set: { asOf: args.asOf, articlesJson: payloadJson, updatedAt: now } });
      await db.insert(schema.finnhubNewsHistory).values({ ticker, asOf: args.asOf, payloadJson, capturedAt: now }).onConflictDoUpdate({ target: [schema.finnhubNewsHistory.ticker, schema.finnhubNewsHistory.asOf], set: { payloadJson, capturedAt: now } });
      const history = await db.select().from(schema.finnhubNewsHistory).where(eq(schema.finnhubNewsHistory.ticker, ticker)).orderBy(desc(schema.finnhubNewsHistory.asOf), desc(schema.finnhubNewsHistory.id)); for (const extra of history.slice(10)) await db.delete(schema.finnhubNewsHistory).where(eq(schema.finnhubNewsHistory.id, extra.id));
      ctx.invalidateQueries(); return { ok: true, ticker, asOf: args.asOf, articleCount: args.articles.length, historyCount: Math.min(10, history.length), freshForTheoryUse: isFreshWithin48Hours(args.asOf), source: "Finnhub" };
    },
  }),
  storefinnhubinsiders: defineAction({
    request: z.object({ ticker: z.string().min(1).max(30), asOf: z.string().min(1).max(80), transactions: z.array(finnhubInsiderTransactionInput).max(500) }),
    response: z.object({ ok: z.literal(true), ticker: z.string(), asOf: z.string(), transactionCount: z.number(), historyCount: z.number(), source: z.literal("Finnhub") }),
    async handler(ctx, args): Promise<{ ok: true; ticker: string; asOf: string; transactionCount: number; historyCount: number; source: "Finnhub" }> {
      const ticker = args.ticker.trim().toUpperCase(); if (!ticker) throw new Error("Ticker is required."); if (!Number.isFinite(Date.parse(args.asOf))) throw new Error("asOf must be a valid timestamp."); for (const transaction of args.transactions) if (!Number.isFinite(Date.parse(transaction.transactionDate)) || !Number.isFinite(Date.parse(transaction.filingDate))) throw new Error(`Transaction and filing dates must be valid for ${transaction.name}.`);
      const db = ctx.db<typeof schema>(); const now = new Date(); const payloadJson = JSON.stringify(args.transactions);
      await db.insert(schema.finnhubInsiderSnapshots).values({ ticker, asOf: args.asOf, transactionsJson: payloadJson, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.finnhubInsiderSnapshots.ticker, set: { asOf: args.asOf, transactionsJson: payloadJson, updatedAt: now } });
      await db.insert(schema.finnhubInsiderHistory).values({ ticker, asOf: args.asOf, payloadJson, capturedAt: now }).onConflictDoUpdate({ target: [schema.finnhubInsiderHistory.ticker, schema.finnhubInsiderHistory.asOf], set: { payloadJson, capturedAt: now } });
      const history = await db.select().from(schema.finnhubInsiderHistory).where(eq(schema.finnhubInsiderHistory.ticker, ticker)).orderBy(desc(schema.finnhubInsiderHistory.asOf), desc(schema.finnhubInsiderHistory.id)); for (const extra of history.slice(10)) await db.delete(schema.finnhubInsiderHistory).where(eq(schema.finnhubInsiderHistory.id, extra.id));
      ctx.invalidateQueries(); return { ok: true, ticker, asOf: args.asOf, transactionCount: args.transactions.length, historyCount: Math.min(10, history.length), source: "Finnhub" };
    },
  }),
  storefinnhubearnings: defineAction({
    request: z.object({ asOf: z.string().min(1).max(80), events: z.array(finnhubEarningsEventInput).max(1000) }),
    response: z.object({ ok: z.literal(true), asOf: z.string(), eventCount: z.number(), symbolCount: z.number(), source: z.literal("Finnhub") }),
    async handler(ctx, args): Promise<{ ok: true; asOf: string; eventCount: number; symbolCount: number; source: "Finnhub" }> {
      if (!Number.isFinite(Date.parse(args.asOf))) throw new Error("asOf must be a valid timestamp."); for (const event of args.events) if (!Number.isFinite(Date.parse(event.date))) throw new Error(`Earnings date must be valid for ${event.symbol}.`);
      const grouped = new Map<string, FinnhubEarningsEvent[]>(); for (const event of args.events) { const symbol = event.symbol.trim().toUpperCase(); if (!symbol) continue; grouped.set(symbol, [...(grouped.get(symbol) ?? []), { ...event, symbol }]); }
      const db = ctx.db<typeof schema>(); const now = new Date();
      for (const [symbol, events] of grouped) { const payloadJson = JSON.stringify(events); await db.insert(schema.finnhubEarningsSnapshots).values({ symbol, asOf: args.asOf, eventsJson: payloadJson, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.finnhubEarningsSnapshots.symbol, set: { asOf: args.asOf, eventsJson: payloadJson, updatedAt: now } }); await db.insert(schema.finnhubEarningsHistory).values({ symbol, asOf: args.asOf, payloadJson, capturedAt: now }).onConflictDoUpdate({ target: [schema.finnhubEarningsHistory.symbol, schema.finnhubEarningsHistory.asOf], set: { payloadJson, capturedAt: now } }); const history = await db.select().from(schema.finnhubEarningsHistory).where(eq(schema.finnhubEarningsHistory.symbol, symbol)).orderBy(desc(schema.finnhubEarningsHistory.asOf), desc(schema.finnhubEarningsHistory.id)); for (const extra of history.slice(10)) await db.delete(schema.finnhubEarningsHistory).where(eq(schema.finnhubEarningsHistory.id, extra.id)); }
      ctx.invalidateQueries(); return { ok: true, asOf: args.asOf, eventCount: args.events.length, symbolCount: grouped.size, source: "Finnhub" };
    },
  }),
  storefinnhubfilings: defineAction({
    request: z.object({ ticker: z.string().min(1).max(30), asOf: z.string().min(1).max(80), filings: z.array(finnhubFilingInput).max(500) }),
    response: z.object({ ok: z.literal(true), ticker: z.string(), asOf: z.string(), filingCount: z.number(), historyCount: z.number(), source: z.literal("Finnhub") }),
    async handler(ctx, args): Promise<{ ok: true; ticker: string; asOf: string; filingCount: number; historyCount: number; source: "Finnhub" }> {
      const ticker = args.ticker.trim().toUpperCase(); if (!ticker) throw new Error("Ticker is required."); if (!Number.isFinite(Date.parse(args.asOf))) throw new Error("asOf must be a valid timestamp."); for (const filing of args.filings) if (!Number.isFinite(Date.parse(filing.filedDate)) || !Number.isFinite(Date.parse(filing.acceptedDate))) throw new Error(`Filed and accepted dates must be valid for ${filing.form}.`);
      const db = ctx.db<typeof schema>(); const now = new Date(); const payloadJson = JSON.stringify(args.filings);
      await db.insert(schema.finnhubFilingSnapshots).values({ ticker, asOf: args.asOf, filingsJson: payloadJson, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.finnhubFilingSnapshots.ticker, set: { asOf: args.asOf, filingsJson: payloadJson, updatedAt: now } });
      await db.insert(schema.finnhubFilingHistory).values({ ticker, asOf: args.asOf, payloadJson, capturedAt: now }).onConflictDoUpdate({ target: [schema.finnhubFilingHistory.ticker, schema.finnhubFilingHistory.asOf], set: { payloadJson, capturedAt: now } });
      const history = await db.select().from(schema.finnhubFilingHistory).where(eq(schema.finnhubFilingHistory.ticker, ticker)).orderBy(desc(schema.finnhubFilingHistory.asOf), desc(schema.finnhubFilingHistory.id)); for (const extra of history.slice(10)) await db.delete(schema.finnhubFilingHistory).where(eq(schema.finnhubFilingHistory.id, extra.id));
      ctx.invalidateQueries(); return { ok: true, ticker, asOf: args.asOf, filingCount: args.filings.length, historyCount: Math.min(10, history.length), source: "Finnhub" };
    },
  }),
  storesentimentsnapshot: defineAction({
    request: z.object({ ticker: z.string().min(1).max(20), asOf: z.string().min(1).max(80), articles: z.array(sentimentArticleInput).max(100) }),
    response: z.object({ ok: z.literal(true), ticker: z.string(), asOf: z.string(), articleCount: z.number(), historyCount: z.number(), freshForTheoryUse: z.boolean(), source: z.literal("Alpha Vantage") }),
    async handler(ctx, args): Promise<{ ok: true; ticker: string; asOf: string; articleCount: number; historyCount: number; freshForTheoryUse: boolean; source: "Alpha Vantage" }> {
      const ticker = args.ticker.trim().toUpperCase(); if (!ticker) throw new Error("Ticker is required."); const parsedAsOf = Date.parse(args.asOf); if (!Number.isFinite(parsedAsOf)) throw new Error("asOf must be a valid timestamp.");
      for (const article of args.articles) { if (!Number.isFinite(Date.parse(article.publishedAt))) throw new Error(`publishedAt must be valid for article: ${article.title.slice(0, 80)}`); }
      const db = ctx.db<typeof schema>(); const now = new Date(); const articlesJson = JSON.stringify(args.articles);
      await db.insert(schema.sentimentSnapshots).values({ ticker, asOf: args.asOf, articlesJson, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.sentimentSnapshots.ticker, set: { asOf: args.asOf, articlesJson, updatedAt: now } });
      await db.insert(schema.sentimentSnapshotHistory).values({ ticker, asOf: args.asOf, articlesJson, capturedAt: now }).onConflictDoUpdate({ target: [schema.sentimentSnapshotHistory.ticker, schema.sentimentSnapshotHistory.asOf], set: { articlesJson, capturedAt: now } });
      const history = await db.select().from(schema.sentimentSnapshotHistory).where(eq(schema.sentimentSnapshotHistory.ticker, ticker)).orderBy(desc(schema.sentimentSnapshotHistory.asOf), desc(schema.sentimentSnapshotHistory.id));
      for (const extra of history.slice(10)) await db.delete(schema.sentimentSnapshotHistory).where(eq(schema.sentimentSnapshotHistory.id, extra.id));
      const [userTheories, predictions, machineTheories] = await Promise.all([db.select().from(schema.theories), db.select().from(schema.theoryPredictions), db.select().from(schema.machineTheories)]);
      for (const theory of userTheories.filter((row) => jsonStrings(row.linkedTickersJson).includes(ticker))) { const theoryPredictions = predictions.filter((prediction) => prediction.theoryId === theory.id); await syncSentimentEvidence(ctx, "user", theory.id, jsonStrings(theory.linkedTickersJson), theoryDirectionFromPredictions(theoryPredictions)); }
      for (const theory of machineTheories.filter((row) => row.primarySymbol.toUpperCase() === ticker || row.rivalSymbol?.toUpperCase() === ticker)) await syncSentimentEvidence(ctx, "machine", theory.id, [theory.primarySymbol, ...(theory.rivalSymbol ? [theory.rivalSymbol] : [])], theory.expectedDirection);
      ctx.invalidateQueries(); return { ok: true, ticker, asOf: args.asOf, articleCount: args.articles.length, historyCount: Math.min(10, history.length), freshForTheoryUse: isFreshSentimentAsOf(args.asOf), source: "Alpha Vantage" };
    },
  }),
  getEngineHits: defineAction({ request: z.object(pageRequestFields), response: engineHitsResponse, async handler(ctx, args): Promise<z.infer<typeof engineHitsResponse>> { return readEngineHits(ctx, args.limit ?? 20, args.cursor); } }),
  bootstrapEngineHits: defineAction({ request: z.object({}), response: z.object({ ok: z.literal(true), hits: z.number() }), async handler(ctx): Promise<{ ok: true; hits: number }> { await seedFirstEngineHit(ctx); const result = await readEngineHits(ctx); return { ok: true, hits: result.hits.length }; } }),
  getRadar: defineAction({
    request: z.object({}), response: radarResponse,
    async handler(ctx): Promise<z.infer<typeof radarResponse>> {
      const db = ctx.db<typeof schema>();
      const [signals, runs, tracked] = await Promise.all([
        db.select().from(schema.marketScanSignals).orderBy(desc(schema.marketScanSignals.id)),
        db.select().from(schema.marketScanRuns),
        db.select().from(schema.trackedSignals).orderBy(desc(schema.trackedSignals.signalDate)),
      ]);
      const runMap = new Map(runs.map((run) => [run.id, run]));
      const qualifyingScans = signals.filter((row) => Math.abs(row.agreementScore) >= 90);
      const scanItems: z.infer<typeof radarResponse>["items"] = qualifyingScans.flatMap((row) => {
        const run = runMap.get(row.runId); const factors = normalizeSignalFactors(parseScanFactors(row.factorBreakdownJson));
        const measured = parseScanDimensions(row.dimensionsJson).filter((dimension) => dimension.status !== "research").length;
        const complete = factors.length > 0 && measured === 5 && row.invalidationLevel != null && row.sourceAsOf != null && row.sourceUrl != null && row.direction !== "mixed";
        return run && complete ? [{ id: row.id, origin: "scan" as const, runId: row.runId, universe: run.universe, scanCreatedAt: run.createdAt.toISOString(), symbol: row.symbol, name: row.instrumentName, sector: row.sector, direction: row.direction, agreementScore: row.agreementScore, rawScore: null, redundancyAdjustment: null, confidenceTier: row.confidenceTier, invalidationLevel: row.invalidationLevel, sourceAsOf: row.sourceAsOf, sourceUrl: row.sourceUrl, factors, formula: "100 × supporting dimensions ÷ 5 required dimensions; unavailable evidence remains in the denominator" }] : [];
      });
      const qualifyingTracked = tracked.flatMap((row) => {
        const factors = normalizeSignalFactors(parseScanFactors(row.factorBreakdownJson)); const scoring = factorScoreBreakdown(factors);
        return scoring != null && Math.abs(scoring.score) >= 90 ? [{ row, factors, scoring }] : [];
      });
      const trackedItems: z.infer<typeof radarResponse>["items"] = qualifyingTracked.flatMap(({ row, factors, scoring }) => { const score = scoring.score;
        const complete = row.invalidationLevel != null && row.sourceAsOf != null && row.sourceUrl != null;
        return complete ? [{ id: row.id, origin: "tracker" as const, runId: null, universe: null, scanCreatedAt: row.createdAt.toISOString(), symbol: row.symbol, name: row.instrumentName, sector: null, direction: row.direction, agreementScore: score, rawScore: scoring.rawScore, redundancyAdjustment: scoring.redundancyAdjustment, confidenceTier: Math.abs(score) === 100 ? "high" as const : "medium" as const, invalidationLevel: row.invalidationLevel, sourceAsOf: row.sourceAsOf, sourceUrl: row.sourceUrl, factors, formula: "Raw = 100 × Σ(weight × score) ÷ Σ(weights). Fully aligned SMA-20/50/200 + MACD + ATR-adjusted 30-session trend receives a 5-point toward-zero redundancy adjustment; factor scores are −1, 0, or +1." }] : [];
      });
      const items = [...trackedItems, ...scanItems].sort((a, b) => b.scanCreatedAt.localeCompare(a.scanCreatedAt));
      const omittedUnverifiable = (qualifyingScans.length - scanItems.length) + (qualifyingTracked.length - trackedItems.length);
      const latestRun = [...runs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const exclusions = latestRun ? parseExclusions(latestRun.exclusionsJson) : [];
      const universe = latestRun ? { name: latestRun.universe, status: latestRun.status === "failed" && latestRun.scannedCount > 0 && latestRun.availableCount === 0 ? "degraded" as const : latestRun.status, note: latestRun.note, requestedCount: latestRun.requestedCount, scannedCount: latestRun.scannedCount, availableCount: latestRun.availableCount, signalCount: latestRun.signalCount, excludedCount: Math.max(0, latestRun.requestedCount - latestRun.availableCount), exclusions } : null;
      return { items, universe, threshold: 90, omittedUnverifiable, omissionRule: "A 90+ row is excluded only when its retained score evidence is incomplete: tracker rows require a non-empty weighted factor ledger, invalidation level, source timestamp, and source URL; scan rows additionally require all five scan dimensions measured and a non-mixed direction." };
    }
  }),
  runAutomatedScan: defineAction({ request: z.object({ universe: z.enum(["sp100", "sp500"]) }), response: autoScanResponse, async handler(ctx, args): Promise<z.infer<typeof autoScanResponse>> { return runAutomatedMarketScan(ctx, args.universe); } }),
  getInstrumentSignals: signalTapeAction,
  getNews: defineAction({ request: z.object({ scope: z.enum(["coin", "discovery"]).optional(), view: z.enum(["symbol", "discovery"]).optional(), symbol: z.string().min(1).max(30), coinId: z.string().max(80).optional(), name: z.string().max(160).optional(), ...pageRequestFields }), response: z.object({ view: z.enum(["symbol", "discovery"]), scope: z.enum(["coin", "discovery"]), symbol: z.string().nullable(), resolvedCoinId: z.string(), retrievedAt: z.string(), items: z.array(newsItemSchema), nextCursor: z.number().nullable() }), async handler(ctx, args) {
    const view = args.scope === "discovery" || args.view === "discovery" ? "discovery" as const : "symbol" as const; const symbol = args.symbol.trim().toUpperCase();
    const result = await marketNews(ctx, view, view === "symbol" ? symbol : null, args.name ?? null); const page = pageSlice(result.items, args.limit ?? 12, args.cursor);
    return { ...result, scope: view === "symbol" ? "coin" as const : "discovery" as const, resolvedCoinId: args.coinId?.trim() || symbol, items: page.items, nextCursor: page.nextCursor };
  } }),
  getpolymarkethint: defineAction({ request: z.object({ query: z.string().min(2).max(180) }), response: polymarketHintResponse, async handler(_ctx, args): Promise<z.infer<typeof polymarketHintResponse>> { return getPolymarketHintInternal(args.query); } }),
  searchCrowdMarkets: defineAction({ request: z.object({ query: z.string().min(2).max(180) }), response: crowdMarketSearchResponse, async handler(_ctx, args): Promise<z.infer<typeof crowdMarketSearchResponse>> { return searchCrowdMarkets(args.query); } }),
  researchCrowdMarket: defineAction({ request: z.object({ query: z.string().min(2).max(180), slug: z.string().min(1).max(240) }), response: crowdMarketResearchResponse, async handler(ctx, args): Promise<z.infer<typeof crowdMarketResearchResponse>> { return researchCrowdMarket(ctx, args.query, args.slug); } }),
  discoverTheories: defineAction({ request: z.object({}), response: z.object({ status: z.enum(["ok", "degraded", "failed"]), note: z.string(), candidateCount: z.number(), surfacedCount: z.number(), withheldFloorCount: z.number(), contestedCount: z.number(), checkedAt: z.string() }), async handler(ctx): Promise<TheoryDiscoveryResult> { return collectTheoryDiscoveryEvidence(ctx); } }),
  getBlsMacroDiagnostics: defineAction({
    request: z.object({}),
    response: z.object({ methodology: z.string(), sources: z.array(z.object({ title: z.string(), snippet: z.string(), asOf: z.string().nullable() })), insufficientHistoryCheck: z.object({ state: z.enum(["available", "no_data"]), reason: z.string().nullable() }) }),
    async handler(ctx) {
      const sources = await blsMacroEvidence(ctx, [BLS_SERIES.unemployment, BLS_SERIES.cpi]);
      const insufficient = blsTrendAnalysis(Array.from({ length: 6 }, (_, index) => ({ asOf: `2026-0${index + 1}`, value: index })));
      return { methodology: "OLS slope over equally spaced monthly observations. Acceleration is latest 3-month OLS slope minus the immediately preceding 3-month OLS slope. Inflection requires a 3-month slope sign flip and an absolute latest monthly delta above the population standard deviation of the latest 24 monthly deltas. Evidence is unscored unless separately promoted through the standard factor gates.", sources: sources.map((source) => ({ title: source.title, snippet: source.snippet, asOf: source.publishedAt })), insufficientHistoryCheck: { state: insufficient.state, reason: insufficient.reason } };
    },
  }),
  auditTheoryIntegrity: defineAction({ request: z.object({}), response: z.object({ audited: z.number(), singleSourceFlagged: z.number(), bornBreachedFound: z.number(), invalidatedReverted: z.number(), tripwiresCorrected: z.number(), tripwiresRemoved: z.number() }), async handler(ctx): Promise<TheoryIntegrityAudit> { const result = await auditExistingTheoryIntegrity(ctx, true); ctx.invalidateQueries(); return result; } }),
  listMachineTheories: defineAction({
    request: z.object(pageRequestFields),
    response: z.object({ theories: z.array(machineTheoryView), run: z.object({ status: z.enum(["ok", "degraded", "failed"]), note: z.string(), sourceCount: z.number(), candidateCount: z.number(), surfacedCount: z.number(), withheldFloorCount: z.number(), contestedCount: z.number(), startedAt: z.string(), finishedAt: z.string() }).nullable(), refreshedAt: z.string(), nextCursor: z.number().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [rows, runs, storedSentimentRows] = await Promise.all([
        db.select().from(schema.machineTheories).orderBy(desc(schema.machineTheories.checkedAt)),
        db.select().from(schema.theoryDiscoveryRuns).orderBy(desc(schema.theoryDiscoveryRuns.finishedAt)),
        db.select().from(schema.theorySentimentEvidence).where(eq(schema.theorySentimentEvidence.theoryKind, "machine")).orderBy(desc(schema.theorySentimentEvidence.createdAt)),
      ]);
      const repairedRows = await repairStoredTheoryEvidence(ctx, rows);
      // This is a read path: attach the evidence rows already persisted for each
      // theory instead of rebuilding (and potentially deleting) them on load.
      // Snapshot time, not row creation time, controls the strict 48-hour gate.
      const freshSentimentByTheory = new Map<number, Array<typeof schema.theorySentimentEvidence.$inferSelect>>();
      for (const item of storedSentimentRows) {
        if (!isFreshSentimentAsOf(item.snapshotAsOf)) continue;
        const existing = freshSentimentByTheory.get(item.theoryId) ?? [];
        existing.push(item);
        freshSentimentByTheory.set(item.theoryId, existing);
      }
      const surfacedRows = repairedRows.filter((row) => row.status === "invalidated" || scoreTheoryLayers(parseLayers(row.layersJson)).evidenceFloorMet).map((row) => { const score = scoreTheoryLayers(parseLayers(row.layersJson)); if (row.status === "invalidated") return { ...row, directionalPick: "none" as const }; return { ...row, status: (!score.evidenceFloorMet ? "degraded" : score.measuredConflict ? "contested" : "live") as "live" | "contested" | "degraded", directionalPick: (score.directionalPickAllowed ? row.expectedDirection : "none") as "long" | "short" | "none", confidenceTier: score.confidenceTier }; });
      const positioning = await machineTheoryPositioning(ctx, surfacedRows);
      const run = runs[0]; const summary = run ? theoryRunSummary(run, repairedRows) : null; const mapped = surfacedRows.map((row) => mapMachineTheory(row, positioning.get(row.id) ?? buildTheoryPositioning(null, row), freshSentimentByTheory.get(row.id) ?? [])); const page = pageSlice(mapped, args.limit ?? 20, args.cursor);
      return {
        theories: page.items,
        run: run && summary ? { status: run.status, note: summary.note, sourceCount: run.sourceCount, candidateCount: run.candidateCount, surfacedCount: summary.surfacedCount, withheldFloorCount: summary.withheldFloorCount, contestedCount: summary.contestedCount, startedAt: run.startedAt.toISOString(), finishedAt: run.finishedAt.toISOString() } : null,
        refreshedAt: new Date().toISOString(), nextCursor: page.nextCursor,
      };
    },
  }),
  mapEventAction: defineAction({ request: z.object({ scenario: z.string().min(8).max(800) }), response: eventMapResponse, async handler(ctx, args) { return buildEventMap(ctx, args.scenario); } }),
  getSocialChatter: defineAction({ request: z.object({ ticker: z.string().min(1).max(20), theoryDirection: z.enum(["long", "short", "none"]) }), response: socialChatterResponse, async handler(_ctx, args): Promise<z.infer<typeof socialChatterResponse>> { return fetchSocialChatter(args.ticker, args.theoryDirection); } }),
  getSocialChatterBulk: defineAction({ request: z.object({ items: z.array(z.object({ ticker: z.string().min(1).max(20), theoryDirection: z.enum(["long", "short", "none"]) })).max(50) }), response: z.object({ items: z.array(z.object({ ticker: z.string(), data: socialChatterResponse })) }), async handler(_ctx, args) { const unique = [...new Map(args.items.map((item) => [`${item.ticker.toUpperCase()}|${item.theoryDirection}`, item])).values()]; const rows = await Promise.all(unique.map(async (item) => ({ ticker: item.ticker.toUpperCase(), data: await fetchSocialChatter(item.ticker, item.theoryDirection) }))); return { items: rows }; } }),
  getDossierSynthesis: defineAction({ request: z.object({ symbol: z.string().min(1).max(30), coinId: z.string().max(80).optional(), name: z.string().min(1).max(160).optional() }), response: dossierSynthesisResponse, async handler(ctx, args): Promise<z.infer<typeof dossierSynthesisResponse>> {
    const symbol = args.symbol.trim().toUpperCase(); const companyName = args.name?.trim() || symbol; const memo = dossierMemo.get(symbol); if (memo && memo.expiresAt > Date.now()) return memo.value;
    const generatedAt = new Date().toISOString(); const db = ctx.db<typeof schema>();
    const [analysisResult, newsResult, contextSearch, trackedRows, snapshotRows, evaluationRows, machineRows, savedTheoryRows] = await Promise.all([
      analyze(ctx, symbol, false, true),
      marketNews(ctx, "symbol", symbol, companyName).catch(() => null),
      ctx.tool.web_search(`${symbol} ${companyName} direct competitors peer comparison sector supply chain macro risks 2026`).catch(() => null),
      db.select().from(schema.trackedSignals).where(eq(schema.trackedSignals.symbol, symbol)).orderBy(desc(schema.trackedSignals.signalDate)),
      db.select().from(schema.signalInterimSnapshots).where(eq(schema.signalInterimSnapshots.symbol, symbol)).orderBy(desc(schema.signalInterimSnapshots.capturedAt)),
      db.select().from(schema.signalEvaluationRevisions).orderBy(asc(schema.signalEvaluationRevisions.id)),
      db.select().from(schema.machineTheories).orderBy(desc(schema.machineTheories.checkedAt)),
      theoryRows(ctx).catch(() => []),
    ]);
    const relevantMachine = machineRows.filter((row) => row.primarySymbol.toUpperCase() === symbol || row.rivalSymbol?.toUpperCase() === symbol).slice(0, 8);
    const relevantSaved = savedTheoryRows.filter((row) => row.linkedTickers.some((ticker) => ticker.toUpperCase() === symbol)).slice(0, 8);
    const contextRows = (contextSearch?.content?.results ?? []).filter((row) => !row.is_index_page && row.url).slice(0, 12);
    const allStories = sortNewsItems(newsResult?.items ?? []);
    const betterStories = allStories.filter((story) => story.tier !== "LOW_TIER");
    const stories = (betterStories.length ? betterStories : allStories.filter((story) => story.tier === "LOW_TIER")).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).slice(0, 8);

    const institutionalErrors: string[] = []; let issuerCik = "";
    try { const map = await secJson<Record<string, { cik_str: number; ticker: string; title: string }>>("https://www.sec.gov/files/company_tickers.json"); const match = Object.values(map).find((row) => row.ticker.toUpperCase() === symbol); issuerCik = match ? String(match.cik_str).padStart(10, "0") : ""; if (!issuerCik) institutionalErrors.push("SEC issuer mapping was not found."); }
    catch { institutionalErrors.push("SEC issuer mapping was unavailable."); }
    const holdingSettled = await Promise.allSettled(managers.map((manager) => managerHolding(manager, companyName)));
    const holdings = holdingSettled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []).slice(0, 10);
    if (holdingSettled.some((result) => result.status === "rejected")) institutionalErrors.push("Some marquee-manager 13F filings were unavailable.");
    let insiders: Awaited<ReturnType<typeof insiderRows>> = []; const activists: Array<{ form: string; filingDate: string; reportDate: string; filer: string; sourceUrl: string }> = [];
    if (issuerCik) {
      try { insiders = await insiderRows(issuerCik); } catch { institutionalErrors.push("Recent Form 4 transactions were unavailable."); }
      try { const submission = await secJson<SecSubmission>(`https://data.sec.gov/submissions/CIK${issuerCik}.json`); const recent = submission.filings?.recent; if (recent) for (let index = 0; index < recent.form.length && activists.length < 6; index++) { const form = recent.form[index] ?? ""; if (!/^SC 13[DG](\/A)?$/.test(form)) continue; const accession = recent.accessionNumber[index] ?? ""; const primary = recent.primaryDocument[index] ?? ""; if (!accession || !primary) continue; const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(issuerCik)}/${accession.replace(/-/g, "")}/${primary.split("/").pop() ?? primary}`; let filer = "Reporting person unavailable"; try { filer = reportingPersonName(await secText(sourceUrl)) ?? filer; } catch { /* keep explicit unavailable */ } activists.push({ form, filingDate: recent.filingDate[index] ?? "date unavailable", reportDate: recent.reportDate[index] ?? "date unavailable", filer, sourceUrl }); } } catch { institutionalErrors.push("Recent Schedule 13D/13G filings were unavailable."); }
    }
    let congressional: Array<{ title: string; source: string; snippet: string; publishedAt: string | null; url: string }> = [];
    try { const result = await ctx.tool.web_search(`${symbol} congressional stock trade disclosure House Senate periodic transaction report`); congressional = (result.content?.results ?? []).filter((row) => !row.is_index_page && row.url).slice(0, 6).map((row) => ({ title: row.title, source: row.source ?? "Unknown source", snippet: row.snippet ?? "", publishedAt: row.published_at, url: row.url ?? "" })); }
    catch { institutionalErrors.push("Congressional disclosure search was unavailable."); }

    const sources: CompletePictureSource[] = []; const sourceIndexById = new Map<string, number>();
    const addSource = (source: Omit<CompletePictureSource, "id">): string => { const dedupeKey = source.url ?? `${source.kind}|${source.title}|${source.asOf ?? ""}`; const found = sources.find((item) => (item.url ?? `${item.kind}|${item.title}|${item.asOf ?? ""}`) === dedupeKey); if (found) return found.id; const id = `S${sources.length + 1}`; sources.push({ id, ...source }); sourceIndexById.set(id, sources.length); return id; };
    const marketUrl = analysisResult.instrument?.sources[0]?.url ?? null;
    const marketSourceId = addSource({ title: `${symbol} adjusted-price and factor ledger`, detail: analysisResult.factorModel ? `${analysisResult.factorModel.formula}; ${analysisResult.factorModel.factors.map((factor) => `${factor.name} ${factor.score > 0 ? "+" : ""}${factor.score} (${factor.reading})`).join("; ")}` : "Factor ledger unavailable.", kind: "market", url: marketUrl, asOf: analysisResult.instrument?.asOf ?? null });
    const deterministic = new Map<string, CompletePictureClaim[]>(); const pushClaim = (lane: string, claim: CompletePictureClaim) => deterministic.set(lane, [...(deterministic.get(lane) ?? []), claim]);
    if (analysisResult.factorModel) { const model = analysisResult.factorModel; pushClaim("direction", { text: `${model.direction.toUpperCase()} factor agreement ${model.score >= 0 ? "+" : ""}${model.score}/100. This is factor agreement, not a probability. ${model.factors.filter((factor) => factor.score > 0).length} factors support, ${model.factors.filter((factor) => factor.score < 0).length} conflict, and ${model.factors.filter((factor) => factor.score === 0).length} are neutral.`, sourceIds: [marketSourceId] }); }
    if (analysisResult.walkForward) { pushClaim("direction", { text: analysisResult.walkForward.qualified ? `Walk-forward record: ${analysisResult.walkForward.observations} historical decisions, ${analysisResult.walkForward.hitRate == null ? "hit rate unavailable" : `${analysisResult.walkForward.hitRate}% directional hit rate`}, and ${analysisResult.walkForward.averageDirectionalReturn == null ? "average return unavailable" : `${analysisResult.walkForward.averageDirectionalReturn >= 0 ? "+" : ""}${analysisResult.walkForward.averageDirectionalReturn}% average directional return`}.` : `Walk-forward confidence WITHHELD: ${analysisResult.walkForward.observations} historical decisions; 20 are required.`, sourceIds: [marketSourceId] }); }
    const acceptedDossierEvaluations = acceptedEvaluationRevisions(evaluationRows);
    for (const row of trackedRows.slice(0, 12)) { const snapshot = snapshotRows.find((item) => item.signalId === row.id); const setup = acceptedDossierEvaluations.get(`${row.id}|trade_setup`); const direction = acceptedDossierEvaluations.get(`${row.id}|direction_forecast`); const signalSourceId = addSource({ title: `${symbol} tracked ${row.setupType} signal`, detail: `Frozen ${row.signalDate} at ${row.entryPrice}; direction ${row.direction}; retained factor score ${row.confidence}; setup ${setup?.verdict ?? "OPEN"}; fixed ${row.primaryHorizon}-${row.horizonUnit} direction ${direction?.verdict ?? "OPEN"}${direction?.grossReturnPct == null ? "" : `; gross return ${direction.grossReturnPct >= 0 ? "+" : ""}${direction.grossReturnPct}%`}${snapshot ? `; latest non-settling snapshot ${snapshot.returnPct >= 0 ? "+" : ""}${snapshot.returnPct}% on ${snapshot.capturedDay}` : ""}.`, kind: "terminal", url: row.sourceUrl, asOf: row.sourceAsOf ?? row.signalDate }); pushClaim("signals", { text: `${row.signalDate} ${row.setupType} ${row.direction.toUpperCase()} from frozen reference ${row.entryPrice}: trade setup ${setup?.verdict ?? "OPEN"} (${setup?.reason ?? "awaiting versioned evaluation"}); ${row.primaryHorizon}-${row.horizonUnit} direction ${direction?.verdict ?? "OPEN"}${direction?.grossReturnPct == null ? "" : ` at ${direction.grossReturnPct >= 0 ? "+" : ""}${direction.grossReturnPct}% gross`}. Costs ${direction?.costStatus ?? "unknown"}.`, sourceIds: [signalSourceId] }); }
    for (const story of stories.slice(0, 6)) {
      const publishedMs = Date.parse(story.publishedAt); const ageMs = Number.isFinite(publishedMs) ? Date.now() - publishedMs : Number.POSITIVE_INFINITY;
      const dateText = Number.isFinite(publishedMs) ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(publishedMs)) : "DATE UNAVAILABLE";
      const staleText = ageMs > 7 * 86400000 ? " · STALE" : ""; const lowTierText = story.tier === "LOW_TIER" ? " · LOW-TIER SOURCE" : "";
      const id = addSource({ title: `${story.source} · ${story.title}`, detail: `${story.whyItMatters} ${story.confirmation}${lowTierText}`, kind: "news", url: story.url, asOf: story.publishedAt });
      pushClaim("news", { text: `[${dateText}${staleText}${lowTierText}] ${story.title} — ${story.whyItMatters}`, sourceIds: [id] });
    }
    for (const holding of holdings.slice(0, 6)) { const id = addSource({ title: `${holding.manager} 13F information table`, detail: `${holding.reportDate} quarter; filed ${holding.filingDate}; ${holding.change}; ${holding.shares} shares; value ${holding.value}. 13F data can be up to 45 days delayed.`, kind: "filing", url: holding.sourceUrl, asOf: holding.filingDate }); pushClaim("smart_money", { text: `${holding.manager}: ${holding.change} to ${holding.shares.toLocaleString()} shares in the ${holding.reportDate} report. 13F is delayed, not live positioning.`, sourceIds: [id] }); }
    for (const row of insiders.slice(0, 5)) { const id = addSource({ title: `Form 4 · ${row.owner}`, detail: `${row.type} ${row.shares} shares on ${row.date}${row.price == null ? "" : ` at ${row.price}`}.`, kind: "filing", url: row.sourceUrl, asOf: row.date }); pushClaim("smart_money", { text: `${row.owner} (${row.title}) filed an open-market ${row.type.toLowerCase()} for ${row.shares.toLocaleString()} shares on ${row.date}.`, sourceIds: [id] }); }
    for (const row of activists.slice(0, 4)) { const id = addSource({ title: `${row.form} · ${row.filer}`, detail: `Filed ${row.filingDate}; report date ${row.reportDate}.`, kind: "filing", url: row.sourceUrl, asOf: row.filingDate }); pushClaim("smart_money", { text: `${row.form} by ${row.filer}, filed ${row.filingDate}.`, sourceIds: [id] }); }
    for (const row of congressional.slice(0, 4)) { const id = addSource({ title: `${row.source} · ${row.title}`, detail: row.snippet, kind: "filing", url: row.url, asOf: row.publishedAt }); pushClaim("smart_money", { text: `Congressional-disclosure search result: ${row.title}. Treat as delayed and single-source until the linked report is reviewed.`, sourceIds: [id] }); }
    for (const row of relevantMachine) { const theorySources = parseSources(row.sourcesJson).slice(0, 4).map((source) => addSource({ title: `${source.source} · ${source.title}`, detail: source.snippet, kind: "theory", url: source.url, asOf: source.publishedAt ?? source.retrievedAt })); const recordId = addSource({ title: `Theory Watch · ${row.title}`, detail: `${row.status}; ${row.confidenceTier} evidence tier; directional pick ${row.directionalPick}; ${row.thesis}; invalidation: ${row.invalidationText}`, kind: "terminal", url: null, asOf: row.checkedAt.toISOString() }); pushClaim("theories", { text: `${row.status.toUpperCase()} / ${row.confidenceTier.toUpperCase()} evidence: ${row.title}. ${row.thesis} Invalidation: ${row.invalidationText}`, sourceIds: [recordId, ...theorySources] }); }
    for (const row of relevantSaved) { const theorySourceIds = row.evidence.slice(0, 4).map((evidence) => addSource({ title: `${evidence.source} · ${evidence.title}`, detail: `${evidence.stance} evidence attached to user theory.`, kind: "theory", url: evidence.url, asOf: evidence.publishedAt ?? evidence.createdAt })); const recordId = addSource({ title: `Saved theory #${row.id}`, detail: `${row.status}; ${row.statement}`, kind: "terminal", url: null, asOf: row.updatedAt }); pushClaim("theories", { text: `${row.status.toUpperCase()}: ${row.statement}`, sourceIds: [recordId, ...theorySourceIds] }); }
    for (const row of contextRows) addSource({ title: `${row.source ?? "Unknown source"} · ${row.title}`, detail: row.snippet ?? "", kind: "context", url: row.url ?? null, asOf: row.published_at });

    const evidenceText = sources.map((source, index) => `[${index + 1}] ${source.kind.toUpperCase()} · ${source.title}\nAs of: ${source.asOf ?? "unavailable"}\n${source.detail}`).join("\n\n");
    let inferred: z.infer<typeof completePictureInferenceSchema> | null = null;
    try { inferred = await ctx.inference.complete(`Build a restrained Complete Picture for ${symbol} (${companyName}) from only the numbered evidence below. The summary must fuse chart direction, tracked outcomes, news, filings, theories, competition, sector, supply-chain, macro and risk where present; state the central conflict instead of smoothing it over. Every external claim must cite the exact supporting sourceIndexes. Direct competitors and peer symbols may be named only when a numbered source explicitly identifies the relationship; otherwise return no peer candidate. Do not treat a search result title as verified beyond its title/snippet. Never invent institutional activity, paid-feed metrics, fundamentals, competitors, probabilities or certainty. Keep headline under 12 words, summary to 3–5 sentences, and each claim to one sentence.

${evidenceText}`, { schema: completePictureInferenceSchema }); } catch { /* deterministic evidence remains available */ }
    const externalByLane = new Map<string, CompletePictureClaim[]>();
    for (const claim of inferred?.externalClaims ?? []) { const validIds = [...new Set(claim.sourceIndexes.filter((index) => index >= 1 && index <= sources.length).map((index) => sources[index - 1]?.id).filter((id): id is string => !!id))]; if (!validIds.length) continue; externalByLane.set(claim.lane, [...(externalByLane.get(claim.lane) ?? []), { text: claim.text, sourceIds: validIds }]); }
    const peerClaims: CompletePictureClaim[] = [];
    for (const peer of (inferred?.peerCandidates ?? []).slice(0, 3)) { const peerSymbol = peer.symbol.trim().toUpperCase(); if (!/^[A-Z0-9.\-^=]{1,20}$/.test(peerSymbol) || peerSymbol === symbol) continue; const contextIds = peer.sourceIndexes.filter((index) => index >= 1 && index <= sources.length).map((index) => sources[index - 1]?.id).filter((id): id is string => !!id); if (!contextIds.length) continue; const peerAnalysis = await analyze(ctx, peerSymbol, false); if (peerAnalysis.status !== "ok" || !peerAnalysis.instrument || !peerAnalysis.factorModel) continue; const peerSourceId = addSource({ title: `${peerAnalysis.instrument.symbol} adjusted-price comparison`, detail: `Factor agreement ${peerAnalysis.factorModel.score}; 30-session ${getMetric(peerAnalysis.returns, "30d") ?? "unavailable"}%; source as of ${peerAnalysis.instrument.asOf ?? "unavailable"}.`, kind: "market", url: peerAnalysis.instrument.sources[0]?.url ?? null, asOf: peerAnalysis.instrument.asOf }); const subject30 = getMetric(analysisResult.returns, "30d"); const peer30 = getMetric(peerAnalysis.returns, "30d"); peerClaims.push({ text: `${peerAnalysis.instrument.symbol} (${peer.name}) is source-identified as a peer: ${peer.why} Current factor agreement is ${peerAnalysis.factorModel.score >= 0 ? "+" : ""}${peerAnalysis.factorModel.score}; 30-session return ${peer30 == null ? "unavailable" : `${peer30 >= 0 ? "+" : ""}${peer30}%`}${subject30 == null || peer30 == null ? "" : ` versus ${symbol} ${subject30 >= 0 ? "+" : ""}${subject30}%`}.`, sourceIds: [...contextIds, peerSourceId, marketSourceId] }); }
    if (peerClaims.length) externalByLane.set("competition", [...peerClaims, ...(externalByLane.get("competition") ?? [])]);

    const closedSignals = trackedRows.filter((row) => row.return5d != null || row.return14d != null || row.return30d != null).length;
    const calibration = closedSignals > 0 ? { label: "MEASURED" as const, closedSignals, note: `${closedSignals} ${symbol} tracked signal${closedSignals === 1 ? " has" : "s have"} at least one closed outcome window. Reliability still depends on the exact setup and rating band.` } : { label: "UNCALIBRATED" as const, closedSignals: 0, note: `No ${symbol} tracked signal has a closed 5D, 14D or 30D outcome yet.` };
    const definitions: Array<{ key: z.infer<typeof dossierSynthesisResponse>["sections"][number]["key"]; title: string; noData: string }> = [
      { key: "direction", title: "Direction + factor ledger", noData: "Factor ledger and directional rating are unavailable for this fetch." },
      { key: "signals", title: "Signals + outcomes", noData: "No tracked signal or outcome exists for this ticker yet." },
      { key: "news", title: "News + why it matters", noData: "No current source-linked news rows were returned." },
      { key: "smart_money", title: "Smart money", noData: "No matching 13F, Form 4, 13D/13G or congressional-disclosure row was found; paid flow metrics are not available." },
      { key: "theories", title: "Related theories", noData: "No saved or machine-found theory currently links this ticker." },
      { key: "competition", title: "Competitors + peer tape", noData: "No direct competitor was explicitly established by the retrieved sources; none is inferred." },
      { key: "sector", title: "Sector backdrop", noData: "Sector backdrop was not established by the retrieved sources." },
      { key: "supply_chain", title: "Supply chain", noData: "No source-backed supply-chain factor was established." },
      { key: "macro", title: "Macro transmission", noData: "No source-backed macro transmission was established." },
      { key: "risks", title: "Key risks", noData: "No source-backed company-specific risk claim was established beyond the mechanical invalidation shown above." },
    ];
    const sections = definitions.map((definition) => { const claims = [...(deterministic.get(definition.key) ?? []), ...(externalByLane.get(definition.key) ?? [])]; return { key: definition.key, title: definition.title, state: claims.length ? "available" as const : "no_data" as const, note: claims.length ? `${claims.length} traceable ${claims.length === 1 ? "read" : "reads"}` : definition.noData, claims }; });
    const gaps = [...institutionalErrors]; if (!inferred) gaps.push("Narrative synthesis inference was unavailable; the deterministic evidence ledger remains visible."); if (!stories.length) gaps.push("Current ticker news returned no usable rows."); if (!contextRows.length) gaps.push("External competitor, sector, supply-chain and macro context returned no usable rows."); if (!trackedRows.length) gaps.push("No tracked signal history exists for this ticker."); if (!relevantMachine.length && !relevantSaved.length) gaps.push("No related theory exists for this ticker."); if (!holdings.length && !insiders.length && !activists.length && !congressional.length) gaps.push("No matching filing or congressional-disclosure activity was found in the available lanes.");
    const fallbackHeadline = analysisResult.factorModel ? `${symbol}: ${analysisResult.factorModel.direction.toUpperCase()} tape, evidence still incomplete` : `${symbol}: complete picture degraded`;
    const fallbackSummary = analysisResult.factorModel ? `${symbol} currently carries ${analysisResult.factorModel.direction} factor agreement of ${analysisResult.factorModel.score >= 0 ? "+" : ""}${analysisResult.factorModel.score}/100. ${trackedRows.length ? `${trackedRows.length} tracked signal${trackedRows.length === 1 ? " is" : "s are"} in the outcome ledger.` : "There is no ticker-specific outcome history yet."} ${stories.length ? `${stories.length} current source-linked news items were retrieved.` : "Current news was unavailable."} Missing lanes remain explicit below.` : `The market-data lane for ${symbol} was unavailable, so the Complete Picture is limited to retained terminal records and sourced external context.`;
    const response: z.infer<typeof dossierSynthesisResponse> = { status: inferred && analysisResult.status === "ok" ? "ok" : "degraded", generatedAt, symbol, headline: inferred?.headline ?? fallbackHeadline, summary: inferred?.summary ?? fallbackSummary, keyTension: inferred?.keyTension ?? null, calibration, sections, sources, gaps: [...new Set(gaps)] };
    dossierMemo.set(symbol, { expiresAt: Date.now() + 5 * 60_000, value: response }); return response;
  } }),
  listTheories: defineAction({ request: z.object(pageRequestFields), response: z.object({ theories: z.array(theoryView), refreshedAt: z.string(), nextCursor: z.number().nullable() }), async handler(ctx, args) { const page = pageSlice(await theoryRows(ctx), args.limit ?? 20, args.cursor); return { theories: page.items, refreshedAt: new Date().toISOString(), nextCursor: page.nextCursor }; } }),
  saveTheory: defineAction({ request: theoryInput.extend({ id: z.number().int().positive().nullable() }), response: z.object({ ok: z.literal(true), id: z.number() }), async handler(ctx, args): Promise<{ ok: true; id: number }> {
    const db = ctx.db<typeof schema>(); const linkedTickers = [...new Set(args.linkedTickers.map((x) => x.trim().toUpperCase()).filter(Boolean))];
    if (args.horizon === "short") { const today = new Date(); today.setUTCHours(0, 0, 0, 0); const latestShortDate = new Date(today.getTime() + 29 * 86400000); const invalid = args.predictions.find((prediction) => { const due = new Date(`${prediction.dueDate}T00:00:00Z`); return !Number.isFinite(due.getTime()) || due < today || due > latestShortDate; }); if (invalid) throw new Error(`Short-term predictions must be due within 29 days; ${invalid.ticker} is dated ${invalid.dueDate}.`); }
    const snapshots = await snapshotTickers(ctx, linkedTickers); let id = args.id;
    if (id == null) { const inserted = await db.insert(schema.theories).values({ statement: args.statement, horizon: args.horizon, linkedTickersJson: JSON.stringify(linkedTickers), snapshotPricesJson: JSON.stringify(snapshots) }).returning(); const row = inserted[0]; if (!row) throw new Error("Theory could not be saved"); id = row.id; }
    else { const existing = (await db.select().from(schema.theories).where(eq(schema.theories.id, id)))[0]; if (!existing) throw new Error("Theory was not found"); const oldSnapshots = jsonPrices(existing.snapshotPricesJson); await db.update(schema.theories).set({ statement: args.statement, horizon: args.horizon, linkedTickersJson: JSON.stringify(linkedTickers), snapshotPricesJson: JSON.stringify({ ...snapshots, ...oldSnapshots }), updatedAt: new Date() }).where(eq(schema.theories.id, id)); await db.delete(schema.theoryPredictions).where(eq(schema.theoryPredictions.theoryId, id)); await db.delete(schema.theoryRipples).where(eq(schema.theoryRipples.theoryId, id)); }
    if (args.predictions.length) await db.insert(schema.theoryPredictions).values(args.predictions.map((p) => ({ theoryId: id, ticker: p.ticker.trim().toUpperCase(), direction: p.direction, targetLevel: p.targetLevel, dueDate: p.dueDate })));
    if (args.ripples.length) await db.insert(schema.theoryRipples).values(args.ripples.map((r) => ({ theoryId: id, fromLabel: r.from, toLabel: r.to, because: r.because })));
    ctx.invalidateQueries(); return { ok: true, id };
  } }),
  deleteTheory: defineAction({ request: z.object({ id: z.number().int().positive() }), response: z.object({ ok: z.literal(true) }), async handler(ctx, args): Promise<{ ok: true }> { await ctx.db<typeof schema>().delete(schema.theories).where(eq(schema.theories.id, args.id)); ctx.invalidateQueries(); return { ok: true }; } }),
  attachTheoryEvidence: defineAction({ request: z.object({ theoryId: z.number().int().positive(), stance: z.enum(["confirming", "challenging"]), title: z.string().min(1).max(500), source: z.string().min(1).max(160), url: z.string().url(), publishedAt: z.string().nullable() }), response: z.object({ ok: z.literal(true) }), async handler(ctx, args): Promise<{ ok: true }> { await ctx.db<typeof schema>().insert(schema.theoryEvidence).values({ theoryId: args.theoryId, stance: args.stance, title: args.title, source: args.source, sourceUrl: args.url, publishedAt: args.publishedAt }); ctx.invalidateQueries(); return { ok: true }; } }),
  checkEntry: defineAction({ request: z.object({ symbol: z.string().min(1).max(30).optional(), ticker: z.string().min(1).max(30).optional(), direction: z.enum(["long", "short"]), entryPrice: z.number().positive(), invalidationLevel: z.number().positive().optional(), targetLevel: z.number().positive().optional() }), response: entryTimingResponse, async handler(ctx, args): Promise<z.infer<typeof entryTimingResponse>> {
    const ticker = (args.symbol ?? args.ticker ?? "").trim().toUpperCase(); if (!ticker) throw new Error("symbol is required");
    const latest = (await ctx.db<typeof schema>().select().from(schema.trackedSignals).where(eq(schema.trackedSignals.symbol, ticker)).orderBy(desc(schema.trackedSignals.signalDate)).limit(1))[0];
    const invalidationLevel = args.invalidationLevel ?? latest?.invalidationLevel; const targetLevel = args.targetLevel ?? latest?.target1 ?? null;
    if (invalidationLevel == null || targetLevel == null) throw new Error("No stored signal levels are available; pass invalidationLevel and targetLevel.");
    return await checkEntryTiming(ctx, { ticker, direction: args.direction, entryPrice: args.entryPrice, invalidationLevel, targetLevel });
  } }),
  getWhaleData: defineAction({
    request: z.object({ ticker: z.string().min(1).max(20), issuerName: z.string().min(1).max(160), marketCap: z.number().nullable(), return30d: z.number().nullable() }),
    response: z.object({
      status: z.enum(["ok", "partial", "unavailable"]), note: z.string(),
      holdings: z.array(z.object({ manager: z.string(), reportDate: z.string(), filingDate: z.string(), value: z.number(), shares: z.number(), portfolioPct: z.number().nullable(), change: z.string(), changePct: z.number().nullable(), sourceUrl: z.string(), flag: z.string().nullable() })),
      insiders: z.array(z.object({ owner: z.string(), title: z.string(), date: z.string(), type: z.enum(["Buy", "Sell"]), shares: z.number(), price: z.number().nullable(), sourceUrl: z.string() })),
      insiderCluster: z.boolean(),
      activists: z.array(z.object({ form: z.string(), filingDate: z.string(), reportDate: z.string(), filer: z.string(), sourceUrl: z.string(), lagDays: z.number().nullable() })),
      congressional: z.array(z.object({ title: z.string(), source: z.string(), snippet: z.string(), publishedAt: z.string().nullable(), url: z.string() })),
      silentHints: z.array(silentHintSchema),
      errors: z.array(z.string()),
    }),
    async handler(ctx, args) {
      const errors: string[] = []; let cik = "";
      try {
        const map = await secJson<Record<string, { cik_str: number; ticker: string; title: string }>>("https://www.sec.gov/files/company_tickers.json");
        const match = Object.values(map).find((x) => x.ticker.toUpperCase() === args.ticker.toUpperCase()); cik = match ? String(match.cik_str).padStart(10, "0") : "";
      } catch (e) { errors.push(`Issuer lookup failed: ${String(e)}`); }
      const settled = await Promise.allSettled(managers.map((m) => managerHolding(m, args.issuerName)));
      const holdings = settled.flatMap((r) => r.status === "fulfilled" && r.value ? [r.value] : []).map((h) => ({ ...h, flag: h.change === "New stake" && (args.marketCap ?? Infinity) < 5_000_000_000 ? "New small-cap stake" : (h.change === "Added" || h.change === "New stake") && (args.return30d ?? 0) < -5 ? "Added into weakness" : (h.change === "Added" || h.change === "New stake") && (args.return30d ?? 0) < 0 ? "13F vs price divergence" : null }));
      if (settled.some((r) => r.status === "rejected")) errors.push("Some manager filings could not be parsed from EDGAR.");
      let insiders: Awaited<ReturnType<typeof insiderRows>> = []; const activists: Array<{ form: string; filingDate: string; reportDate: string; filer: string; sourceUrl: string; lagDays: number | null }> = [];
      if (cik) {
        try { insiders = await insiderRows(cik); } catch (e) { errors.push(`Form 4 lookup failed: ${String(e)}`); }
        try {
          const sub = await secJson<SecSubmission>(`https://data.sec.gov/submissions/CIK${cik}.json`); const recent = sub.filings?.recent;
          const filings = recent ? recent.form.flatMap((form, i) => {
            if (!/^SC 13[DG](\/A)?$/.test(form)) return [];
            const accession = recent.accessionNumber[i] ?? ""; const primary = recent.primaryDocument[i] ?? ""; const filingDate = recent.filingDate[i] ?? ""; const reportDate = recent.reportDate[i] ?? "";
            const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${primary.split("/").pop() ?? primary}`;
            const lag = filingDate && reportDate ? Math.round((Date.parse(`${filingDate}T00:00:00Z`) - Date.parse(`${reportDate}T00:00:00Z`)) / 86400000) : null;
            return [{ form, filingDate, reportDate, sourceUrl, lagDays: Number.isFinite(lag) ? lag : null }];
          }).sort((a, b) => b.filingDate.localeCompare(a.filingDate)).slice(0, 8) : [];
          const parsed = await Promise.all(filings.map(async (filing) => {
            try { const document = await secText(filing.sourceUrl); return { ...filing, filer: reportingPersonName(document) ?? "Name unavailable from filing" }; }
            catch { return { ...filing, filer: "Name unavailable from filing" }; }
          }));
          activists.push(...parsed);
          if (parsed.some((filing) => filing.filer === "Name unavailable from filing")) errors.push("Some Schedule 13D/13G reporting-person names could not be parsed.");
        } catch (e) { errors.push(`Schedule 13D/13G lookup failed: ${String(e)}`); }
      } else errors.push("SEC issuer CIK was not found; insider and activist filings are unavailable.");
      let congressional: Array<{ title: string; source: string; snippet: string; publishedAt: string | null; url: string }> = [];
      try { const r = await ctx.tool.web_search(`${args.ticker} congressional stock trade disclosure House Senate periodic transaction report`); congressional = (r.content?.results ?? []).filter((x) => !x.is_index_page && x.url).slice(0, 6).map((x) => ({ title: x.title, source: x.source ?? "Unknown source", snippet: x.snippet ?? "", publishedAt: x.published_at, url: x.url ?? "" })); } catch (e) { errors.push(`Congressional disclosure search failed: ${String(e)}`); }
      const buyers = new Set(insiders.filter((x) => x.type === "Buy").map((x) => x.owner));
      const confidenceNote = "Confidence labels rank evidence quality and corroboration; they are never probabilities."; const silentHints: SilentHint[] = [];
      for (const holding of holdings.filter((row) => row.change === "New stake" || row.flag != null)) silentHints.push({ type: "early_13f", label: `${holding.manager}: ${holding.change}`, detail: `${holding.manager} reported ${holding.shares.toLocaleString()} shares for ${holding.reportDate}${holding.flag ? ` · ${holding.flag}` : ""}. 13F timing is delayed.`, confidence: holding.change === "New stake" ? "high" : "medium", confidenceNote, observedAt: holding.filingDate, sourceTitle: `${holding.manager} 13F information table`, sourceUrl: holding.sourceUrl });
      for (const filing of activists.slice(0, 4)) silentHints.push({ type: "activist", label: `${filing.form} by ${filing.filer}`, detail: `Filed ${filing.filingDate}${filing.reportDate ? ` for report date ${filing.reportDate}` : ""}. Review the filing for intent and ownership details.`, confidence: "high", confidenceNote, observedAt: filing.filingDate, sourceTitle: `${filing.form} filing`, sourceUrl: filing.sourceUrl });
      const firstBuyer = insiders.find((row) => row.type === "Buy"); if (buyers.size >= 2 && firstBuyer) silentHints.push({ type: "insider_cluster", label: `${buyers.size} distinct insider buyers`, detail: "Multiple reporting owners have open-market purchase filings in the recent Form 4 set. Filing dates do not prove coordinated intent.", confidence: "high", confidenceNote, observedAt: firstBuyer.date, sourceTitle: "SEC Form 4 filing", sourceUrl: firstBuyer.sourceUrl });
      try { const search = await ctx.tool.web_search(`${args.issuerName} ${args.ticker} venture funding corporate venture strategic investment market maker engagement`); const sourceRows = (search.content?.results ?? []).filter((row) => !row.is_index_page && row.url).slice(0, 10); const compact = sourceRows.map((row, index) => `[${index + 1}] ${row.title}\n${row.source ?? "Unknown source"} · ${row.published_at ?? "date unavailable"}\n${row.snippet ?? ""}`).join("\n\n"); if (compact) { const inferred = await ctx.inference.complete(`Find only concrete institutional footprints involving ${args.issuerName} in these excerpts: a VC/private-company funding round, a named corporate-venture investment/check, or a named market-maker engagement. Exclude generic investing articles, market-maker trading activity, speculation, and anything not directly stated. Confidence high requires a named transaction or engagement plus amount/date; medium may miss one detail; do not return low-confidence guesses.\n\n${compact}`, { schema: z.array(z.object({ sourceIndex: z.number().int().min(1), type: z.enum(["vc_raise", "corporate_venture", "market_maker"]), label: z.string(), detail: z.string(), confidence: z.enum(["high", "medium"]), observedAt: z.string().nullable() })).max(6) }); for (const item of inferred) { const source = sourceRows[item.sourceIndex - 1]; if (!source?.url) continue; silentHints.push({ type: item.type, label: item.label, detail: item.detail, confidence: item.confidence, confidenceNote, observedAt: item.observedAt ?? source.published_at, sourceTitle: source.title, sourceUrl: source.url }); } } } catch (e) { errors.push(`Silent-hint search failed: ${String(e)}`); }
      const dedupedHints = [...new Map(silentHints.map((hint) => [`${hint.type}|${hint.sourceUrl}|${hint.label}`, hint])).values()];
      const status: "ok" | "partial" | "unavailable" = errors.length ? (holdings.length || insiders.length || activists.length || congressional.length || dedupedHints.length ? "partial" : "unavailable") : "ok";
      return { status, note: "13F positions are the last reported quarter and can be up to 45 days delayed. Congressional reports are also delayed by statutory filing windows; result snippets link to the underlying disclosure or report. 13D/13G is generally faster but still filing-based, not live tape.", holdings, insiders, insiderCluster: buyers.size >= 2, activists: activists.slice(0, 8), congressional, silentHints: dedupedHints, errors };
    },
  }),
  getHistoricalContext: defineAction({ request: z.object({ symbol: z.string().min(1).max(30) }), response: historicalContextResponse, async handler(ctx, args): Promise<z.infer<typeof historicalContextResponse>> { const series = await yahooFullHistory(ctx, args.symbol); const rows = await ctx.db<typeof schema>().select().from(schema.historicalCaches).where(eq(schema.historicalCaches.symbol, (series.meta.symbol ?? args.symbol).toUpperCase())); return fullHistoryContext(series, rows[0]?.fetchedAt ?? new Date()); } }),
  getCycleClock: defineAction({request:z.object({}),response:cycleClockResponse,async handler(ctx):Promise<z.infer<typeof cycleClockResponse>>{return cycleClockFromCache(ctx);}}),
  getPortfolioCorrelation: defineAction({request:z.object({}),response:portfolioCorrelationResponse,async handler(ctx):Promise<z.infer<typeof portfolioCorrelationResponse>>{return portfolioCorrelationFromCache(ctx);}}),
  saveValuationFundamentals: defineAction({ request: z.object({ ticker: z.string().min(1).max(30), asOf: z.string().min(1).max(80), payload: keyedValuationPayloadSchema }), response: z.object({ ok: z.literal(true), symbol: z.string(), savedAt: z.string() }), async handler(ctx, args): Promise<{ok:true;symbol:string;savedAt:string}> { const symbol=args.ticker.trim().toUpperCase(); const db=ctx.db<typeof schema>(); const now=new Date(); const existing=(await db.select().from(schema.equityValuationSnapshots).where(eq(schema.equityValuationSnapshots.symbol,symbol)))[0]; const keyedSources=[...new Set([...args.payload.facts.map((fact)=>fact.provider),...args.payload.competitors.map((item)=>item.sourceLabel),...args.payload.claims.map((item)=>item.sourceLabel)])]; const values={keyedAsOf:args.asOf,keyedPayloadJson:JSON.stringify(args.payload),keyedSourcesJson:JSON.stringify(keyedSources),taskId:null,updatedAt:now}; if(existing)await db.update(schema.equityValuationSnapshots).set(values).where(eq(schema.equityValuationSnapshots.id,existing.id));else await db.insert(schema.equityValuationSnapshots).values({symbol,...values}); ctx.invalidateQueries(); return {ok:true,symbol,savedAt:now.toISOString()}; } }),
  valuestock: defineAction({ request: z.object({ symbol: z.string().min(1).max(30) }), response: stockValuationResponse, async handler(ctx,args):Promise<z.infer<typeof stockValuationResponse>>{return stockValuation(ctx,args.symbol);} }),
  runDeepAnalysis: defineAction({ request: z.object({ symbol: z.string().min(1).max(30), coinId: z.string().max(80).optional(), name: z.string().max(160).optional(), referenceMultiple: z.number().positive().max(100).nullable().optional() }), response: deepAnalysisResponse.extend({ resolvedCoinId: z.string() }), async handler(ctx, args): Promise<z.infer<typeof deepAnalysisResponse> & { resolvedCoinId: string }> { const result = await deepAnalysis(ctx, args.symbol, args.referenceMultiple ?? null); return { ...result, resolvedCoinId: args.coinId?.trim() || args.symbol.trim().toUpperCase() }; } }),
  searchInstruments: defineAction({ request: z.object({ query: z.string().trim().min(2).max(80) }), response: instrumentSearchResponse, async handler(_ctx, args): Promise<z.infer<typeof instrumentSearchResponse>> { return searchYahooInstruments(args.query); } }),
  analyzeInstrument: defineAction({
    request: z.object({ symbol: z.string().min(1).max(80).optional(), ticker: z.string().min(1).max(80).optional(), query: z.string().min(1).max(80).optional(), coinId: z.string().max(80).optional(), name: z.string().max(160).optional() }),
    response: analyzeInstrumentResponse,
    async handler(ctx, args): Promise<z.infer<typeof analyzeInstrumentResponse>> {
      const startedAt = Date.now(); const query = (args.symbol ?? args.ticker ?? args.query ?? "").trim(); if (!query) throw new Error("symbol is required");
      const cacheSymbol = commodityAliases[cleanKey(query)]?.future ?? query.toUpperCase(); const tradingDay = easternTradingDay(); const db = ctx.db<typeof schema>();
      const cached = (await db.select().from(schema.dossierCaches).where(and(eq(schema.dossierCaches.symbol, cacheSymbol), eq(schema.dossierCaches.tradingDay, tradingDay))))[0];
      if (cached) {
        try {
          const parsed = analyzeInstrumentResponse.safeParse(JSON.parse(cached.payloadJson));
          if (parsed.success) { const durationMs = Date.now() - startedAt; return { ...parsed.data, delivery: { ...parsed.data.delivery, cacheHit: true, tradingDay, durationMs, payloadBytes: Buffer.byteLength(cached.payloadJson) } }; }
        } catch { /* a malformed cache is ignored and replaced below */ }
      }
      const result = await analyze(ctx, query, false, true, true); const generatedAt = new Date().toISOString();
      const response: z.infer<typeof analyzeInstrumentResponse> = { ...result, resolvedCoinId: args.coinId?.trim() || result.instrument?.symbol || query.toUpperCase(), delivery: { cacheHit: false, tradingDay, generatedAt, durationMs: Date.now() - startedAt, payloadBytes: 0, synthesisRuleVersion: DOSSIER_SYNTHESIS_RULE_VERSION } };
      const encodedOnce = JSON.stringify(response); response.delivery.payloadBytes = Buffer.byteLength(encodedOnce); const payloadJson = JSON.stringify(response); const now = new Date();
      if (result.status === "ok") { if (cached) await db.update(schema.dossierCaches).set({ payloadJson, generatedAt: now }).where(eq(schema.dossierCaches.id, cached.id)); else await db.insert(schema.dossierCaches).values({ symbol: cacheSymbol, tradingDay, payloadJson, generatedAt: now }); }
      return response;
    },
  }),
  getWalkForwardDecisions: defineAction({
    request: z.object({ symbol: z.string().min(1).max(30), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(50) }), response: walkForwardPageResponse,
    async handler(ctx, args): Promise<z.infer<typeof walkForwardPageResponse>> { const symbol = args.symbol.trim().toUpperCase(); const source = await yahooFullHistory(ctx, symbol); const full = walkForwardFactorBacktest(completedDailyPoints(source.points), 0); const decisions = full.decisions.slice(args.offset, args.offset + args.limit); const nextOffset = args.offset + decisions.length < full.decisions.length ? args.offset + decisions.length : null; return { symbol, observations: full.observations, qualified: full.qualified, hitRate: full.hitRate, averageDirectionalReturn: full.averageDirectionalReturn, offset: args.offset, limit: args.limit, nextOffset, decisions }; },
  }),
  getDossierSeries: defineAction({
    request: z.object({ symbol: z.string().min(1).max(30), kind: z.enum(["daily", "weekly"]), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(500).default(250) }), response: dossierSeriesResponse,
    async handler(ctx, args): Promise<z.infer<typeof dossierSeriesResponse>> { const symbol = args.symbol.trim().toUpperCase(); const source = await yahooFullHistory(ctx, symbol); const fullRows = args.kind === "weekly" ? weeklyFrom(completedDailyPoints(source.points)).map((row) => ({ date: row.date, close: row.close, open: null, high: null, low: null, volume: null, sma20: null, sma50: null, sma200Proxy: null })) : completedDailyPoints(source.points).map((row) => ({ ...row, sma20: null, sma50: null, sma200Proxy: null })); const rows = fullRows.slice(args.offset, args.offset + args.limit); const nextOffset = args.offset + rows.length < fullRows.length ? args.offset + rows.length : null; return { symbol, kind: args.kind, total: fullRows.length, offset: args.offset, limit: args.limit, nextOffset, sourceUrl: source.sourceUrl, rows }; },
  }),
  trackAnalyzedSignal: defineAction({ request: z.object({ query: z.string().min(1).max(80) }), response: z.object({ ok: z.boolean(), symbol: z.string().nullable(), recorded: z.boolean(), note: z.string() }), async handler(ctx, args) {
    const result = await analyze(ctx, args.query, true, false);
    if (result.status !== "ok" || !result.instrument || !result.factorModel || result.factorModel.direction === "mixed") return { ok: false, symbol: result.instrument?.symbol ?? null, recorded: false, note: result.error ?? "A directional factor read is required before tracking." };
    const signalDate = result.chart.at(-1)?.date; const db = ctx.db<typeof schema>();
    const tracked = signalDate ? (await db.select().from(schema.trackedSignals).where(and(eq(schema.trackedSignals.symbol, result.instrument.symbol), eq(schema.trackedSignals.signalDate, signalDate))))[0] : undefined;
    if (!tracked) {
      const suppressed = signalDate ? (await db.select().from(schema.suppressedSignalCandidates).where(and(eq(schema.suppressedSignalCandidates.symbol, result.instrument.symbol), eq(schema.suppressedSignalCandidates.signalDate, signalDate))).orderBy(desc(schema.suppressedSignalCandidates.createdAt)))[0] : undefined;
      ctx.invalidateQueries();
      return { ok: false, symbol: result.instrument.symbol, recorded: false, note: suppressed ? `${result.instrument.symbol} was suppressed: ${suppressed.reason}.` : `${result.instrument.symbol} was not published because issuance validation did not clear.` };
    }
    ctx.invalidateQueries();
    return { ok: true, symbol: result.instrument.symbol, recorded: true, note: `${result.instrument.symbol} is tracked at ${result.instrument.price} from ${result.instrument.quotePriceSource}; ${result.instrument.barState === "forming" ? "forming bar" : "closed bar"} timestamp ${result.instrument.barTimestamp}.` };
  } }),
  refreshEvidenceMaintenance: defineAction({ request: z.object({}), response: z.object({ ok: z.literal(true), refreshedAt: z.string() }), async handler(ctx): Promise<{ ok: true; refreshedAt: string }> { await refreshSparseRadarRows(ctx); await refreshCurrentTrackedEvidence(ctx); await scoreTrackedSignals(ctx); await refreshInvalidations(ctx); ctx.invalidateQueries(); return { ok: true, refreshedAt: new Date().toISOString() }; } }),
  getRotation: defineAction({ request: z.object({}), response: z.object({ asOf: z.string(), benchmark: z.literal("SPY"), note: z.string(), rows: z.array(z.object({ symbol: z.string(), name: z.string(), ratio30d: z.number().nullable(), ratio90d: z.number().nullable(), rangeLabel: z.string(), error: z.string().nullable() })), breadth: z.object({ leading30d: z.number(), lagging30d: z.number(), unavailable: z.number() }) }), async handler(ctx) {
    const watched = await ctx.db<typeof schema>().select().from(schema.watchlist).orderBy(asc(schema.watchlist.createdAt)); const defs = watched.length ? watched.map((row) => ({ symbol: row.symbol, name: row.displayName })) : [{ symbol: "QQQ", name: "Nasdaq 100" }, { symbol: "IWM", name: "Russell 2000" }, { symbol: "DIA", name: "Dow Jones" }];
    let spy: YahooSeries | null = null; try { spy = await yahooFullHistory(ctx, "SPY"); } catch { /* each row will be unavailable */ }
    const ratioReturn = (asset: Point[], benchmark: Point[], bars: number) => { const benchmarkByDate = new Map(benchmark.map((point) => [point.date, point.close])); const aligned = asset.flatMap((point) => { const base = benchmarkByDate.get(point.date); return base && base !== 0 ? [{ date: point.date, ratio: point.close / base }] : []; }); const last = aligned[aligned.length - 1]; const prior = aligned[aligned.length - 1 - bars]; return last && prior ? finite((last.ratio / prior.ratio - 1) * 100) : null; };
    const rows = await Promise.all(defs.map(async (def) => { try { if (!spy) throw new Error("SPY benchmark unavailable"); const asset = await yahooFullHistory(ctx, def.symbol); const ratio30d = ratioReturn(asset.points, spy.points, 30); const ratio90d = ratioReturn(asset.points, spy.points, 90); const rangeLabel = ratio30d == null || ratio90d == null ? "Unavailable" : ratio30d > 0 && ratio90d > 0 ? "Leading" : ratio30d > 0 && ratio90d <= 0 ? "Improving" : ratio30d <= 0 && ratio90d > 0 ? "Fading" : "Lagging"; return { ...def, ratio30d, ratio90d, rangeLabel, error: null as string | null }; } catch (error) { return { ...def, ratio30d: null, ratio90d: null, rangeLabel: "Unavailable", error: String(error).replace(/^Error:\s*/, "") }; } }));
    return { asOf: new Date().toISOString(), benchmark: "SPY" as const, note: "Positive ratio returns mean the instrument outperformed SPY over the same aligned trading dates. Broad positive readings imply leadership breadth; they do not predict continuation.", rows: rows.sort((a, b) => (b.ratio30d ?? -Infinity) - (a.ratio30d ?? -Infinity)), breadth: { leading30d: rows.filter((row) => (row.ratio30d ?? 0) > 0).length, lagging30d: rows.filter((row) => (row.ratio30d ?? 0) < 0).length, unavailable: rows.filter((row) => row.ratio30d == null).length } };
  } }),
  getWatchlistRows: defineAction({ request: z.object({}), response: z.object({ items: z.array(z.object({ id: z.number(), symbol: z.string(), name: z.string() })) }), async handler(ctx) { const rows = await ctx.db<typeof schema>().select().from(schema.watchlist).orderBy(asc(schema.watchlist.createdAt)); return { items: rows.map((row) => ({ id: row.id, symbol: row.symbol, name: row.displayName })) }; } }),
  addWatch: defineAction({ request: z.object({ query: z.string().min(1).max(80) }), response: z.object({ ok: z.boolean(), symbol: z.string(), name: z.string(), error: z.string().nullable() }), async handler(ctx, args) {
    const result = await analyze(ctx, args.query, false); if (result.status !== "ok" || !result.instrument) return { ok: false, symbol: "", name: "", error: result.error ?? "Only listed instruments and supported commodities can be watched." };
    const db = ctx.db<typeof schema>(); const existing = await db.select().from(schema.watchlist).where(eq(schema.watchlist.symbol, result.instrument.symbol));
    if (!existing.length) await db.insert(schema.watchlist).values({ symbol: result.instrument.symbol, displayName: result.instrument.name }); ctx.invalidateQueries();
    return { ok: true, symbol: result.instrument.symbol, name: result.instrument.name, error: null };
  } }),
  removeWatch: defineAction({ request: z.object({ id: z.number().int().positive() }), response: z.object({ ok: z.boolean() }), async handler(ctx, args) { await ctx.db<typeof schema>().delete(schema.watchlist).where(eq(schema.watchlist.id, args.id)); ctx.invalidateQueries(); return { ok: true }; } }),
  scanWatchlist: defineAction({
    request: z.object({}),
    response: z.object({ refreshedAt: z.string(), alertsCreated: z.number(), note: z.string(), items: z.array(z.object({ id: z.number(), symbol: z.string(), name: z.string(), price: z.number().nullable(), changePercent: z.number().nullable(), signalScore: z.number().nullable(), direction: z.enum(["long", "short", "mixed"]).nullable(), label: z.string(), factors: z.array(scanFactorSchema), formula: z.string().nullable(), invalidationLevel: z.number().nullable(), sourceAsOf: z.string().nullable(), sourceUrl: z.string().nullable(), error: z.string().nullable() })) }),
    async handler(ctx) {
      const watched = await ctx.db<typeof schema>().select().from(schema.watchlist).orderBy(asc(schema.watchlist.createdAt)); const day = new Date().toISOString().slice(0, 10); let alertsCreated = 0;
      let tickerMap: Record<string, { cik_str: number; ticker: string; title: string }> = {}; try { tickerMap = await secJson("https://www.sec.gov/files/company_tickers.json"); } catch { /* filing alerts remain unavailable */ }
      const items = [] as Array<{ id: number; symbol: string; name: string; price: number | null; changePercent: number | null; signalScore: number | null; direction: "long" | "short" | "mixed" | null; label: string; factors: z.infer<typeof scanFactorSchema>[]; formula: string | null; invalidationLevel: number | null; sourceAsOf: string | null; sourceUrl: string | null; error: string | null }>;
      for (const watchedItem of watched) {
        const result = await analyze(ctx, watchedItem.symbol, false); if (result.status !== "ok" || !result.instrument || !result.factorModel) { items.push({ id: watchedItem.id, symbol: watchedItem.symbol, name: watchedItem.displayName, price: null, changePercent: null, signalScore: null, direction: null, label: "Unavailable", factors: [], formula: null, invalidationLevel: null, sourceAsOf: null, sourceUrl: null, error: result.error ?? "Yahoo Finance scan failed." }); continue; }
        items.push({ id: watchedItem.id, symbol: watchedItem.symbol, name: result.instrument.name, price: result.instrument.price, changePercent: result.instrument.changePercent, signalScore: result.factorModel.score, direction: result.factorModel.direction, label: result.factorModel.label, factors: result.factorModel.factors, formula: result.factorModel.formula, invalidationLevel: result.levels?.invalidation ?? null, sourceAsOf: result.instrument.asOf, sourceUrl: result.instrument.sources[0]?.url ?? null, error: null });
        const rsiNow = result.indicators.find((x) => x.label === "RSI 14")?.value; const volumeZ = result.indicators.find((x) => x.label === "Volume z")?.value;
        if (rsiNow != null && (rsiNow >= 72 || rsiNow <= 28)) alertsCreated += await insertAlert(ctx, watchedItem.symbol, "RSI extreme", `RSI 14 is ${round(rsiNow)} (${rsiNow >= 72 ? "overbought" : "oversold"}).`, day, result.instrument.sources[0]?.url ?? null);
        if (volumeZ != null && volumeZ >= 1.5) alertsCreated += await insertAlert(ctx, watchedItem.symbol, "Volume spike", `Volume is ${round(volumeZ)}σ above its recent mean.`, day, result.instrument.sources[0]?.url ?? null);
        const latestSignal = (await ctx.db<typeof schema>().select().from(schema.trackedSignals).where(eq(schema.trackedSignals.symbol, watchedItem.symbol)).orderBy(desc(schema.trackedSignals.signalDate)))[0];
        if (latestSignal && result.instrument.price != null && Math.abs(result.instrument.price / latestSignal.entryPrice - 1) <= 0.01) alertsCreated += await insertAlert(ctx, watchedItem.symbol, "Entry zone", `Price ${round(result.instrument.price)} is within 1% of the tracked ${latestSignal.direction} entry ${round(latestSignal.entryPrice)}.`, day, result.instrument.sources[0]?.url ?? null);
        const mapRow = Object.values(tickerMap).find((x) => x.ticker.toUpperCase() === watchedItem.symbol.toUpperCase());
        if (mapRow) try { const cik = String(mapRow.cik_str).padStart(10, "0"); const submission = await secJson<SecSubmission>(`https://data.sec.gov/submissions/CIK${cik}.json`); const recent = submission.filings?.recent; if (recent) for (let index = 0; index < recent.form.length; index++) { const form = recent.form[index] ?? ""; const filingDate = recent.filingDate[index] ?? ""; if ((form === "4" || /^SC 13[DG](\/A)?$/.test(form)) && filingDate >= new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)) { const accession = recent.accessionNumber[index] ?? ""; const primary = recent.primaryDocument[index] ?? ""; const url = `https://www.sec.gov/Archives/edgar/data/${mapRow.cik_str}/${accession.replace(/-/g, "")}/${primary.split("/").pop() ?? primary}`; alertsCreated += await insertAlert(ctx, watchedItem.symbol, form === "4" ? "Form 4" : "13D/G", `${form} filed ${filingDate}.`, filingDate, url); } } } catch { /* filing alerts remain unavailable until the next scan */ }
        try {
          const search = await ctx.tool.web_search(`${watchedItem.symbol} next earnings date 2026 investor relations`); const rows = (search.content?.results ?? []).filter((x) => !x.is_index_page && x.url).slice(0, 4); const snippets = rows.map((x, index) => `[${index + 1}] ${x.title}: ${x.snippet}`).join("\n");
          if (snippets) { const found = await ctx.inference.complete(`Today is ${day}. From these snippets only, identify a clearly stated future earnings date for ${watchedItem.symbol}. Return null unless exact.\n${snippets}`, { schema: z.object({ date: z.string().nullable(), sourceIndex: z.number().int().nullable() }) }); const days = found.date ? Math.ceil((Date.parse(`${found.date}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000) : -1; const source = found.sourceIndex ? rows[found.sourceIndex - 1] : undefined; if (found.date && days >= 0 && days <= 10) alertsCreated += await insertAlert(ctx, watchedItem.symbol, "Earnings", `Earnings reported by source for ${found.date} (${days} day${days === 1 ? "" : "s"} away).`, found.date, source?.url ?? null); }
        } catch { /* no earnings alert unless a source establishes it */ }
      }
      await scoreTrackedSignals(ctx); ctx.invalidateQueries();
      return { refreshedAt: new Date().toISOString(), alertsCreated, note: "Yahoo Finance powers prices and technicals. SEC filing alerts use EDGAR with a declared User-Agent. Earnings alerts appear only when a dated source is found.", items };
    },
  }),
  listAlerts: defineAction({ request: z.object({}), response: z.object({ alerts: z.array(z.object({ id: z.number(), symbol: z.string(), kind: z.string(), message: z.string(), sourceUrl: z.string().nullable(), createdAt: z.string() })) }), async handler(ctx) { const rows = await ctx.db<typeof schema>().select().from(schema.alerts).orderBy(desc(schema.alerts.createdAt)); return { alerts: rows.slice(0, 100).map((x) => ({ id: x.id, symbol: x.symbol, kind: x.kind, message: x.message, sourceUrl: x.sourceUrl, createdAt: x.createdAt.toISOString() })) }; } }),
  runDailySignalPostmortem: defineAction({ request: z.object({}), response: snapshotRunResponse, async handler(ctx): Promise<z.infer<typeof snapshotRunResponse>> { return await computeDailySignalSnapshots(ctx); } }),
  getSignalTracker: defineAction({
    request: z.object(pageRequestFields), response: signalTrackerResponse,
    async handler(ctx, args): Promise<z.infer<typeof signalTrackerResponse>> {
      const db = ctx.db<typeof schema>();
      const [rows, snapshots, briefs, liveState] = await Promise.all([db.select().from(schema.trackedSignals).orderBy(desc(schema.trackedSignals.signalDate)), db.select().from(schema.signalInterimSnapshots).orderBy(desc(schema.signalInterimSnapshots.capturedAt)).limit(15000), db.select().from(schema.signalDailyBriefs).orderBy(desc(schema.signalDailyBriefs.sourceAsOf)).limit(1), readLiveTrackerState(ctx)]);
      // One fixed cohort only: the accepted 30-session direction forecast for
      // the exact issued strategy/version/parameter set. No 14→5→30 fallback.
      const groups = new Map<string, number[]>();
      for (const row of rows) {
        const evaluation = liveState.current.get(`${row.id}|direction_forecast`);
        if (!evaluation || (evaluation.verdict !== "HIT" && evaluation.verdict !== "MISS") || evaluation.grossReturnPct == null || !parseScanFactors(row.factorBreakdownJson).length) continue;
        const key = `${row.setupType}|${agreementBand(row.confidence)}|${row.strategyVersion}|${row.parameterHash}|${row.primaryHorizon}:${row.horizonUnit}`;
        groups.set(key, [...(groups.get(key) ?? []), evaluation.grossReturnPct]);
      }
      const stats = [...groups.entries()].map(([key, values]) => { const [setupType = "Other", band = "0–64 alignment"] = key.split("|"); const wins = values.filter((value) => value > 0); const losses = values.filter((value) => value <= 0); const hitRateRaw = wins.length / values.length; const avgWin = average(wins) ?? 0; const avgLoss = Math.abs(average(losses) ?? 0); const grossAverage = average(values) ?? 0; return { cohortKey: activeCohortKey("direction_forecast"), setupType, agreementBand: band, samples: values.length, hits: wins.length, hitRate: round(hitRateRaw * 100), avgReturn: round(grossAverage), avgWin: round(avgWin), avgLoss: round(avgLoss), expectancy: round(grossAverage), killSuggested: false }; });
      const historyBySignal = new Map<number, typeof snapshots>(); for (const snapshot of snapshots) { const history = historyBySignal.get(snapshot.signalId) ?? []; history.push(snapshot); historyBySignal.set(snapshot.signalId, history); }
      const allSignals = rows.map((x) => { const breakdown = factorScoreBreakdown(parseScanFactors(x.factorBreakdownJson)); return ({ id: x.id, symbol: x.symbol, name: x.instrumentName, setupType: x.setupType, direction: x.direction, signalScore: x.confidence, rawScore: breakdown?.rawScore ?? x.confidence, redundancyAdjustment: breakdown?.redundancyAdjustment ?? 0, entryPrice: x.entryPrice, signalDate: x.signalDate, factors: parseScanFactors(x.factorBreakdownJson), formula: `${x.scoreDefinition} Stored issuance score is authoritative; this view never recomputes it.`, invalidationLevel: x.invalidationLevel, invalidationAtr14: x.invalidationAtr14, invalidationAtrMultiple: x.invalidationAtrMultiple, invalidationMethod: x.invalidationMethod, target1: x.target1, sourceAsOf: x.sourceAsOf, barTimestamp: x.barTimestamp, barState: x.barState, sourceUrl: x.sourceUrl, return5d: null, return14d: null, return30d: liveState.current.get(`${x.id}|direction_forecast`)?.grossReturnPct ?? null, tradeSetupEvaluation: (() => { const row = liveState.current.get(`${x.id}|trade_setup`); return row ? { cohortKey: row.cohortKey, verdict: row.verdict, reason: row.reason, grossReturnPct: row.grossReturnPct, modeledNetReturnPct: row.modeledNetReturnPct, costStatus: row.costStatus, evaluatorVersion: row.evaluatorVersion, product: row.product, horizon: x.primaryHorizon, horizonUnit: x.horizonUnit } : null; })(), directionEvaluation: (() => { const row = liveState.current.get(`${x.id}|direction_forecast`); return row ? { cohortKey: row.cohortKey, verdict: row.verdict, reason: row.reason, grossReturnPct: row.grossReturnPct, modeledNetReturnPct: row.modeledNetReturnPct, costStatus: row.costStatus, evaluatorVersion: row.evaluatorVersion, product: row.product, horizon: x.primaryHorizon, horizonUnit: x.horizonUnit } : null; })(), history: (historyBySignal.get(x.id) ?? []).sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()).map((snapshot) => ({ id: snapshot.id, capturedDay: snapshot.capturedDay, capturedAt: snapshot.capturedAt.toISOString(), currentPrice: snapshot.currentPrice, returnPct: snapshot.returnPct, distanceTarget1Pct: snapshot.distanceTarget1Pct, distanceInvalidationPct: snapshot.distanceInvalidationPct, daysSinceEntry: snapshot.daysSinceEntry })) }); });
      const page = pageSlice(allSignals, args.limit ?? 20, args.cursor);
      const signals = page.items.map((signal) => {
        // The tracker reads the immutable issuance ATR rather than fetching a new
        // series and retroactively changing the displayed risk contract.
        const atr14 = signal.invalidationAtr14;
        const room = signal.invalidationLevel != null && atr14 != null && atr14 > 0 ? Math.abs(signal.entryPrice - signal.invalidationLevel) / atr14 : null;
        return { ...signal, roomToBreatheAtr: room == null ? null : round(room, 3), tightInvalidation: room == null ? null : room < 0.75, invalidationGrade: room == null ? null : "VOLATILITY" as const };
      });
      const brief = briefs[0]; const latestBrief = brief ? { id: brief.id, capturedDay: brief.capturedDay, summary: withLiveTrackerCounts(brief.summary, liveState), trackedCount: liveState.trackedCount, approachingTargetCount: brief.approachingTargetCount, approachingInvalidationCount: brief.approachingInvalidationCount, sourceAsOf: brief.sourceAsOf.toISOString(), createdAt: brief.createdAt.toISOString() } : null;
      return { cohort: cohortDescriptor, signals, stats, outcomeCounts: { issued: liveState.trackedCount, open: liveState.openCount, resolved: liveState.settledCount, ambiguous: liveState.ambiguousCount, unverified: liveState.unverifiedCount }, latestBrief, nextCursor: page.nextCursor };
    }
  }),
  listSuppressedSignalCandidates: defineAction({
    request: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    response: z.object({ candidates: z.array(z.object({ id: z.number(), symbol: z.string(), name: z.string(), setupType: z.string(), direction: z.enum(["long", "short"]), agreementScore: z.number(), entryPrice: z.number(), invalidationLevel: z.number(), signalDate: z.string(), signalDayOpen: z.number().nullable(), signalDayHigh: z.number().nullable(), signalDayLow: z.number().nullable(), signalDayClose: z.number().nullable(), reason: z.string(), origin: z.enum(["tracker", "discovery"]), sourceAsOf: z.string().nullable(), sourceUrl: z.string().nullable(), context: z.object({ belowSma50: z.boolean().nullable(), lowerHighs: z.boolean().nullable(), trend20Negative: z.boolean().nullable() }), createdAt: z.string() })), total: z.number().int().nonnegative() }),
    async handler(ctx, args) {
      const rows = await ctx.db<typeof schema>().select().from(schema.suppressedSignalCandidates).orderBy(desc(schema.suppressedSignalCandidates.createdAt));
      return { total: rows.length, candidates: rows.slice(0, args.limit ?? 25).map((row) => { let context: { belowSma50: boolean | null; lowerHighs: boolean | null; trend20Negative: boolean | null } = { belowSma50: null, lowerHighs: null, trend20Negative: null }; try { const parsed = JSON.parse(row.contextJson) as Partial<typeof context>; context = { belowSma50: typeof parsed.belowSma50 === "boolean" ? parsed.belowSma50 : null, lowerHighs: typeof parsed.lowerHighs === "boolean" ? parsed.lowerHighs : null, trend20Negative: typeof parsed.trend20Negative === "boolean" ? parsed.trend20Negative : null }; } catch { /* retain null measurement fields */ } return { id: row.id, symbol: row.symbol, name: row.instrumentName, setupType: row.setupType, direction: row.direction, agreementScore: row.agreementScore, entryPrice: row.entryPrice, invalidationLevel: row.invalidationLevel, signalDate: row.signalDate, signalDayOpen: row.signalDayOpen, signalDayHigh: row.signalDayHigh, signalDayLow: row.signalDayLow, signalDayClose: row.signalDayClose, reason: row.reason, origin: row.origin, sourceAsOf: row.sourceAsOf, sourceUrl: row.sourceUrl, context, createdAt: row.createdAt.toISOString() }; }) };
    },
  }),
  getScorecard: defineAction({
    request: z.object({}), response: scorecardResponse,
    async handler(ctx): Promise<z.infer<typeof scorecardResponse>> {
      const db = ctx.db<typeof schema>();
      const [signals, revisions, briefs] = await Promise.all([db.select().from(schema.trackedSignals).orderBy(asc(schema.trackedSignals.id)), db.select().from(schema.signalEvaluationRevisions).orderBy(asc(schema.signalEvaluationRevisions.id)), db.select().from(schema.signalDailyBriefs).orderBy(desc(schema.signalDailyBriefs.sourceAsOf)).limit(1)]);
      const cohortSignals = signals.filter((signal) => signal.strategyId === SIGNAL_STRATEGY_ID && signal.strategyVersion === SIGNAL_STRATEGY_VERSION && signal.parameterHash === SIGNAL_PARAMETER_HASH && signal.primaryHorizon === 30 && signal.horizonUnit === "trading_sessions" && signal.priceBasis === cohortDescriptor.priceConvention && signal.entryRule === "Reference entry equals the completed adjusted daily close; paper execution is not claimed");
      const current = acceptedEvaluationRevisionsForCohort(revisions, new Set([activeCohortKey("trade_setup")])); const setupRows = cohortSignals.map((signal) => ({ signal, evaluation: current.get(`${signal.id}|trade_setup`) }));
      const settled = setupRows.filter((row) => row.evaluation && (row.evaluation.verdict === "HIT" || row.evaluation.verdict === "MISS" || row.evaluation.verdict === "TIME_EXIT"));
      const hits = settled.filter((row) => row.evaluation?.verdict === "HIT").length; const misses = settled.length - hits;
      const split = (label: string, rows: typeof settled) => ({ label, hits: rows.filter((row) => row.evaluation?.verdict === "HIT").length, closed: rows.length });
      const byDirection = (["long", "short"] as const).map((direction) => split(direction, settled.filter((row) => row.signal.direction === direction)));
      const bandFor = (score: number) => Math.abs(score) < 65 ? "|score| below 65" : Math.abs(score) < 80 ? "|score| 65–79" : "|score| 80–100";
      const byScoreBand = ["|score| below 65", "|score| 65–79", "|score| 80–100"].map((band) => split(band, settled.filter((row) => bandFor(row.signal.confidence) === band)));
      const ambiguous = setupRows.filter((row) => row.evaluation?.verdict === "AMBIGUOUS").length; const unverified = setupRows.filter((row) => row.evaluation?.verdict === "UNVERIFIED").length; const open = setupRows.filter((row) => !row.evaluation || row.evaluation.verdict === "OPEN").length;
      const latestEvaluationAt = revisions.at(-1)?.evaluatedAt.toISOString() ?? null; const latestSignalAt = signals.map((row) => row.updatedAt.getTime()).sort((a, b) => b - a)[0]; const trackerAsOf = latestSignalAt == null ? null : new Date(latestSignalAt).toISOString(); const brief = briefs[0];
      return {
        cohort: cohortDescriptor,
        trackRecord: { tracked: cohortSignals.length, gradedClosed: settled.length, open, hits, misses, hitRate: settled.length ? round(hits / settled.length * 100) : null, sampleNote: `resolved n=${settled.length}; issued denominator=${cohortSignals.length}`, excluded: { ambiguous, stale: 0, unverified }, byDirection, byScoreBand },
        expectancy: { status: "collecting", closed: settled.length, minimum: 10, averageNetR: null, buyAndHoldNetR: null, randomEntryNetR: null, costBps: 18, note: "No net expectancy is reported: these trade setups have unknown execution costs. The 18 bps scenario remains a separate modeled convention, not measured execution." },
        runnerRecall: { status: "no_live_runs", firstLiveRun: "2026-10-06T06:00:00-04:00", fast: null, slow: null, note: "No prospectively verified discovery run is available in this ledger.", dryRunNote: "Historical dry-run claims are preserved outside this accepted evaluation read model." },
        calibration: { status: "collecting", minimum: 20, note: "Agreement score is not probability. Sample sufficiency alone never establishes edge." },
        honesty: { sources: [{ label: `Accepted ${SIGNAL_EVALUATOR_VERSION} trade-setup revisions`, asOf: latestEvaluationAt }, { label: "Immutable tracked-signal ledger", asOf: trackerAsOf }, { label: "Legacy daily brief (historical context only)", asOf: brief?.sourceAsOf.toISOString() ?? null }], asOf: new Date(Math.max(latestSignalAt ?? 0, revisions.at(-1)?.evaluatedAt.getTime() ?? 0, brief?.sourceAsOf.getTime() ?? 0)).toISOString(), exclusionSummary: `OPEN ${open} · AMBIGUOUS ${ambiguous} · UNVERIFIED ${unverified}; issued denominator ${cohortSignals.length}, resolved denominator ${settled.length}.`, verdictLedgerSettled: settled.length, terminalBriefSettled: settled.length, disagreement: false, note: "Versioned evaluation revisions are authoritative. Legacy verdict rows remain preserved but are not used by this scorecard." },
      };
    },
  }),

  recordSignalVerdict: defineAction({
    request: z.object({ signalId: z.number().int().positive(), verdict: scorecardVerdict, gradedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), evidence: z.string().trim().min(1).max(500).regex(/^[^\r\n]+$/) }), response: recordSignalVerdictResponse,
    async handler(ctx, args): Promise<z.infer<typeof recordSignalVerdictResponse>> {
      const db = ctx.db<typeof schema>();
      const signal = await db.select({ id: schema.trackedSignals.id }).from(schema.trackedSignals).where(eq(schema.trackedSignals.id, args.signalId)).limit(1);
      if (!signal[0]) return { ok: false, message: "Signal not found; no verdict was recorded." };
      const now = new Date();
      await db.insert(schema.scorecardVerdicts).values({ ...args, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.scorecardVerdicts.signalId, set: { verdict: args.verdict, gradedDate: args.gradedDate, evidence: args.evidence, updatedAt: now } });
      ctx.invalidateQueries();
      return { ok: true, message: `Verdict recorded for signal ${args.signalId}.` };
    },
  }),
  getJournalAnalytics: defineAction({ request: z.object({}), response: z.object({ closed: z.number(), winRate: z.number().nullable(), avgR: z.number().nullable(), expectancy: z.number().nullable(), avgWin: z.number().nullable(), avgLoss: z.number().nullable(), rDefinition: z.string(), todayR: z.number(), groups: z.array(z.object({ label: z.string(), trades: z.number(), winRate: z.number(), avgR: z.number(), expectancy: z.number(), killSuggested: z.boolean() })), exposures: z.array(z.object({ factor: z.string(), positions: z.number(), grossNotional: z.number(), netNotional: z.number(), longNotional: z.number(), shortNotional: z.number() })), portfolio: z.object({ openPositions: z.number(), grossNotional: z.number(), netNotional: z.number(), longNotional: z.number(), shortNotional: z.number() }) }), async handler(ctx) { const rows = await ctx.db<typeof schema>().select().from(schema.trades); const closed = rows.filter((x) => x.rMultiple != null); const grouped = new Map<string, number[]>(); for (const row of closed) { const key = `${row.setup} · ${row.direction}`; grouped.set(key, [...(grouped.get(key) ?? []), row.rMultiple ?? 0]); } const groups = [...grouped.entries()].map(([label, values]) => { const wins = values.filter((value) => value > 0); const losses = values.filter((value) => value <= 0); const hitRate = wins.length / values.length; const avgWin = average(wins) ?? 0; const avgLoss = Math.abs(average(losses) ?? 0); const expectancy = hitRate * avgWin - (1 - hitRate) * avgLoss; return { label, trades: values.length, winRate: round(hitRate * 100), avgR: round(average(values) ?? 0), expectancy: round(expectancy), killSuggested: expectancy < 0 }; }); const wins = closed.filter((x) => (x.rMultiple ?? 0) > 0); const losses = closed.filter((x) => (x.rMultiple ?? 0) <= 0); const winRate = closed.length ? wins.length / closed.length : null; const avgWin = average(wins.map((x) => x.rMultiple ?? 0)) ?? 0; const avgLoss = Math.abs(average(losses.map((x) => x.rMultiple ?? 0)) ?? 0); const today = new Date().toISOString().slice(0, 10); const todayR = rows.filter((row) => row.tradeDate === today && row.rMultiple != null).reduce((sum, row) => sum + (row.rMultiple ?? 0), 0); const open = rows.filter((row) => row.exitPrice == null); const exposureMap = new Map<string, { positions: number; grossNotional: number; netNotional: number; longNotional: number; shortNotional: number }>(); for (const row of open) { const notional = Math.abs(row.entry * row.size); const prior = exposureMap.get(row.setup) ?? { positions: 0, grossNotional: 0, netNotional: 0, longNotional: 0, shortNotional: 0 }; prior.positions++; prior.grossNotional += notional; prior.netNotional += row.direction === "long" ? notional : -notional; if (row.direction === "long") prior.longNotional += notional; else prior.shortNotional += notional; exposureMap.set(row.setup, prior); } const exposures = [...exposureMap.entries()].map(([factor, values]) => ({ factor, ...values })).sort((a, b) => b.grossNotional - a.grossNotional); const portfolio = exposures.reduce((sum, row) => ({ openPositions: sum.openPositions + row.positions, grossNotional: sum.grossNotional + row.grossNotional, netNotional: sum.netNotional + row.netNotional, longNotional: sum.longNotional + row.longNotional, shortNotional: sum.shortNotional + row.shortNotional }), { openPositions: 0, grossNotional: 0, netNotional: 0, longNotional: 0, shortNotional: 0 }); return { closed: closed.length, winRate: winRate == null ? null : round(winRate * 100), avgR: closed.length ? round(average(closed.map((x) => x.rMultiple ?? 0)) ?? 0) : null, expectancy: winRate == null ? null : round(winRate * avgWin - (1 - winRate) * avgLoss), avgWin: wins.length ? round(avgWin) : null, avgLoss: losses.length ? round(avgLoss) : null, rDefinition: "Journal R is the realized P&L divided by the initial dollar risk chosen for that trade. It is entered by the user; it is not derived from the model’s 1.5R/2.5R reference targets. A realized win can exceed 2.5R after trailing, scaling, or an exit beyond target. If initial risk or realized P&L is not known, leave R blank; the trade is excluded from R analytics.", todayR: round(todayR), groups, exposures, portfolio }; } }),
  getResearch: defineAction({ request: z.object({ symbol: z.string().min(1).max(30), name: z.string().max(120) }), response: z.object({ results: z.array(z.object({ title: z.string(), url: z.string(), source: z.string(), snippet: z.string(), publishedAt: z.string().nullable() })) }), async handler(ctx, args) { const r = await ctx.tool.web_search(`${args.symbol} ${args.name} latest earnings news SEC filing`); return { results: (r.content?.results ?? []).filter((x) => !x.is_index_page && x.url).slice(0, 8).map((x) => ({ title: x.title, url: x.url ?? "", source: x.source ?? "Unknown source", snippet: x.snippet ?? "", publishedAt: x.published_at })) }; } }),
  listTrades: defineAction({ request: z.object({}), response: z.object({ trades: z.array(tradeShape) }), async handler(ctx) { const rows = await ctx.db<typeof schema>().select().from(schema.trades).orderBy(desc(schema.trades.tradeDate), desc(schema.trades.id)); return { trades: rows.map(mapTrade) }; } }),
  saveTrade: defineAction({ request: tradeInput, response: z.object({ trade: tradeShape }), async handler(ctx, args) { const rows = await ctx.db<typeof schema>().insert(schema.trades).values(args).returning(); const row = rows[0]; if (!row) throw new Error("Trade could not be saved"); ctx.invalidateQueries(); return { trade: mapTrade(row) }; } }),
  updateTrade: defineAction({ request: tradeInput.extend({ id: z.number().int().positive() }), response: z.object({ trade: tradeShape }), async handler(ctx, args) { const { id, ...values } = args; const rows = await ctx.db<typeof schema>().update(schema.trades).set({ ...values, updatedAt: new Date() }).where(eq(schema.trades.id, id)).returning(); const row = rows[0]; if (!row) throw new Error("Trade was not found"); ctx.invalidateQueries(); return { trade: mapTrade(row) }; } }),
  deleteTrade: defineAction({ request: z.object({ id: z.number().int().positive() }), response: z.object({ ok: z.boolean() }), async handler(ctx, args) { await ctx.db<typeof schema>().delete(schema.trades).where(eq(schema.trades.id, args.id)); ctx.invalidateQueries(); return { ok: true }; } }),
  listRules: defineAction({ request: z.object({}), response: z.object({ rules: z.array(ruleShape) }), async handler(ctx) { const rows = await ctx.db<typeof schema>().select().from(schema.tradingRules).orderBy(asc(schema.tradingRules.sortOrder), asc(schema.tradingRules.id)); return { rules: rows.map(mapRule) }; } }),
  saveRule: defineAction({ request: z.object({ text: z.string().min(1).max(300) }), response: z.object({ rule: ruleShape }), async handler(ctx, args) { const existing = await ctx.db<typeof schema>().select().from(schema.tradingRules); const rows = await ctx.db<typeof schema>().insert(schema.tradingRules).values({ text: args.text, sortOrder: existing.length }).returning(); const row = rows[0]; if (!row) throw new Error("Rule could not be saved"); ctx.invalidateQueries(); return { rule: mapRule(row) }; } }),
  updateRule: defineAction({ request: z.object({ id: z.number().int().positive(), text: z.string().min(1).max(300), checked: z.boolean() }), response: z.object({ rule: ruleShape }), async handler(ctx, args) { const rows = await ctx.db<typeof schema>().update(schema.tradingRules).set({ text: args.text, checked: args.checked, updatedAt: new Date() }).where(eq(schema.tradingRules.id, args.id)).returning(); const row = rows[0]; if (!row) throw new Error("Rule was not found"); ctx.invalidateQueries(); return { rule: mapRule(row) }; } }),
  deleteRule: defineAction({ request: z.object({ id: z.number().int().positive() }), response: z.object({ ok: z.boolean() }), async handler(ctx, args) { await ctx.db<typeof schema>().delete(schema.tradingRules).where(eq(schema.tradingRules.id, args.id)); ctx.invalidateQueries(); return { ok: true }; } }),
} satisfies ActionsModule;

void _currentCycleClock;
