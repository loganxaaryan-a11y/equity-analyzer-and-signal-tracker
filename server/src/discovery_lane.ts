// discovery-lane/v1 — display-only broad-market mover watch.
// Separately versioned from the frozen S&P 100 trial. This lane NEVER touches
// trial eligibility, scoring, issuance gates, or grading: it reads keyless
// Yahoo Finance data, classifies abnormal movers into T2, keeps the rest of the
// broad universe on lightweight T3 tracking, and persists its own tables only.
// Zero Alpha Vantage calls by construction (no AV import, no AV code path).
//
// Data design (keyless Yahoo only):
//   Pass 1 — v7 spark batches (20 symbols/request): price, listing venue,
//            instrument type, previous-close + intraday returns, and the two
//            volume-free categories (large_move, volatility_expansion).
//   Pass 2 — v8 chart per symbol, bounded: verifies 20d dollar-volume floors
//            and enables the abnormal_volume category. Priority: category
//            hitters first, then rolling refresh of the stalest liquidity
//            baselines. Baselines persist in discovery_lane_liquidity.
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import type { Ctx } from "@hatch/space-sdk";
import * as schema from "./schema";

export const DISCOVERY_LANE_VERSION = "discovery-lane/v1";

// Exact, frozen category + floor thresholds for this lane version.
export const LANE_THRESHOLDS = {
  minPrice: 2.0, // USD — penny-stock filter
  minDollarVolumeBroad: 5_000_000, // 20d avg dollar volume, broad segment
  minDollarVolumeSmallcap: 500_000, // 20d avg dollar volume, small-cap segment
  minDailyBars: 21, // 20d baseline + current session
  liquidityFreshDays: 30, // baseline older than this is re-verified
  maxV8PerRun: 60, // bound on per-symbol volume verification calls (keeps a full run under the 120s action limit)
  staleRunMinutes: 20, // a "running" run older than this is marked failed (action timeout recovery)
  largeMovePct: 10, // |previous-close return| >= 10% — large-move alert category
  abnormalRelVolume: 2.5, // today's volume >= 2.5x 20d average
  abnormalVolumeMinMovePct: 2, // ...with at least a 2% price move
  volatilityZ: 2.0, // |return| >= 2.0 sigma of 20d daily returns
  volatilityMinMovePct: 3, // ...with at least a 3% absolute move
} as const;

export type LaneSegment = "broad" | "smallcap";
export type LaneTier = "t2" | "t3" | "unverified" | "excluded";

const LIQUID_ETF_UNIVERSE: Array<{ symbol: string; name: string }> = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF" }, { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF" }, { symbol: "IWM", name: "iShares Russell 2000 ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF" }, { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" }, { symbol: "IVV", name: "iShares Core S&P 500 ETF" },
  { symbol: "IJH", name: "iShares Core S&P Mid-Cap ETF" }, { symbol: "IJR", name: "iShares Core S&P Small-Cap ETF" },
  { symbol: "VB", name: "Vanguard Small-Cap ETF" }, { symbol: "VO", name: "Vanguard Mid-Cap ETF" },
  { symbol: "VEA", name: "Vanguard FTSE Developed Markets ETF" }, { symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF" },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets ETF" }, { symbol: "EFA", name: "iShares MSCI EAFE ETF" },
  { symbol: "XLK", name: "Technology Select Sector SPDR" }, { symbol: "XLF", name: "Financial Select Sector SPDR" },
  { symbol: "XLE", name: "Energy Select Sector SPDR" }, { symbol: "XLV", name: "Health Care Select Sector SPDR" },
  { symbol: "XLI", name: "Industrial Select Sector SPDR" }, { symbol: "XLP", name: "Consumer Staples Select Sector SPDR" },
  { symbol: "XLU", name: "Utilities Select Sector SPDR" }, { symbol: "XLB", name: "Materials Select Sector SPDR" },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR" }, { symbol: "XLC", name: "Communication Services Select Sector SPDR" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF" }, { symbol: "SOXX", name: "iShares Semiconductor ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF" }, { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF" }, { symbol: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF" },
  { symbol: "LQD", name: "iShares iBoxx Investment Grade Corporate Bond ETF" }, { symbol: "GLD", name: "SPDR Gold Shares" },
  { symbol: "SLV", name: "iShares Silver Trust" }, { symbol: "GDX", name: "VanEck Gold Miners ETF" },
  { symbol: "GDXJ", name: "VanEck Junior Gold Miners ETF" }, { symbol: "USO", name: "United States Oil Fund" },
  { symbol: "UNG", name: "United States Natural Gas Fund" }, { symbol: "VNQ", name: "Vanguard Real Estate ETF" },
  { symbol: "SCHD", name: "Schwab US Dividend Equity ETF" }, { symbol: "VYM", name: "Vanguard High Dividend Yield ETF" },
  { symbol: "SPYG", name: "SPDR Portfolio S&P 500 Growth ETF" }, { symbol: "SPYV", name: "SPDR Portfolio S&P 500 Value ETF" },
  { symbol: "VUG", name: "Vanguard Growth ETF" }, { symbol: "VTV", name: "Vanguard Value ETF" },
  { symbol: "MTUM", name: "iShares MSCI USA Momentum Factor ETF" }, { symbol: "QUAL", name: "iShares MSCI USA Quality Factor ETF" },
  { symbol: "USMV", name: "iShares MSCI USA Min Vol Factor ETF" }, { symbol: "SPLV", name: "Invesco S&P 500 Low Volatility ETF" },
  { symbol: "TQQQ", name: "ProShares UltraPro QQQ" }, { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ" },
  { symbol: "UVXY", name: "ProShares Ultra VIX Short-Term Futures ETF" },
];

const WIKI_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const WIKI_SP100_URL = "https://en.wikipedia.org/wiki/S&P_100";
const WIKI_SP600_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_600_companies";

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function htmlText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, "")).replace(/\[[0-9]+\]/g, "").trim();
}
function tableRows(html: string, constituentsTable: boolean): string[][] {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  const table = constituentsTable
    ? (tables.find((item) => /id="constituents"/i.test(item)) ?? "")
    : (tables.find((item) => /\bAAPL\b/i.test(item) && /\bMSFT\b/i.test(item)) ?? "");
  return (table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []).map((row) =>
    (row.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []).map(htmlText),
  );
}
type LaneProfile = { symbol: string; name: string; sector: string; segment: LaneSegment };
function profilesFromRows(rows: string[][], segment: LaneSegment): LaneProfile[] {
  const profiles = rows.flatMap((cells) => {
    const raw = (cells[0] ?? "").trim();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(raw)) return [];
    const symbol = raw.replace(/\./g, "-");
    return [{ symbol, name: cells[1] ?? symbol, sector: cells[2] ?? "Unclassified", segment }];
  });
  return [...new Map(profiles.map((p) => [p.symbol, p])).values()];
}

type YahooFetcher = (url: string) => Promise<Response>;
async function fetchText(fetchFn: YahooFetcher, url: string): Promise<string> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Universe source returned HTTP ${response.status}: ${url}`);
  return response.text();
}

type SparkMeta = {
  exchangeName?: string; fullExchangeName?: string; instrumentType?: string;
  regularMarketPrice?: number; regularMarketChangePercent?: number;
  regularMarketVolume?: number; regularMarketTime?: number;
};
type SparkResult = { symbol: string; meta: SparkMeta; closes: number[] };
type SparkResponse = {
  spark?: {
    result?: Array<{
      symbol?: string;
      response?: Array<{
        meta?: SparkMeta;
        indicators?: { quote?: Array<{ close?: Array<number | null> }>; adjclose?: Array<{ adjclose?: Array<number | null> }> };
      }>;
    }>;
  };
};
async function sparkBatch(fetchFn: YahooFetcher, symbols: string[]): Promise<SparkResult[]> {
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols.join(","))}&range=1mo&interval=1d`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Yahoo spark returned HTTP ${response.status}.`);
  const payload = (await response.json()) as SparkResponse;
  const out: SparkResult[] = [];
  for (const item of payload.spark?.result ?? []) {
    const symbol = item.symbol?.toUpperCase(); const chart = item.response?.[0];
    if (!symbol || !chart) continue;
    const rawCloses = chart.indicators?.adjclose?.[0]?.adjclose ?? chart.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
    out.push({ symbol, meta: chart.meta ?? {}, closes });
  }
  return out;
}

type V8Quote = { close: Array<number | null>; volume: Array<number | null> };
type V8Response = { chart?: { result?: Array<{ indicators?: { quote?: V8Quote[] } }> } };
async function v8DailyBars(fetchFn: YahooFetcher, symbol: string): Promise<{ closes: number[]; volumes: number[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo&events=div%2Csplits`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Yahoo chart returned HTTP ${response.status} for ${symbol}.`);
  const payload = (await response.json()) as V8Response;
  const quote = payload.chart?.result?.[0]?.indicators?.quote?.[0];
  const closes = (quote?.close ?? []).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  const volumes = (quote?.volume ?? []).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0);
  return { closes, volumes };
}

function round(value: number, places = 2): number {
  const f = 10 ** places; return Math.round(value * f) / f;
}
function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!; const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export type LaneCategory = "large_move" | "abnormal_volume" | "volatility_expansion";
const CATEGORY_LABELS: Record<LaneCategory, string> = {
  large_move: `Large-move alert: |previous-close return| ≥ ${LANE_THRESHOLDS.largeMovePct}%`,
  abnormal_volume: `Abnormal volume: ≥ ${LANE_THRESHOLDS.abnormalRelVolume}x 20d average volume with ≥ ${LANE_THRESHOLDS.abnormalVolumeMinMovePct}% move`,
  volatility_expansion: `Volatility expansion: move ≥ ${LANE_THRESHOLDS.volatilityZ}σ of 20d daily returns with ≥ ${LANE_THRESHOLDS.volatilityMinMovePct}% absolute move`,
};

type Pass1 = {
  profile: LaneProfile; spark: SparkResult;
  price: number; prevCloseReturnPct: number; intradayReturnPct: number | null;
  returnZ: number | null; observedAt: Date | null;
  exchange: string | null; instrumentType: string | null;
  volumeFreeCategories: Array<"large_move" | "volatility_expansion">;
  failReason: string | null;
};

function pass1(profile: LaneProfile, spark: SparkResult | undefined): Pass1 | null {
  if (!spark) return null;
  const closes = spark.closes;
  const exchange = spark.meta.exchangeName ?? spark.meta.fullExchangeName ?? null;
  const instrumentType = spark.meta.instrumentType ?? null;
  const observedAt = typeof spark.meta.regularMarketTime === "number" ? new Date(spark.meta.regularMarketTime * 1000) : null;
  if (closes.length < LANE_THRESHOLDS.minDailyBars) {
    return { profile, spark, price: NaN, prevCloseReturnPct: NaN, intradayReturnPct: null, returnZ: null, observedAt, exchange, instrumentType, volumeFreeCategories: [], failReason: `Only ${closes.length} daily bars; need ${LANE_THRESHOLDS.minDailyBars} for the 20d baseline.` };
  }
  const price = spark.meta.regularMarketPrice != null && spark.meta.regularMarketPrice > 0 ? spark.meta.regularMarketPrice : closes[closes.length - 1]!;
  const lastClose = closes[closes.length - 1]!; const priorClose = closes[closes.length - 2]!;
  const prevCloseReturnPct = round((lastClose / priorClose - 1) * 100, 2);
  const intradayReturnPct = typeof spark.meta.regularMarketChangePercent === "number" ? round(spark.meta.regularMarketChangePercent, 2) : null;
  const baseline = closes.slice(-21, -1);
  const dailyReturns = baseline.slice(1).map((c, i) => (c / baseline[i]! - 1) * 100);
  const sigma = stdev(dailyReturns);
  const returnZ = sigma != null && sigma > 0 ? round(Math.abs(prevCloseReturnPct) / sigma, 2) : null;
  const volumeFreeCategories: Array<"large_move" | "volatility_expansion"> = [];
  if (Math.abs(prevCloseReturnPct) >= LANE_THRESHOLDS.largeMovePct) volumeFreeCategories.push("large_move");
  if (returnZ != null && returnZ >= LANE_THRESHOLDS.volatilityZ && Math.abs(prevCloseReturnPct) >= LANE_THRESHOLDS.volatilityMinMovePct) volumeFreeCategories.push("volatility_expansion");
  const instrumentOk = instrumentType == null || ["EQUITY", "ETF"].includes(instrumentType.toUpperCase());
  let failReason: string | null = null;
  if (price < LANE_THRESHOLDS.minPrice) failReason = `Price $${round(price)} below the $${LANE_THRESHOLDS.minPrice} liquidity floor.`;
  else if (!instrumentOk) failReason = `Instrument type ${instrumentType} is not EQUITY/ETF.`;
  return { profile, spark, price, prevCloseReturnPct, intradayReturnPct, returnZ, observedAt, exchange, instrumentType, volumeFreeCategories, failReason };
}

export type LaneRowInput = {
  symbol: string; instrumentName: string; sector: string; segment: LaneSegment;
  tier: LaneTier; trackingMode: "full" | "lightweight"; categories: LaneCategory[];
  price: number | null; dollarVolume20d: number | null;
  prevCloseReturnPct: number | null; intradayReturnPct: number | null;
  relVolume: number | null; returnZ: number | null;
  exchange: string | null; instrumentType: string | null;
  observedAt: Date | null; reason: string;
};

function finalize(
  p1: Pass1,
  liquidity: { avgDollarVolume20d: number | null; avgVolume20d: number | null; fresh: boolean } | null,
  todayVolume: number | null,
): LaneRowInput {
  const base = {
    symbol: p1.profile.symbol, instrumentName: p1.profile.name, sector: p1.profile.sector, segment: p1.profile.segment,
    exchange: p1.exchange, instrumentType: p1.instrumentType,
    price: Number.isFinite(p1.price) ? round(p1.price) : null,
    prevCloseReturnPct: Number.isFinite(p1.prevCloseReturnPct) ? p1.prevCloseReturnPct : null,
    intradayReturnPct: p1.intradayReturnPct, returnZ: p1.returnZ, observedAt: p1.observedAt,
  };
  if (p1.failReason) {
    return { ...base, tier: "excluded", trackingMode: "lightweight", categories: [], dollarVolume20d: null, relVolume: null, reason: p1.failReason };
  }
  const floor = p1.profile.segment === "broad" ? LANE_THRESHOLDS.minDollarVolumeBroad : LANE_THRESHOLDS.minDollarVolumeSmallcap;
  if (!liquidity || !liquidity.fresh || liquidity.avgDollarVolume20d == null) {
    return { ...base, tier: "unverified", trackingMode: "lightweight", categories: [], dollarVolume20d: liquidity?.avgDollarVolume20d != null ? round(liquidity.avgDollarVolume20d) : null, relVolume: null, reason: "Liquidity baseline unverified — queued for the rolling verification pass. Not counted in T2/T3 until the dollar-volume floor is confirmed." };
  }
  const dollarVolume20d = round(liquidity.avgDollarVolume20d);
  if (liquidity.avgDollarVolume20d < floor) {
    return { ...base, tier: "excluded", trackingMode: "lightweight", categories: [], dollarVolume20d, relVolume: null, reason: `20d avg dollar volume $${Math.round(liquidity.avgDollarVolume20d).toLocaleString()} below the $${(floor / 1_000_000).toFixed(1)}M ${p1.profile.segment} floor.` };
  }
  const categories: LaneCategory[] = [...p1.volumeFreeCategories];
  let relVolume: number | null = null;
  if (liquidity.avgVolume20d != null && liquidity.avgVolume20d > 0 && todayVolume != null) {
    relVolume = round(todayVolume / liquidity.avgVolume20d, 2);
    if (relVolume >= LANE_THRESHOLDS.abnormalRelVolume && Math.abs(p1.prevCloseReturnPct) >= LANE_THRESHOLDS.abnormalVolumeMinMovePct) categories.push("abnormal_volume");
  }
  const tier: LaneTier = categories.length ? "t2" : "t3";
  const closes = p1.spark.closes;
  const velocity5d = round((closes[closes.length - 1]! / closes[closes.length - 6]! - 1) * 100, 2);
  return {
    ...base, tier, trackingMode: tier === "t2" ? "full" : "lightweight", categories,
    dollarVolume20d, relVolume,
    reason: tier === "t2"
      ? categories.map((c) => CATEGORY_LABELS[c]).join(" · ")
      : `No abnormal-move category hit; retained on lightweight velocity tracking (5d ${velocity5d}%). Dollar-volume floor verified.`,
  };
}

const laneRowSchema = z.object({
  symbol: z.string(), instrumentName: z.string(), sector: z.string(),
  segment: z.enum(["broad", "smallcap"]), tier: z.enum(["t2", "t3", "unverified", "excluded"]),
  trackingMode: z.enum(["full", "lightweight"]),
  categories: z.array(z.enum(["large_move", "abnormal_volume", "volatility_expansion"])),
  categoryLabels: z.array(z.string()),
  price: z.number().nullable(), dollarVolume20d: z.number().nullable(),
  prevCloseReturnPct: z.number().nullable(), intradayReturnPct: z.number().nullable(),
  prevCloseBasis: z.literal("previous_close"), intradayBasis: z.literal("intraday"),
  relVolume: z.number().nullable(), returnZ: z.number().nullable(),
  exchange: z.string().nullable(), instrumentType: z.string().nullable(),
  dataSource: z.string(), observedAt: z.string().nullable(), reason: z.string(),
});

const laneRunSchema = z.object({
  id: z.number(), laneVersion: z.string(), status: z.enum(["running", "ok", "partial", "failed"]),
  universeBroadCount: z.number(), universeSmallcapCount: z.number(),
  screenedCount: z.number(), t2Count: z.number(), t3Count: z.number(),
  unverifiedCount: z.number(), excludedCount: z.number(),
  yahooRequests: z.number(), v8Verifications: z.number(), alphaVantageCalls: z.number(),
  note: z.string(), startedAt: z.string(), completedAt: z.string().nullable(),
});

export const discoveryLaneResponse = z.object({
  run: laneRunSchema.nullable(),
  t2: z.array(laneRowSchema), t3: z.array(laneRowSchema),
  unverifiedCount: z.number(), excludedCount: z.number(),
  methodology: z.string(),
  categories: z.array(z.object({ key: z.string(), label: z.string() })),
  universeDefinition: z.string(),
  quota: z.object({ alphaVantageCallsThisRun: z.number(), alphaVantageCeiling: z.number(), note: z.string() }),
  frozenBoundary: z.string(),
});

export const discoveryLaneRunResponse = z.object({
  ok: z.boolean(),
  run: laneRunSchema,
  note: z.string(),
});

const METHODOLOGY = `T2 = non-S&P-100 names clearing at least one abnormal-move category (large-move alert, abnormal volume, or volatility expansion) with the dollar-volume floor verified; shown with full detail. T3 = the verified remainder on lightweight tracking; no directional score, no signal, never enters the trial. Unverified = names awaiting liquidity-baseline verification (counted, queued for the rolling pass). Categories evaluate completed-session (previous-close basis) returns only; intraday returns are shown for context with their basis labeled. The S&P 100 trial population is untouched.`;
const UNIVERSE_DEFINITION = `Broad segment: S&P 500 ex-S&P-100 constituents plus a curated liquid-ETF list (NYSE/NASDAQ/NYSE American listings at curation; exchange re-verified per scan from Yahoo metadata). Small-cap segment: S&P 600 constituents. Coverage floors applied live per scan: price ≥ $2.00, 20d average dollar volume ≥ $5M (broad) or ≥ $500K (small-cap) verified via rolling keyless Yahoo volume baselines, instrument type EQUITY/ETF, ≥ 21 daily bars, Yahoo data available. S&P 100 names are excluded from this lane entirely — they are the frozen trial population.`;
const FROZEN_BOUNDARY = `DISPLAY-ONLY · NOT TRIAL · discovery-lane/v1. This lane cannot change trial eligibility, factor scores, issuance gates, or grading. The S&P 100 remains the measured trial population. Any change to trial mechanics requires an explicit amendment or a separate cohort.`;

function mapRow(row: typeof schema.discoveryLaneRows.$inferSelect): z.infer<typeof laneRowSchema> {
  let categories: LaneCategory[] = [];
  try { categories = JSON.parse(row.categoriesJson) as LaneCategory[]; } catch { categories = []; }
  return {
    symbol: row.symbol, instrumentName: row.instrumentName, sector: row.sector,
    segment: row.segment, tier: row.tier, trackingMode: row.trackingMode,
    categories, categoryLabels: categories.map((c) => CATEGORY_LABELS[c]),
    price: row.price, dollarVolume20d: row.dollarVolume20d,
    prevCloseReturnPct: row.prevCloseReturnPct, intradayReturnPct: row.intradayReturnPct,
    prevCloseBasis: "previous_close" as const, intradayBasis: "intraday" as const,
    relVolume: row.relVolume, returnZ: row.returnZ,
    exchange: row.exchange, instrumentType: row.instrumentType,
    dataSource: row.dataSource, observedAt: row.observedAt?.toISOString() ?? null, reason: row.reason,
  };
}
function mapRun(row: typeof schema.discoveryLaneRuns.$inferSelect): z.infer<typeof laneRunSchema> {
  return {
    id: row.id, laneVersion: row.laneVersion, status: row.status,
    universeBroadCount: row.universeBroadCount, universeSmallcapCount: row.universeSmallcapCount,
    screenedCount: row.screenedCount, t2Count: row.t2Count, t3Count: row.t3Count,
    unverifiedCount: row.unverifiedCount, excludedCount: row.excludedCount,
    yahooRequests: row.yahooRequests, v8Verifications: row.v8Verifications, alphaVantageCalls: row.alphaVantageCalls,
    note: row.note, startedAt: row.startedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
  };
}

const emptyPayload = {
  run: null, t2: [], t3: [], unverifiedCount: 0, excludedCount: 0, methodology: METHODOLOGY,
  categories: (Object.keys(CATEGORY_LABELS) as LaneCategory[]).map((key) => ({ key, label: CATEGORY_LABELS[key] })),
  universeDefinition: UNIVERSE_DEFINITION,
  quota: { alphaVantageCallsThisRun: 0, alphaVantageCeiling: 25, note: "Alpha Vantage is reserved for cached enrichment of shortlisted names. This lane never calls it; the broad scan and volume verification run on keyless Yahoo Finance." },
  frozenBoundary: FROZEN_BOUNDARY,
};

export async function readDiscoveryLane(ctx: Ctx): Promise<z.infer<typeof discoveryLaneResponse>> {
  const db = ctx.db<typeof schema>();
  await recoverStaleLaneRuns(db);
  const runs = await db.select().from(schema.discoveryLaneRuns).orderBy(desc(schema.discoveryLaneRuns.id)).limit(1);
  const run = runs[0];
  if (!run) return { ...emptyPayload };
  const rows = await db.select().from(schema.discoveryLaneRows).where(eq(schema.discoveryLaneRows.runId, run.id));
  const mapped = rows.map(mapRow);
  return {
    ...emptyPayload,
    run: mapRun(run),
    t2: mapped.filter((r) => r.tier === "t2"),
    t3: mapped.filter((r) => r.tier === "t3"),
    unverifiedCount: mapped.filter((r) => r.tier === "unverified").length,
    excludedCount: mapped.filter((r) => r.tier === "excluded").length,
    quota: { ...emptyPayload.quota, alphaVantageCallsThisRun: run.alphaVantageCalls },
  };
}

// A run stuck in "running" past the stale threshold never completed (the
// action hit its time limit). Mark it failed so the lane self-heals and the
// next run starts clean. Only touches this lane's own table.
async function recoverStaleLaneRuns(db: ReturnType<Ctx["db"]>): Promise<void> {
  const cutoff = new Date(Date.now() - LANE_THRESHOLDS.staleRunMinutes * 60 * 1000);
  const stuck = await db.select().from(schema.discoveryLaneRuns).where(eq(schema.discoveryLaneRuns.status, "running"));
  for (const row of stuck) {
    if (row.startedAt.getTime() < cutoff.getTime()) {
      await db.update(schema.discoveryLaneRuns).set({
        status: "failed",
        note: `Run ${row.id} did not complete within the action time limit; marked failed by stale-run recovery. Run the lane again.`,
        completedAt: new Date(),
      }).where(eq(schema.discoveryLaneRuns.id, row.id));
    }
  }
}

export async function executeDiscoveryLane(
  ctx: Ctx,
  fetchYahoo: YahooFetcher,
): Promise<z.infer<typeof discoveryLaneRunResponse>> {
  const db = ctx.db<typeof schema>();
  const startedAt = new Date();
  const runRows = await db.insert(schema.discoveryLaneRuns).values({
    laneVersion: DISCOVERY_LANE_VERSION, status: "running",
    universeBroadCount: 0, universeSmallcapCount: 0, screenedCount: 0,
    t2Count: 0, t3Count: 0, unverifiedCount: 0, excludedCount: 0,
    yahooRequests: 0, v8Verifications: 0, alphaVantageCalls: 0,
    note: "Discovery lane scan in progress.", startedAt, completedAt: null,
  }).returning();
  const run = runRows[0]!;
  let yahooRequests = 0; let v8Verifications = 0;
  const countedFetch: YahooFetcher = async (url) => { yahooRequests++; return fetchYahoo(url); };
  await recoverStaleLaneRuns(db);
  const heartbeat = async (note: string) => {
    try { await db.update(schema.discoveryLaneRuns).set({ note }).where(eq(schema.discoveryLaneRuns.id, run.id)); } catch { /* heartbeat is best-effort */ }
  };
  try {
    // Universe: S&P 500 ex-S&P 100 + liquid ETFs (broad); S&P 600 (small-cap).
    const [sp500Html, sp100Html, sp600Html] = await Promise.all([
      fetchText(countedFetch, WIKI_SP500_URL), fetchText(countedFetch, WIKI_SP100_URL), fetchText(countedFetch, WIKI_SP600_URL),
    ]);
    const sp500 = profilesFromRows(tableRows(sp500Html, false), "broad");
    const sp100 = new Set(profilesFromRows(tableRows(sp100Html, false), "broad").map((p) => p.symbol));
    const sp600 = profilesFromRows(tableRows(sp600Html, true), "smallcap");
    const broad = [...sp500.filter((p) => !sp100.has(p.symbol)), ...LIQUID_ETF_UNIVERSE.map((e) => ({ symbol: e.symbol, name: e.name, sector: "ETF", segment: "broad" as const }))];
    const smallcap = sp600.filter((p) => !sp100.has(p.symbol));
    const seen = new Set<string>(); const universe: LaneProfile[] = [];
    for (const p of [...broad, ...smallcap]) { if (!seen.has(p.symbol)) { seen.add(p.symbol); universe.push(p); } }

    // Pass 1: spark screen (price, venue, type, returns, volume-free categories).
    const sparkBySymbol = new Map<string, SparkResult>();
    let sparkFailed = 0; let batches = 0; let sparkNamesDone = 0;
    const sparkChunks: LaneProfile[][] = [];
    for (let start = 0; start < universe.length; start += 20) sparkChunks.push(universe.slice(start, start + 20));
    const screenChunk = async (chunk: LaneProfile[]) => {
      try {
        const results = await sparkBatch(countedFetch, chunk.map((p) => p.symbol));
        for (const r of results) sparkBySymbol.set(r.symbol, r);
      } catch { sparkFailed += chunk.length; }
      batches++; sparkNamesDone += chunk.length;
      if (batches % 15 === 0) await heartbeat(`Discovery lane scan in progress: price screen ${Math.min(sparkNamesDone, universe.length)}/${universe.length} names.`);
    };
    // Network starts remain spaced by the discovery fetcher; a four-request
    // window overlaps response latency without changing the 20-symbol batches.
    for (let start = 0; start < sparkChunks.length; start += 4) {
      await Promise.all(sparkChunks.slice(start, start + 4).map(screenChunk));
    }
    const p1BySymbol = new Map<string, Pass1>();
    for (const p of universe) { const p1 = pass1(p, sparkBySymbol.get(p.symbol)); if (p1) p1BySymbol.set(p.symbol, p1); }

    // Pass 2: bounded v8 volume verification. Priority: category hitters first
    // (T2 correctness), then rolling refresh of the stalest baselines.
    const freshCutoff = Date.now() - LANE_THRESHOLDS.liquidityFreshDays * 24 * 60 * 60 * 1000;
    const baselines = new Map((await db.select().from(schema.discoveryLaneLiquidity)).map((r) => [r.symbol, r] as const));
    const hitters = [...p1BySymbol.values()].filter((p) => !p.failReason && p.volumeFreeCategories.length > 0).map((p) => p.profile.symbol);
    const stale = [...p1BySymbol.values()]
      .filter((p) => !p.failReason && !hitters.includes(p.profile.symbol))
      .map((p) => ({ symbol: p.profile.symbol, at: baselines.get(p.profile.symbol)?.computedAt.getTime() ?? 0 }))
      .sort((a, b) => a.at - b.at)
      .map((r) => r.symbol);
    const v8Set = [...new Set([...hitters, ...stale])].slice(0, LANE_THRESHOLDS.maxV8PerRun);
    const now = new Date();
    let v8Done = 0;
    const verifyOne = async (symbol: string) => {
      try {
        const { closes, volumes } = await v8DailyBars(countedFetch, symbol);
        v8Verifications++;
        if (closes.length >= 20 && volumes.length >= 20) {
          const n = 20;
          const c = closes.slice(-n); const v = volumes.slice(-n);
          const dollarVols = c.map((price, i) => price * (v[i] ?? 0));
          const avgDollar = mean(dollarVols); const avgVol = mean(v.slice(-n));
          await db.insert(schema.discoveryLaneLiquidity).values({
            symbol, avgDollarVolume20d: avgDollar, avgVolume20d: avgVol, bars: n, computedAt: now,
          }).onConflictDoUpdate({ target: schema.discoveryLaneLiquidity.symbol, set: { avgDollarVolume20d: avgDollar, avgVolume20d: avgVol, bars: n, computedAt: now } });
          baselines.set(symbol, { symbol, avgDollarVolume20d: avgDollar, avgVolume20d: avgVol, bars: n, computedAt: now });
        }
      } catch { /* a failed v8 leaves the prior baseline; the name stays unverified */ }
      v8Done++;
      if (v8Done % 20 === 0) await heartbeat(`Discovery lane scan in progress: volume verification ${v8Done}/${v8Set.length} names.`);
    };
    // Keep hitter-priority order, but allow a small in-flight window. The
    // discovery fetcher still spaces every network start; overlapping response
    // latency is what creates the action-time headroom.
    for (let start = 0; start < v8Set.length; start += 4) {
      await Promise.all(v8Set.slice(start, start + 4).map(verifyOne));
    }

    const classified: LaneRowInput[] = [];
    for (const p of universe) {
      const p1 = p1BySymbol.get(p.symbol);
      if (!p1) {
        classified.push({
          symbol: p.symbol, instrumentName: p.name, sector: p.sector, segment: p.segment,
          tier: "excluded", trackingMode: "lightweight", categories: [],
          price: null, dollarVolume20d: null, prevCloseReturnPct: null, intradayReturnPct: null,
          relVolume: null, returnZ: null, exchange: null, instrumentType: null, observedAt: null,
          reason: "No Yahoo data returned for this symbol in this run.",
        });
        continue;
      }
      const bl = baselines.get(p.symbol) ?? null;
      const fresh = bl != null && bl.computedAt.getTime() >= freshCutoff;
      const todayVolume = p1.spark.meta.regularMarketVolume != null && p1.spark.meta.regularMarketVolume > 0
        ? p1.spark.meta.regularMarketVolume
        : null;
      classified.push(finalize(p1, bl ? { avgDollarVolume20d: bl.avgDollarVolume20d, avgVolume20d: bl.avgVolume20d, fresh } : null, todayVolume));
    }

    const t2 = classified.filter((r) => r.tier === "t2");
    const t3 = classified.filter((r) => r.tier === "t3");
    const unverified = classified.filter((r) => r.tier === "unverified");
    const excluded = classified.filter((r) => r.tier === "excluded");

    if (classified.length) {
      await db.insert(schema.discoveryLaneRows).values(classified.map((r) => ({
        runId: run.id, symbol: r.symbol, instrumentName: r.instrumentName, sector: r.sector, segment: r.segment,
        tier: r.tier, trackingMode: r.trackingMode, categoriesJson: JSON.stringify(r.categories),
        price: r.price, dollarVolume20d: r.dollarVolume20d,
        prevCloseReturnPct: r.prevCloseReturnPct, intradayReturnPct: r.intradayReturnPct,
        relVolume: r.relVolume, returnZ: r.returnZ,
        exchange: r.exchange, instrumentType: r.instrumentType,
        dataSource: "Yahoo Finance (keyless)",
        observedAt: r.observedAt, reason: r.reason, createdAt: new Date(),
      })));
    }
    const allRuns = await db.select({ id: schema.discoveryLaneRuns.id }).from(schema.discoveryLaneRuns).orderBy(desc(schema.discoveryLaneRuns.id));
    for (const staleRun of allRuns.slice(10)) await db.delete(schema.discoveryLaneRuns).where(eq(schema.discoveryLaneRuns.id, staleRun.id));

    const status = sparkFailed > universe.length * 0.5 ? "failed" : sparkFailed > 0 ? "partial" : "ok";
    const completedAt = new Date();
    const note = `${universe.length} names screened (${broad.length} broad + ${smallcap.length} small-cap) in ${yahooRequests} Yahoo requests (${v8Verifications} volume verifications), 0 Alpha Vantage calls. T2: ${t2.length} abnormal movers. T3: ${t3.length} on lightweight tracking. Unverified liquidity: ${unverified.length} (rolling verification). Excluded: ${excluded.length}.${sparkFailed ? ` ${sparkFailed} names missed Yahoo batches.` : ""}`;
    await db.update(schema.discoveryLaneRuns).set({
      status, universeBroadCount: broad.length, universeSmallcapCount: smallcap.length,
      screenedCount: universe.length, t2Count: t2.length, t3Count: t3.length,
      unverifiedCount: unverified.length, excludedCount: excluded.length,
      yahooRequests, v8Verifications, alphaVantageCalls: 0, note, completedAt,
    }).where(eq(schema.discoveryLaneRuns.id, run.id));
    const updated = (await db.select().from(schema.discoveryLaneRuns).where(eq(schema.discoveryLaneRuns.id, run.id)))[0]!;
    return { ok: status !== "failed", run: mapRun(updated), note };
  } catch (error) {
    await db.update(schema.discoveryLaneRuns).set({
      status: "failed", yahooRequests, v8Verifications, alphaVantageCalls: 0,
      note: `Discovery lane failed: ${error instanceof Error ? error.message : String(error)}`,
      completedAt: new Date(),
    }).where(eq(schema.discoveryLaneRuns.id, run.id));
    const updated = (await db.select().from(schema.discoveryLaneRuns).where(eq(schema.discoveryLaneRuns.id, run.id)))[0]!;
    return { ok: false, run: mapRun(updated), note: updated.note };
  }
}
