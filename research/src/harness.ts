import { createHash } from "node:crypto";
import { isXnysSession, xnysSessionBounds } from "../../server/src/measurement";

export type Market = "equity" | "crypto";
export type Direction = "long" | "short";
export type HypothesisId = "trend_continuation_v1" | "breakout_volume_v1";
export type SplitId = "development" | "validation_1" | "validation_2" | "outside";
export type Bar = { date: string; eventTime: string; availableAt: string; open: number; high: number; low: number; close: number; volume: number };
export type InstrumentSeries = {
  instrumentId: string; symbol: string; name: string; market: Market; instrumentClass: string; venue: string; quoteCurrency: string;
  exchangeCalendar: "XNYS" | "24/7-UTC"; source: string; sourceUrl: string; interval: "1d"; adjustmentBasis: string;
  returnBasis: string; retrievalTime: string; availabilityAssumption: string; bars: Bar[];
};
export type Dataset = { schemaVersion: number; frozenAt: string; series: InstrumentSeries[] };
export type Trial = { trialId: string; market: Market; horizon: 5 | 30; horizonUnit: "trading_sessions" | "elapsed_days"; hypothesis: HypothesisId; status: string };
export type SplitPlan = { developmentEnd: string; validation1: { start: string; end: string }; validation2: { start: string; end: string }; holdoutStart: string };
export type Registry = {
  schemaVersion: number; frozenAt: string; correctionRunAt?: string; cohort: string; parameterSearch: string;
  hypotheses: Record<HypothesisId, Record<string, unknown>>; products: Trial[]; attemptedVariants: unknown[];
  selectionRule: { minimumMaturedEmissions: number; minimumUniqueDecisionDates: number; minimumLongs: number; minimumShorts: number; requirePositiveMeanNet: boolean; requirePositiveLower90PctTimeBlockInterval: boolean; tiePreference: HypothesisId };
  costsRoundTripBps: Record<Market, { central: number; stressed: number }>;
  bootstrap: { seed: number; resamples: number; blockDates: number; minimumBlocksForInterval: number };
  legacyScoreboardIsolation: { phase: string; cohort: string; legacyMergeAllowed: boolean };
  splits?: Record<Market, SplitPlan>;
  execution?: { smaBars: number; returnBars: number; breakoutRangeBars: number; volumeMedianBars: number; volumeMultiple: number; endpointOnlyAllowsIntermediateLabelGaps: boolean };
  engineSha256?: string;
};
export type BaselineValues = {
  alwaysLong: number | null; alwaysShort: number | null; sma200Direction: Direction | null; sma200SignedReturn: number | null; cash: 0;
  alwaysLongCentralNet: number | null; alwaysShortCentralNet: number | null; sma200CentralNet: number | null;
  alwaysLongStressedNet: number | null; alwaysShortStressedNet: number | null; sma200StressedNet: number | null;
};
export type Observation = {
  cohort: "phase2a-ohlcv-v1"; trialId: string; market: Market; horizon: 5 | 30; horizonUnit: "trading_sessions" | "elapsed_days";
  hypothesis: HypothesisId; instrumentId: string; symbol: string; instrumentClass: string; venue: string; quoteCurrency: string;
  adjustmentBasis: string; returnBasis: string; chronologyVersion: "feature-date-partition-declared-availability-v2"; split: SplitId; foldBoundary: string | null; featureCutoff: string; decisionTime: string; splitAssignmentTime: string; selectionTime: string;
  decisionDate: string; direction: Direction | null; decisionState: "issued" | "abstain" | "feature_exclusion"; decisionReason: string; baselineEligibility: "eligible" | "ineligible"; baselineReason: string;
  entryTime: string | null; entryPrice: number | null; horizonEnd: string | null; exitPrice: number | null; labelAvailableAt: string | null;
  labelState: "matured" | "pending" | "unverified"; purgeState: "accepted" | "purged_label_overlap" | "not_validation";
  grossSignedReturn: number | null; centralNetSignedReturn: number | null; stressedNetSignedReturn: number | null;
  directionalOutcome: "hit" | "miss" | "flat" | null; baseline: BaselineValues;
};

const DEFAULT_SPLITS: Record<Market, SplitPlan> = {
  crypto: { developmentEnd: "2026-06-30", validation1: { start: "2026-07-01", end: "2026-07-31" }, validation2: { start: "2026-08-01", end: "2026-08-31" }, holdoutStart: "2026-09-01" },
  equity: { developmentEnd: "2026-08-14", validation1: { start: "2026-08-17", end: "2026-09-04" }, validation2: { start: "2026-09-08", end: "2026-09-18" }, holdoutStart: "2026-09-21" },
};
type ExecutionConfig = { smaBars: number; returnBars: number; breakoutRangeBars: number; volumeMedianBars: number; volumeMultiple: number; endpointOnlyAllowsIntermediateLabelGaps: boolean };
const DEFAULT_EXECUTION: ExecutionConfig = { smaBars: 200, returnBars: 20, breakoutRangeBars: 20, volumeMedianBars: 20, volumeMultiple: 1.5, endpointOnlyAllowsIntermediateLabelGaps: true };
const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateAt(date: string): Date { return new Date(`${date}T00:00:00.000Z`); }
function addUtcDays(date: string, count: number): string { return new Date(dateAt(date).getTime() + count * DAY_MS).toISOString().slice(0, 10); }
function round(value: number | null, places = 8): number | null { if (value == null || !Number.isFinite(value)) return null; const factor = 10 ** places; return Math.round(value * factor) / factor; }
function average(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function median(values: number[]): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const at = sorted[Math.floor(sorted.length / 2)]; const left = sorted[Math.floor(sorted.length / 2) - 1]; return at == null ? null : sorted.length % 2 ? at : left == null ? at : (left + at) / 2; }
function percentile(values: number[], p: number): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))] ?? null; }
function stddev(values: number[]): number | null { const mean = average(values); if (mean == null || values.length < 2) return null; return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)); }
function seeded(seed: number): () => number { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; }; }

export function assertResearchCommandAllowed(command: string): void {
  if (command === "holdout" || command === "open-holdout" || command === "--open-holdout") throw new Error("Holdout evaluation is blocked in Phase 2A. A reviewed Phase 2B command is required.");
  if (command !== "validate" && command !== "repair-validate" && command !== "closure-validate") throw new Error(`Unknown Phase 2A command: ${command}`);
}
export function canonicalSha256(value: unknown): string {
  const stable = (input: unknown): unknown => Array.isArray(input) ? input.map(stable) : input && typeof input === "object" ? Object.fromEntries(Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : input;
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}
export function isCoherentBar(bar: Bar): boolean {
  return DATE_RE.test(bar.date) && Number.isFinite(dateAt(bar.date).getTime()) && [bar.open, bar.high, bar.low, bar.close, bar.volume].every((value) => Number.isFinite(value) && value >= 0) && bar.open > 0 && bar.close > 0 && bar.high >= Math.max(bar.open, bar.close) && bar.low > 0 && bar.low <= Math.min(bar.open, bar.close) && Number.isFinite(Date.parse(bar.eventTime)) && Number.isFinite(Date.parse(bar.availableAt)) && Date.parse(bar.availableAt) >= Date.parse(bar.eventTime);
}
function declaredFixedLagMinutes(assumption: string): number | null { const match = assumption.match(/plus\s+(\d+)\s+minutes?/i); return match ? Number(match[1]) : null; }
export function validateBarSequence(bars: Bar[], adjustmentBasis: string, series?: Pick<InstrumentSeries, "market" | "exchangeCalendar"> & Partial<Pick<InstrumentSeries, "availabilityAssumption">>): { valid: boolean; reasons: string[] } {
  const reasons: string[] = []; const seen = new Set<string>();
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index]; if (!bar) continue;
    if (seen.has(bar.date)) reasons.push(`duplicate:${bar.date}`); seen.add(bar.date);
    if (!isCoherentBar(bar)) reasons.push(`invalid_ohlcv_or_time:${bar.date}`);
    const fixedLagMinutes = typeof series?.availabilityAssumption === "string" ? declaredFixedLagMinutes(series.availabilityAssumption) : null; if (fixedLagMinutes != null && Date.parse(bar.availableAt) - Date.parse(bar.eventTime) !== fixedLagMinutes * 60_000) reasons.push(`availability_lag_mismatch:${bar.date}:expected_${fixedLagMinutes}m`);
    const prior = bars[index - 1]; if (prior && (bar.date <= prior.date || Date.parse(bar.eventTime) <= Date.parse(prior.eventTime))) reasons.push(`non_chronological:${bar.date}`);
    if (series?.market === "equity") {
      const bounds = xnysSessionBounds(bar.date);
      if (!bounds || series.exchangeCalendar !== "XNYS") reasons.push(`invalid_xnys_session:${bar.date}`);
      else if (bar.eventTime !== bounds.end) reasons.push(`event_time_not_xnys_close:${bar.date}`);
    }
    if (series?.market === "crypto") {
      const expectedEnd = `${addUtcDays(bar.date, 1)}T00:00:00.000Z`;
      if (series.exchangeCalendar !== "24/7-UTC" || bar.eventTime !== expectedEnd) reasons.push(`event_time_not_utc_interval_end:${bar.date}`);
    }
    if (prior && adjustmentBasis.includes("unadjusted")) { const ratio = bar.open / prior.close; if (ratio <= .35 || ratio >= 2.85) reasons.push(`corporate_action_or_anomaly_unresolved:${bar.date}`); }
  }
  return { valid: reasons.length === 0, reasons };
}

function registrySplits(registry: Registry): Record<Market, SplitPlan> { return registry.splits ?? DEFAULT_SPLITS; }
function registryExecution(registry: Registry) { return registry.execution ?? DEFAULT_EXECUTION; }
function marketDatesBetween(market: Market, start: string, end: string): string[] {
  const out: string[] = []; let cursor = start; let attempts = 0;
  while (cursor <= end && attempts < 20_000) { if (market === "crypto" || isXnysSession(cursor)) out.push(cursor); cursor = addUtcDays(cursor, 1); attempts += 1; }
  return out;
}
function previousMarketDates(market: Market, endInclusive: string, count: number): string[] {
  const out: string[] = []; let cursor = endInclusive; let attempts = 0;
  while (out.length < count && attempts < 5_000) { if (market === "crypto" || isXnysSession(cursor)) out.push(cursor); cursor = addUtcDays(cursor, -1); attempts += 1; }
  return out.reverse();
}
function nextEntryDate(series: InstrumentSeries, decisionTime: string): string | null {
  let cursor = series.market === "crypto" ? addUtcDays(series.bars.find((bar) => bar.availableAt === decisionTime)?.date ?? decisionTime.slice(0, 10), 1) : decisionTime.slice(0, 10);
  for (let attempts = 0; attempts < 40; attempts += 1) {
    if (series.market === "crypto") { const open = `${cursor}T00:00:00.000Z`; if (Date.parse(open) > Date.parse(decisionTime)) return cursor; }
    else { const bounds = xnysSessionBounds(cursor); if (bounds && Date.parse(bounds.start) > Date.parse(decisionTime)) return cursor; }
    cursor = addUtcDays(cursor, 1);
  }
  return null;
}
function horizonSchedule(market: Market, entryDate: string, horizon: 5 | 30): { dates: string[]; endpointDate: string; endTime: string; availableAt: string } | null {
  const dates = market === "crypto" ? Array.from({ length: horizon }, (_, index) => addUtcDays(entryDate, index)) : marketDatesBetween("equity", entryDate, addUtcDays(entryDate, 60)).slice(0, horizon);
  const endpointDate = dates.at(-1); if (!endpointDate || dates.length !== horizon) return null;
  if (market === "crypto") { const endTime = `${addUtcDays(endpointDate, 1)}T00:00:00.000Z`; return { dates, endpointDate, endTime, availableAt: new Date(Date.parse(endTime) + 5 * 60_000).toISOString() }; }
  const bounds = xnysSessionBounds(endpointDate); if (!bounds) return null;
  return { dates, endpointDate, endTime: bounds.end, availableAt: new Date(Date.parse(bounds.end) + 30 * 60_000).toISOString() };
}
function openingTime(series: InstrumentSeries, date: string): string | null { return series.market === "crypto" ? `${date}T00:00:00.000Z` : xnysSessionBounds(date)?.start ?? null; }
function splitFor(market: Market, date: string, registry: Registry): { split: SplitId; boundary: string | null } {
  const plan = registrySplits(registry)[market];
  if (date <= plan.developmentEnd) return { split: "development", boundary: plan.validation1.start };
  if (date >= plan.validation1.start && date <= plan.validation1.end) return { split: "validation_1", boundary: plan.validation2.start };
  if (date >= plan.validation2.start && date <= plan.validation2.end) return { split: "validation_2", boundary: plan.holdoutStart };
  return { split: "outside", boundary: null };
}

export function hypothesisDecision(history: Bar[], hypothesis: HypothesisId, execution = DEFAULT_EXECUTION): { state: "issued" | "abstain" | "feature_exclusion"; direction: Direction | null; reason: string } {
  const required = Math.max(execution.smaBars + 1, execution.returnBars + 1, execution.breakoutRangeBars + 1);
  if (history.length < required) return { state: "feature_exclusion", direction: null, reason: "warmup_sma200_and_return20" };
  const latest = history.at(-1); const priorReturn = history.at(-(execution.returnBars + 1)); const smaWindow = history.slice(-execution.smaBars);
  if (!latest || !priorReturn || smaWindow.length !== execution.smaBars || smaWindow.some((bar) => !isCoherentBar(bar))) return { state: "feature_exclusion", direction: null, reason: "missing_or_invalid_feature_bar" };
  const sma200 = average(smaWindow.map((bar) => bar.close)); if (sma200 == null || !(priorReturn.close > 0)) return { state: "feature_exclusion", direction: null, reason: "missing_sma_or_return_reference" };
  if (hypothesis === "trend_continuation_v1") {
    const return20 = latest.close / priorReturn.close - 1;
    if (latest.close > sma200 && return20 > 0) return { state: "issued", direction: "long", reason: "above_sma200_positive_return20" };
    if (latest.close < sma200 && return20 < 0) return { state: "issued", direction: "short", reason: "below_sma200_negative_return20" };
    return { state: "abstain", direction: null, reason: "trend_conditions_not_aligned_or_equal" };
  }
  const priorRange = history.slice(-(execution.breakoutRangeBars + 1), -1); if (priorRange.length !== execution.breakoutRangeBars) return { state: "feature_exclusion", direction: null, reason: "missing_breakout_reference" };
  const volumes = priorRange.slice(-execution.volumeMedianBars).map((bar) => bar.volume); const referenceVolume = median(volumes);
  if (referenceVolume == null || !(referenceVolume > 0) || volumes.length !== execution.volumeMedianBars || volumes.some((value) => !(value > 0)) || !(latest.volume > 0)) return { state: "feature_exclusion", direction: null, reason: "missing_invalid_or_zero_volume" };
  const maxHigh = Math.max(...priorRange.map((bar) => bar.high)); const minLow = Math.min(...priorRange.map((bar) => bar.low)); const volumePass = latest.volume >= execution.volumeMultiple * referenceVolume;
  if (latest.close > maxHigh && latest.close > sma200 && volumePass) return { state: "issued", direction: "long", reason: "upside_breakout_with_volume" };
  if (latest.close < minLow && latest.close < sma200 && volumePass) return { state: "issued", direction: "short", reason: "downside_breakout_with_volume" };
  return { state: "abstain", direction: null, reason: "breakout_or_volume_conditions_not_met" };
}
export function linearDirectionalReturn(direction: Direction, entry: number, exit: number): number | null { if (!(entry > 0) || !Number.isFinite(exit)) return null; return direction === "long" ? (exit - entry) / entry : (entry - exit) / entry; }

export function assertNoHoldoutInput(dataset: Dataset, registry: Registry): void {
  const splits = registrySplits(registry);
  for (const series of dataset.series) { const offending = series.bars.find((bar) => bar.date >= splits[series.market].holdoutStart); if (offending) throw new Error(`HOLDOUT_INPUT_REJECTED:${series.instrumentId}:${offending.date}`); }
}
export function buildObservations(dataset: Dataset, registry: Registry): Observation[] {
  if (registry.cohort !== "phase2a-ohlcv-v1" || registry.legacyScoreboardIsolation.legacyMergeAllowed) throw new Error("Phase/cohort isolation contract is invalid.");
  assertNoHoldoutInput(dataset, registry);
  const observations: Observation[] = []; const execution = registryExecution(registry);
  for (const trial of registry.products) {
    const costs = registry.costsRoundTripBps[trial.market];
    for (const series of dataset.series.filter((item) => item.market === trial.market)) {
      const sequence = validateBarSequence(series.bars, series.adjustmentBasis, series); if (!sequence.valid) throw new Error(`${series.instrumentId} dataset validation failed: ${sequence.reasons.join(",")}`);
      const byDate = new Map(series.bars.map((bar) => [bar.date, bar])); const lastDataDate = series.bars.at(-1)?.date ?? "";
      for (const featureBar of series.bars) {
        const requiredDates = previousMarketDates(series.market, featureBar.date, Math.max(execution.smaBars + 1, execution.returnBars + 1, execution.breakoutRangeBars + 1));
        const missingFeatureDate = requiredDates.find((date) => !byDate.has(date));
        const unavailableFeatureDate = requiredDates.find((date) => { const bar = byDate.get(date); return bar != null && Date.parse(bar.availableAt) > Date.parse(featureBar.availableAt); });
        const exactHistory = requiredDates.map((date) => byDate.get(date)).filter((bar): bar is Bar => bar != null);
        const split = splitFor(series.market, featureBar.date, registry);
        const delayedBeyondSplit = split.boundary != null && Date.parse(featureBar.availableAt) >= Date.parse(`${split.boundary}T00:00:00.000Z`);
        const decision = missingFeatureDate ? { state: "feature_exclusion" as const, direction: null, reason: `missing_expected_feature_bar:${missingFeatureDate}` } : unavailableFeatureDate ? { state: "feature_exclusion" as const, direction: null, reason: `required_feature_unavailable_at_decision:${unavailableFeatureDate}` } : delayedBeyondSplit ? { state: "feature_exclusion" as const, direction: null, reason: `decision_available_after_split_boundary:${split.boundary}` } : hypothesisDecision(exactHistory, trial.hypothesis, execution);
        const entryDate = decision.state === "feature_exclusion" ? null : nextEntryDate(series, featureBar.availableAt); const schedule = entryDate ? horizonSchedule(series.market, entryDate, trial.horizon) : null;
        const entryBar = entryDate ? byDate.get(entryDate) ?? null : null; const exitBar = schedule ? byDate.get(schedule.endpointDate) ?? null : null;
        let labelState: Observation["labelState"] = "pending";
        if (entryDate && entryDate <= lastDataDate && !entryBar) labelState = "unverified";
        else if (schedule && schedule.endpointDate <= lastDataDate && !exitBar) labelState = "unverified";
        else if (entryBar && exitBar) labelState = isCoherentBar(entryBar) && isCoherentBar(exitBar) && Date.parse(exitBar.availableAt) <= Date.parse(dataset.frozenAt) ? "matured" : "pending";
        const marketMove = entryBar && exitBar && labelState === "matured" ? (exitBar.close - entryBar.open) / entryBar.open : null;
        const gross = decision.direction && entryBar && exitBar && labelState === "matured" ? linearDirectionalReturn(decision.direction, entryBar.open, exitBar.close) : null;
        const baselineDates = previousMarketDates(series.market, featureBar.date, execution.smaBars); const missingBaselineDate = baselineDates.find((date) => !byDate.has(date)); const unavailableBaselineDate = baselineDates.find((date) => { const bar = byDate.get(date); return bar != null && Date.parse(bar.availableAt) > Date.parse(featureBar.availableAt); }); const baselineEligibility: Observation["baselineEligibility"] = missingBaselineDate || unavailableBaselineDate ? "ineligible" : "eligible"; const baselineReason = missingBaselineDate ? `missing_scheduled_sma_input:${missingBaselineDate}` : unavailableBaselineDate ? `scheduled_sma_input_unavailable_at_cutoff:${unavailableBaselineDate}` : "all_scheduled_sma_inputs_available"; const smaWindow = baselineDates.map((date) => byDate.get(date)).filter((bar): bar is Bar => bar != null); const sma = baselineEligibility === "eligible" && smaWindow.length === execution.smaBars ? average(smaWindow.map((bar) => bar.close)) : null;
        const smaDirection: Direction | null = sma == null ? null : featureBar.close > sma ? "long" : featureBar.close < sma ? "short" : null;
        const smaReturn = smaDirection && entryBar && exitBar && labelState === "matured" ? linearDirectionalReturn(smaDirection, entryBar.open, exitBar.close) : null;
        const boundaryMs = split.boundary ? Date.parse(`${split.boundary}T00:00:00.000Z`) : null; const declaredLabelAt = exitBar?.availableAt ?? null;
        const purgeState: Observation["purgeState"] = !split.split.startsWith("validation") ? "not_validation" : declaredLabelAt == null || boundaryMs == null || Date.parse(declaredLabelAt) >= boundaryMs ? "purged_label_overlap" : "accepted";
        const outcome = gross == null ? null : gross > 0 ? "hit" : gross < 0 ? "miss" : "flat";
        const net = (value: number | null, bps: number) => value == null ? null : round(value - bps / 10_000);
        observations.push({ cohort: "phase2a-ohlcv-v1", trialId: trial.trialId, market: trial.market, horizon: trial.horizon, horizonUnit: trial.horizonUnit, hypothesis: trial.hypothesis, instrumentId: series.instrumentId, symbol: series.symbol, instrumentClass: series.instrumentClass, venue: series.venue, quoteCurrency: series.quoteCurrency, adjustmentBasis: series.adjustmentBasis, returnBasis: series.returnBasis, chronologyVersion: "feature-date-partition-declared-availability-v2", split: split.split, foldBoundary: split.boundary, featureCutoff: featureBar.eventTime, decisionTime: featureBar.availableAt, splitAssignmentTime: featureBar.eventTime, selectionTime: registry.correctionRunAt ?? registry.frozenAt, decisionDate: featureBar.date, direction: decision.direction, decisionState: decision.state, decisionReason: decision.reason, baselineEligibility, baselineReason, entryTime: entryDate ? openingTime(series, entryDate) : null, entryPrice: entryBar?.open ?? null, horizonEnd: schedule?.endTime ?? null, exitPrice: exitBar?.close ?? null, labelAvailableAt: declaredLabelAt, labelState, purgeState, grossSignedReturn: round(gross), centralNetSignedReturn: net(gross, costs.central), stressedNetSignedReturn: net(gross, costs.stressed), directionalOutcome: outcome, baseline: { alwaysLong: round(marketMove), alwaysShort: marketMove == null ? null : round(-marketMove), sma200Direction: smaDirection, sma200SignedReturn: round(smaReturn), cash: 0, alwaysLongCentralNet: net(marketMove, costs.central), alwaysShortCentralNet: net(marketMove == null ? null : -marketMove, costs.central), sma200CentralNet: net(smaReturn, costs.central), alwaysLongStressedNet: net(marketMove, costs.stressed), alwaysShortStressedNet: net(marketMove == null ? null : -marketMove, costs.stressed), sma200StressedNet: net(smaReturn, costs.stressed) } });
      }
    }
  }
  return observations;
}

export type IntervalReport = { lower90: number | null; upper90: number | null; blockLength: number; availableFullBlocks: number; sampledBlocks: number; tailDatesExcluded: number; gridDates: number; limitation: string | null };
function completeValidationGrid(market: Market, registry: Registry): string[] { const plan = registrySplits(registry)[market]; return [...marketDatesBetween(market, plan.validation1.start, plan.validation1.end), ...marketDatesBetween(market, plan.validation2.start, plan.validation2.end)]; }
function intervalGrid(rows: Observation[], registry: Registry): string[] { const market = rows[0]?.market ?? "equity"; const folds = new Set(rows.map((row) => row.split)); const plan = registrySplits(registry)[market]; if (folds.size === 1 && folds.has("validation_1")) return marketDatesBetween(market, plan.validation1.start, plan.validation1.end); if (folds.size === 1 && folds.has("validation_2")) return marketDatesBetween(market, plan.validation2.start, plan.validation2.end); return completeValidationGrid(market, registry); }
function blockPopulationDates(rows: Observation[], registry: Registry): Set<string> { const grid = intervalGrid(rows, registry); const length = registry.bootstrap.blockDates; return new Set(grid.slice(0, Math.floor(grid.length / length) * length)); }
function blockInterval(rows: Observation[], registry: Registry, value: (row: Observation) => number | null): IntervalReport {
  const grid = intervalGrid(rows, registry); const eligibleRows = rows.filter((row) => row.purgeState === "accepted" && row.decisionState === "issued" && row.labelState === "matured"); const dateValues = eligibleRows.flatMap((row) => { const item = value(row); return item == null ? [] : [{ date: row.decisionDate, value: item }]; });
  return evaluateDatePanel({ dateValues, scheduledDates: grid, blockLength: registry.bootstrap.blockDates, seed: registry.bootstrap.seed, resamples: registry.bootstrap.resamples, minimumBlocks: registry.bootstrap.minimumBlocksForInterval });
}
export function timeBlockInterval(rows: Observation[], registry: Registry): IntervalReport { return blockInterval(rows, registry, (row) => row.centralNetSignedReturn); }

export type CandidateReport = {
  trialId: string; market: Market; horizon: 5 | 30; hypothesis: HypothesisId; fold: "validation_1" | "validation_2" | "pooled_validation";
  counts: { eligible: number; issued: number; abstentions: number; featureExclusions: number; matured: number; pending: number; unverified: number; purged: number; acceptedMaturedIssued: number; pointEstimateRows: number; excludedTailRows: number; longs: number; shorts: number; flats: number; hits: number; misses: number };
  metrics: { hitRateExcludingFlats: number | null; sma200HitRateExcludingFlats: number | null; hitRateMinusSma200: number | null; meanGross: number | null; medianGross: number | null; meanCentralNet: number | null; meanStressedNet: number | null; stddevGross: number | null; downsideP05Gross: number | null; meanAlwaysLongMatched: number | null; meanAlwaysShortMatched: number | null; meanSma200Matched: number | null; meanAlwaysLongMatchedCentralNet: number | null; meanAlwaysShortMatchedCentralNet: number | null; meanSma200MatchedCentralNet: number | null; meanCash: 0; grossMinusAlwaysLong: number | null; grossMinusAlwaysShort: number | null; grossMinusSma200: number | null; centralNetMinusAlwaysLong: number | null; centralNetMinusAlwaysShort: number | null; centralNetMinusSma200: number | null; uniqueAssets: number; uniqueDecisionDates: number; overlappingExposureCount: number };
  uncertainty: { absoluteCentralNet: IntervalReport; pairedCentralNetMinusAlwaysLong: IntervalReport; pairedCentralNetMinusAlwaysShort: IntervalReport; pairedCentralNetMinusSma200: IntervalReport };
};
function summarizeTrial(rows: Observation[], registry: Registry, fold: CandidateReport["fold"]): CandidateReport {
  const base = rows[0]; if (!base) throw new Error("Cannot summarize an empty trial."); const scoped = fold === "pooled_validation" ? rows.filter((row) => row.split === "validation_1" || row.split === "validation_2") : rows.filter((row) => row.split === fold);
  const acceptedAll = scoped.filter((row) => row.purgeState === "accepted" && row.decisionState === "issued" && row.labelState === "matured"); const pointDates = blockPopulationDates(scoped, registry); const accepted = acceptedAll.filter((row) => pointDates.has(row.decisionDate)); const values = (getter: (row: Observation) => number | null) => accepted.map(getter).filter((value): value is number => value != null);
  const gross = values((row) => row.grossSignedReturn), central = values((row) => row.centralNetSignedReturn), stressed = values((row) => row.stressedNetSignedReturn); const smaGross = values((row) => row.baseline.sma200SignedReturn), longGross = values((row) => row.baseline.alwaysLong), shortGross = values((row) => row.baseline.alwaysShort); const smaNet = values((row) => row.baseline.sma200CentralNet), longNet = values((row) => row.baseline.alwaysLongCentralNet), shortNet = values((row) => row.baseline.alwaysShortCentralNet);
  const hits = accepted.filter((row) => row.directionalOutcome === "hit").length, misses = accepted.filter((row) => row.directionalOutcome === "miss").length, flats = accepted.filter((row) => row.directionalOutcome === "flat").length; const hitRate = hits + misses ? hits / (hits + misses) : null; const smaHits = smaGross.filter((value) => value > 0).length, smaMisses = smaGross.filter((value) => value < 0).length, smaHitRate = smaHits + smaMisses ? smaHits / (smaHits + smaMisses) : null;
  const meanGross = average(gross), meanCentral = average(central), meanLongGross = average(longGross), meanShortGross = average(shortGross), meanSmaGross = average(smaGross), meanLongNet = average(longNet), meanShortNet = average(shortNet), meanSmaNet = average(smaNet);
  const overlap = accepted.filter((row, index, all) => all.some((other, otherIndex) => otherIndex < index && other.instrumentId === row.instrumentId && other.entryTime != null && row.entryTime != null && other.horizonEnd != null && Date.parse(other.entryTime) <= Date.parse(row.entryTime) && Date.parse(other.horizonEnd) >= Date.parse(row.entryTime))).length;
  const diff = (left: number | null, right: number | null) => left == null || right == null ? null : round(left - right);
  return { trialId: base.trialId, market: base.market, horizon: base.horizon, hypothesis: base.hypothesis, fold, counts: { eligible: scoped.length, issued: scoped.filter((row) => row.decisionState === "issued").length, abstentions: scoped.filter((row) => row.decisionState === "abstain").length, featureExclusions: scoped.filter((row) => row.decisionState === "feature_exclusion").length, matured: scoped.filter((row) => row.labelState === "matured").length, pending: scoped.filter((row) => row.labelState === "pending").length, unverified: scoped.filter((row) => row.labelState === "unverified").length, purged: scoped.filter((row) => row.purgeState === "purged_label_overlap").length, acceptedMaturedIssued: acceptedAll.length, pointEstimateRows: accepted.length, excludedTailRows: acceptedAll.length - accepted.length, longs: acceptedAll.filter((row) => row.direction === "long").length, shorts: acceptedAll.filter((row) => row.direction === "short").length, flats, hits, misses }, metrics: { hitRateExcludingFlats: round(hitRate), sma200HitRateExcludingFlats: round(smaHitRate), hitRateMinusSma200: diff(hitRate, smaHitRate), meanGross: round(meanGross), medianGross: round(median(gross)), meanCentralNet: round(meanCentral), meanStressedNet: round(average(stressed)), stddevGross: round(stddev(gross)), downsideP05Gross: round(percentile(gross, .05)), meanAlwaysLongMatched: round(meanLongGross), meanAlwaysShortMatched: round(meanShortGross), meanSma200Matched: round(meanSmaGross), meanAlwaysLongMatchedCentralNet: round(meanLongNet), meanAlwaysShortMatchedCentralNet: round(meanShortNet), meanSma200MatchedCentralNet: round(meanSmaNet), meanCash: 0, grossMinusAlwaysLong: diff(meanGross, meanLongGross), grossMinusAlwaysShort: diff(meanGross, meanShortGross), grossMinusSma200: diff(meanGross, meanSmaGross), centralNetMinusAlwaysLong: diff(meanCentral, meanLongNet), centralNetMinusAlwaysShort: diff(meanCentral, meanShortNet), centralNetMinusSma200: diff(meanCentral, meanSmaNet), uniqueAssets: new Set(accepted.map((row) => row.instrumentId)).size, uniqueDecisionDates: new Set(accepted.map((row) => row.decisionDate)).size, overlappingExposureCount: overlap }, uncertainty: { absoluteCentralNet: timeBlockInterval(scoped, registry), pairedCentralNetMinusAlwaysLong: blockInterval(scoped, registry, (row) => row.centralNetSignedReturn == null || row.baseline.alwaysLongCentralNet == null ? null : row.centralNetSignedReturn - row.baseline.alwaysLongCentralNet), pairedCentralNetMinusAlwaysShort: blockInterval(scoped, registry, (row) => row.centralNetSignedReturn == null || row.baseline.alwaysShortCentralNet == null ? null : row.centralNetSignedReturn - row.baseline.alwaysShortCentralNet), pairedCentralNetMinusSma200: blockInterval(scoped, registry, (row) => row.centralNetSignedReturn == null || row.baseline.sma200CentralNet == null ? null : row.centralNetSignedReturn - row.baseline.sma200CentralNet) } };
}

export type FullScheduleBaselineReport = { market: Market; horizon: 5 | 30; acceptedMaturedRows: number; uniqueAssets: number; uniqueDecisionDates: number; meanGross: { alwaysLong: number | null; alwaysShort: number | null; sma200Direction: number | null; cash: 0 }; meanCentralNet: { alwaysLong: number | null; alwaysShort: number | null; sma200Direction: number | null; cash: 0 }; meanStressedNet: { alwaysLong: number | null; alwaysShort: number | null; sma200Direction: number | null; cash: 0 }; hitRateExcludingFlats: { alwaysLong: number | null; alwaysShort: number | null; sma200Direction: number | null } };
function fullScheduleBaselineReports(observations: Observation[], registry: Registry): FullScheduleBaselineReport[] {
  const reports: FullScheduleBaselineReport[] = [];
  for (const market of ["equity", "crypto"] as const) for (const horizon of [5, 30] as const) { const reference = registry.products.find((trial) => trial.market === market && trial.horizon === horizon && trial.hypothesis === "trend_continuation_v1"); const rows = observations.filter((row) => row.trialId === reference?.trialId && row.purgeState === "accepted" && row.labelState === "matured" && row.baselineEligibility === "eligible" && row.baseline.alwaysLong != null && row.baseline.alwaysShort != null && row.baseline.sma200SignedReturn != null); const list = (getter: (row: Observation) => number | null) => rows.map(getter).filter((value): value is number => value != null); const long = list((row) => row.baseline.alwaysLong), short = list((row) => row.baseline.alwaysShort), sma = list((row) => row.baseline.sma200SignedReturn); const hitRate = (items: number[]) => { const hits = items.filter((value) => value > 0).length, misses = items.filter((value) => value < 0).length; return hits + misses ? round(hits / (hits + misses)) : null; }; reports.push({ market, horizon, acceptedMaturedRows: rows.length, uniqueAssets: new Set(rows.map((row) => row.instrumentId)).size, uniqueDecisionDates: new Set(rows.map((row) => row.decisionDate)).size, meanGross: { alwaysLong: round(average(long)), alwaysShort: round(average(short)), sma200Direction: round(average(sma)), cash: 0 }, meanCentralNet: { alwaysLong: round(average(list((row) => row.baseline.alwaysLongCentralNet))), alwaysShort: round(average(list((row) => row.baseline.alwaysShortCentralNet))), sma200Direction: round(average(list((row) => row.baseline.sma200CentralNet))), cash: 0 }, meanStressedNet: { alwaysLong: round(average(list((row) => row.baseline.alwaysLongStressedNet))), alwaysShort: round(average(list((row) => row.baseline.alwaysShortStressedNet))), sma200Direction: round(average(list((row) => row.baseline.sma200StressedNet))), cash: 0 }, hitRateExcludingFlats: { alwaysLong: hitRate(long), alwaysShort: hitRate(short), sma200Direction: hitRate(sma) } }); }
  return reports;
}

export type SyntheticControlReport = { cohort: "phase2a1-synthetic-controls-v1"; positive: { construction: string; futureInformationUsed: false; events: number; meanGross: number; meanCentralNet: number; lower90: number | null; qualified: boolean }; negative: { construction: string; futureInformationUsed: false; seeds: number[]; eventsPerSeed: number; qualifications: number; falseQualificationRate: number; results: Array<{ seed: number; meanCentralNet: number | null; lower90: number | null; qualified: boolean }> }; qualificationRule: string; separation: string };
export function evaluateDatePanel(input: { dateValues: Array<{ date: string; value: number }>; scheduledDates: string[]; blockLength: number; seed: number; resamples: number; minimumBlocks: number }): IntervalReport {
  const fullBlockCount = Math.floor(input.scheduledDates.length / input.blockLength); const tailDatesExcluded = input.scheduledDates.length - fullBlockCount * input.blockLength; const blocks = Array.from({ length: fullBlockCount }, (_, index) => input.scheduledDates.slice(index * input.blockLength, (index + 1) * input.blockLength));
  if (blocks.length < input.minimumBlocks) return { lower90: null, upper90: null, blockLength: input.blockLength, availableFullBlocks: blocks.length, sampledBlocks: 0, tailDatesExcluded, gridDates: input.scheduledDates.length, limitation: `Only ${blocks.length} complete ${input.blockLength}-date block(s) on the scheduled market grid; ${input.minimumBlocks} required. The ${tailDatesExcluded}-date tail is not counted as a full block.` };
  const byDate = new Map<string, number[]>(); for (const row of input.dateValues) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row.value]); const random = seeded(input.seed); const outcomes: number[] = [];
  for (let sample = 0; sample < input.resamples; sample += 1) { const values = Array.from({ length: blocks.length }, () => blocks[Math.floor(random() * blocks.length)] ?? []).flat().flatMap((date) => byDate.get(date) ?? []); const mean = average(values); if (mean != null) outcomes.push(mean); }
  return { lower90: round(percentile(outcomes, .05)), upper90: round(percentile(outcomes, .95)), blockLength: input.blockLength, availableFullBlocks: blocks.length, sampledBlocks: outcomes.length ? blocks.length : 0, tailDatesExcluded, gridDates: input.scheduledDates.length, limitation: outcomes.length ? null : "No issued matured values were available on sampled complete date-panel blocks." };
}
function syntheticPipelinePositive(): { events: number; meanGross: number; meanCentralNet: number; lower90: number | null; qualified: boolean } {
  const bars: Bar[] = Array.from({ length: 699 }, (_, index) => { const date = addUtcDays("2024-01-01", index); const open = 100 * 1.0015 ** index; const close = open * 1.0015; const eventTime = `${addUtcDays(date, 1)}T00:00:00.000Z`; return { date, eventTime, availableAt: new Date(Date.parse(eventTime) + 5 * 60_000).toISOString(), open, high: close * 1.001, low: open * .999, close, volume: 1_000_000 + index }; });
  const dataset: Dataset = { schemaVersion: 1, frozenAt: "2025-12-01T00:00:00.000Z", series: [{ instrumentId: "24/7:POS:USD", symbol: "POS-USD", name: "Synthetic positive", market: "crypto", instrumentClass: "synthetic_control", venue: "SYNTHETIC", quoteCurrency: "USD", exchangeCalendar: "24/7-UTC", source: "deterministic fixture", sourceUrl: "fixture://synthetic-positive", interval: "1d", adjustmentBasis: "unadjusted_raw_ohlcv", returnBasis: "price_return", retrievalTime: "2025-12-01T00:00:00.000Z", availabilityAssumption: "UTC interval end plus 5 minutes", bars }] };
  const registry: Registry = { schemaVersion: 2, frozenAt: dataset.frozenAt, cohort: "phase2a-ohlcv-v1", parameterSearch: "synthetic diagnostic only", hypotheses: { trend_continuation_v1: {}, breakout_volume_v1: {} }, products: [{ trialId: "synthetic-positive-5d", market: "crypto", horizon: 5, horizonUnit: "elapsed_days", hypothesis: "trend_continuation_v1", status: "diagnostic" }], attemptedVariants: [], selectionRule: { minimumMaturedEmissions: 40, minimumUniqueDecisionDates: 40, minimumLongs: 0, minimumShorts: 0, requirePositiveMeanNet: true, requirePositiveLower90PctTimeBlockInterval: true, tiePreference: "trend_continuation_v1" }, costsRoundTripBps: { equity: { central: 20, stressed: 35 }, crypto: { central: 10, stressed: 20 } }, bootstrap: { seed: 73002, resamples: 1_000, blockDates: 30, minimumBlocksForInterval: 4 }, legacyScoreboardIsolation: { phase: "synthetic", cohort: "isolated", legacyMergeAllowed: false }, splits: { equity: DEFAULT_SPLITS.equity, crypto: { developmentEnd: "2024-12-31", validation1: { start: "2025-01-01", end: "2025-05-31" }, validation2: { start: "2025-06-01", end: "2025-11-29" }, holdoutStart: "2025-12-01" } }, execution: DEFAULT_EXECUTION };
  const observations = buildObservations(dataset, registry); const scoped = observations.filter((row) => row.purgeState === "accepted" && row.decisionState === "issued" && row.labelState === "matured"); const dates = completeValidationGrid("crypto", registry); const panel = evaluateDatePanel({ dateValues: scoped.flatMap((row) => row.centralNetSignedReturn == null ? [] : [{ date: row.decisionDate, value: row.centralNetSignedReturn }]), scheduledDates: dates, blockLength: 30, seed: 73002, resamples: 1_000, minimumBlocks: 4 }); const meanGross = average(scoped.flatMap((row) => row.grossSignedReturn == null ? [] : [row.grossSignedReturn])) ?? 0; const meanCentralNet = average(scoped.flatMap((row) => row.centralNetSignedReturn == null ? [] : [row.centralNetSignedReturn])) ?? 0; return { events: scoped.length, meanGross, meanCentralNet, lower90: panel.lower90, qualified: scoped.length >= 40 && meanCentralNet > 0 && (panel.lower90 ?? -Infinity) > 0 };
}
export function runSyntheticControls(): SyntheticControlReport {
  const events = 420, cost = .001, start = "2024-01-01"; const positive = syntheticPipelinePositive(); const controlDates = Array.from({ length: events }, (_, index) => addUtcDays(start, index));
  const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 1111, 1212]; const negativeResults = seeds.map((seedValue) => { const signalRandom = seeded(seedValue), outcomeRandom = seeded(seedValue ^ 0x9e3779b9); const rows = Array.from({ length: events }, (_, index) => { const preDecisionSignal = signalRandom() >= .5 ? 1 : -1; const independentLaterOutcome = (outcomeRandom() - .5) * .04; return { date: addUtcDays(start, index), value: preDecisionSignal * independentLaterOutcome - cost }; }); const interval = evaluateDatePanel({ dateValues: rows, scheduledDates: controlDates, blockLength: 30, seed: seedValue + 50_000, resamples: 1_000, minimumBlocks: 4 }), mean = average(rows.map((row) => row.value)); return { seed: seedValue, meanCentralNet: round(mean), lower90: interval.lower90, qualified: mean != null && mean > 0 && interval.lower90 != null && interval.lower90 > 0 }; });
  const qualifications = negativeResults.filter((row) => row.qualified).length;
  return { cohort: "phase2a1-synthetic-controls-v1", positive: { construction: "A deterministic rising OHLCV series traverses the actual feature, next-entry, exact-endpoint label, purge, cost and shared date-panel evaluator path under an isolated synthetic registry.", futureInformationUsed: false, events: positive.events, meanGross: round(positive.meanGross) ?? positive.meanGross, meanCentralNet: round(positive.meanCentralNet) ?? positive.meanCentralNet, lower90: positive.lower90, qualified: positive.qualified }, negative: { construction: "Signal directions and later outcomes come from independent deterministic PRNG streams for every recorded seed.", futureInformationUsed: false, seeds, eventsPerSeed: events, qualifications, falseQualificationRate: qualifications / seeds.length, results: negativeResults }, qualificationRule: "At least 40 events, positive mean modeled-net return, and a positive lower 90% complete-date-block interval. Direction-balance is not imposed on the control because its purpose is instrument sensitivity, not strategy eligibility. Imposing matched-SMA outperformance would make the positive control impossible whenever SMA is assigned the identical synthetic decisions; that comparator is therefore a sanity equality check, not the control's qualification gate.", separation: "Synthetic controls are emitted only to research/output/phase2a1-synthetic-controls.json and are never appended to market observations, candidate reports, selections, or the legacy scoreboard." };
}

export function runValidation(dataset: Dataset, registry: Registry): { generatedAt: string; cohort: string; datasetHash: string; registryHash: string; observations: Observation[]; candidateReports: CandidateReport[]; baselineReports: FullScheduleBaselineReport[]; selections: Array<{ market: Market; horizon: 5 | 30; selected: HypothesisId | null; reason: string }>; holdout: { opened: false; ranges: Record<Market, { start: string; end: string }>; performance: null }; limitations: string[] } {
  const observations = buildObservations(dataset, registry); const candidateReports: CandidateReport[] = [];
  for (const trial of registry.products) { const rows = observations.filter((row) => row.trialId === trial.trialId); for (const fold of ["validation_1", "validation_2", "pooled_validation"] as const) candidateReports.push(summarizeTrial(rows, registry, fold)); }
  const selections: Array<{ market: Market; horizon: 5 | 30; selected: HypothesisId | null; reason: string }> = [];
  for (const market of ["equity", "crypto"] as const) for (const horizon of [5, 30] as const) { const candidates = candidateReports.filter((report) => report.market === market && report.horizon === horizon && report.fold === "pooled_validation"); const qualified = candidates.filter((report) => report.counts.acceptedMaturedIssued >= registry.selectionRule.minimumMaturedEmissions && report.metrics.uniqueDecisionDates >= registry.selectionRule.minimumUniqueDecisionDates && report.counts.longs >= registry.selectionRule.minimumLongs && report.counts.shorts >= registry.selectionRule.minimumShorts && (report.metrics.meanCentralNet ?? -Infinity) > 0 && (report.uncertainty.absoluteCentralNet.lower90 ?? -Infinity) > 0).sort((a, b) => (b.metrics.meanCentralNet ?? -Infinity) - (a.metrics.meanCentralNet ?? -Infinity) || (a.hypothesis === registry.selectionRule.tiePreference ? -1 : 1)); const first = qualified[0]; selections.push({ market, horizon, selected: first?.hypothesis ?? null, reason: first ? "Highest qualifying pooled out-of-fold mean central-net return under the unchanged frozen rule." : "No registered candidate met the unchanged frozen sample, coverage, direction-balance, economics, and uncertainty checks." }); }
  const splits = registrySplits(registry); return { generatedAt: registry.correctionRunAt ?? registry.frozenAt, cohort: registry.cohort, datasetHash: canonicalSha256(dataset), registryHash: canonicalSha256(registry), observations, candidateReports, baselineReports: fullScheduleBaselineReports(observations, registry), selections, holdout: { opened: false, ranges: { equity: { start: splits.equity.holdoutStart, end: "2026-10-07" }, crypto: { start: splits.crypto.holdoutStart, end: "2026-10-07" } }, performance: null }, limitations: ["Current-survivor exploratory sample only; no delisted/inactive membership history.", "Only about one year of daily history was available; 200-bar warm-up leaves short validation windows.", "Equity inputs are unadjusted price OHLCV without a corporate-action feed; results are price returns, not total returns.", "Short borrow, locate, financing and crypto funding were unavailable, so short economics are hypothetical.", "Endpoint-only direction labels allow missing intermediate outcome bars but require the exact scheduled entry and endpoint; feature lookbacks require every scheduled bar.", "The locked holdout was rejected at the engine boundary, not opened, and no Phase 2A candidate was promoted."] };
}
