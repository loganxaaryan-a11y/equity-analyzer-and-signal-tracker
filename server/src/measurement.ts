export type Direction = "long" | "short";
export type EvaluationVerdict = "HIT" | "MISS" | "AMBIGUOUS" | "UNVERIFIED" | "TIME_EXIT" | "OPEN" | "PENDING_ENTRY" | "UNKNOWN";
export type DailyEvidenceBar = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  availableAt?: string | null;
};
export type FrozenEvaluationSignal = {
  signalId: number;
  direction: Direction;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  entryAt: string;
  issuedAt: string;
  expiresAt: string | null;
  primaryHorizon: number;
  horizonUnit: "trading_sessions";
  exchangeCalendar: "XNYS";
  entryRule: string;
};
export type CostConvention = { kind: "unknown" } | { kind: "modeled"; roundTripBps: number; version: string };
export type EquityEvaluation = {
  verdict: EvaluationVerdict;
  reasonCode: string;
  reason: string;
  grossReturnPct: number | null;
  grossR: number | null;
  modeledNetReturnPct: number | null;
  modeledNetR: number | null;
  costStatus: "unknown" | "modeled" | "paper-costs-v1";
  costBps: number | null;
  exitPrice: number | null;
  exitObservedAt: string | null;
  evidenceStartAt: string | null;
  evidenceEndAt: string | null;
  expectedSessions: string[];
  observedSessions: string[];
};

const DAY_MS = 86_400_000;
const XNYS_EARLY_CLOSES = new Set(["2025-07-03", "2025-11-28", "2025-12-24", "2026-07-02", "2026-11-27", "2026-12-24", "2027-07-02", "2027-11-26", "2027-12-24"]);

function dateKey(date: Date): string { return date.toISOString().slice(0, 10); }
function nthWeekday(year: number, monthZero: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(year, monthZero, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return dateKey(new Date(Date.UTC(year, monthZero, 1 + offset + (nth - 1) * 7)));
}
function lastWeekday(year: number, monthZero: number, weekday: number): string {
  const last = new Date(Date.UTC(year, monthZero + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return dateKey(new Date(Date.UTC(year, monthZero, last.getUTCDate() - offset)));
}
function observed(date: Date): string {
  const day = date.getUTCDay();
  if (day === 6) return dateKey(new Date(date.getTime() - DAY_MS));
  if (day === 0) return dateKey(new Date(date.getTime() + DAY_MS));
  return dateKey(date);
}
function xnysHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  holidays.add(observed(new Date(Date.UTC(year, 0, 1))));
  holidays.add(nthWeekday(year, 0, 1, 3));
  holidays.add(nthWeekday(year, 1, 1, 3));
  holidays.add(lastWeekday(year, 4, 1));
  holidays.add(observed(new Date(Date.UTC(year, 5, 19))));
  holidays.add(observed(new Date(Date.UTC(year, 6, 4))));
  holidays.add(nthWeekday(year, 8, 1, 1));
  holidays.add(nthWeekday(year, 10, 4, 4));
  holidays.add(observed(new Date(Date.UTC(year, 11, 25))));
  // Good Friday is maintained explicitly for the supported measurement years.
  const goodFriday: Record<number, string> = { 2025: "2025-04-18", 2026: "2026-04-03", 2027: "2027-03-26" };
  const gf = goodFriday[year]; if (gf) holidays.add(gf);
  return holidays;
}
const XNYS_SUPPORTED_YEARS = new Set([2025, 2026, 2027]);
export function isXnysSession(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`); if (!Number.isFinite(parsed.getTime()) || !XNYS_SUPPORTED_YEARS.has(parsed.getUTCFullYear())) return false;
  const weekday = parsed.getUTCDay(); if (weekday === 0 || weekday === 6) return false;
  return !xnysHolidays(parsed.getUTCFullYear()).has(date);
}
function easternOffsetMinutesAt(date: string): number {
  const probe = new Date(`${date}T17:00:00Z`);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = zone.match(/GMT([+-]\d+)(?::(\d+))?/); if (!match) return -300;
  const hours = Number(match[1]); const minutes = Number(match[2] ?? 0); return hours * 60 + Math.sign(hours) * minutes;
}
function easternWallClockIso(date: string, hour: number, minute = 0): string {
  const offset = easternOffsetMinutesAt(date);
  return new Date(Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`) - offset * 60_000).toISOString();
}
export function xnysSessionBounds(date: string): { start: string; end: string; earlyClose: boolean } | null {
  if (!isXnysSession(date)) return null;
  const earlyClose = XNYS_EARLY_CLOSES.has(date);
  return { start: easternWallClockIso(date, 9, 30), end: easternWallClockIso(date, earlyClose ? 13 : 16), earlyClose };
}
export function expectedXnysSessions(afterInstant: string, count: number): string[] {
  const parsed = new Date(afterInstant); if (!Number.isFinite(parsed.getTime()) || count <= 0) return [];
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
  let cursor = new Date(`${localDate}T00:00:00Z`); const out: string[] = []; let attempts = 0;
  while (out.length < count && attempts < 500) { attempts += 1; cursor = new Date(cursor.getTime() + DAY_MS); const key = dateKey(cursor); if (isXnysSession(key)) out.push(key); }
  return out;
}
export function linearReturnPct(direction: Direction, entry: number, exit: number): number | null {
  if (!(entry > 0) || !Number.isFinite(exit)) return null;
  return (direction === "long" ? (exit - entry) / entry : (entry - exit) / entry) * 100;
}
function finiteOhlc(bar: DailyEvidenceBar): bar is DailyEvidenceBar & { open: number; high: number; low: number; close: number } {
  return [bar.open, bar.high, bar.low, bar.close].every((value) => typeof value === "number" && Number.isFinite(value) && value > 0) && (bar.high ?? 0) >= Math.max(bar.open ?? Infinity, bar.close ?? Infinity) && (bar.low ?? Infinity) <= Math.min(bar.open ?? -Infinity, bar.close ?? -Infinity);
}
function emptyResult(verdict: EvaluationVerdict, reasonCode: string, reason: string, expectedSessions: string[], observedSessions: string[] = []): EquityEvaluation {
  return { verdict, reasonCode, reason, grossReturnPct: null, grossR: null, modeledNetReturnPct: null, modeledNetR: null, costStatus: "unknown", costBps: null, exitPrice: null, exitObservedAt: null, evidenceStartAt: null, evidenceEndAt: null, expectedSessions, observedSessions };
}
function settle(signal: FrozenEvaluationSignal, verdict: "HIT" | "MISS" | "TIME_EXIT", reasonCode: string, reason: string, exitPrice: number, exitObservedAt: string, expectedSessions: string[], observedSessions: string[], costs: CostConvention): EquityEvaluation {
  const grossReturnPct = linearReturnPct(signal.direction, signal.entryPrice, exitPrice);
  const risk = Math.abs(signal.entryPrice - signal.stopPrice);
  const grossR = risk > 0 ? (signal.direction === "long" ? exitPrice - signal.entryPrice : signal.entryPrice - exitPrice) / risk : null;
  const costBps = costs.kind === "modeled" ? costs.roundTripBps : null;
  const costPct = costBps == null ? null : costBps / 100;
  const modeledNetReturnPct = grossReturnPct == null || costPct == null ? null : grossReturnPct - costPct;
  const modeledNetR = grossR == null || costPct == null || risk <= 0 ? null : grossR - (signal.entryPrice * costPct / 100) / risk;
  const first = observedSessions[0]; const last = observedSessions.at(-1);
  return { verdict, reasonCode, reason, grossReturnPct, grossR, modeledNetReturnPct, modeledNetR, costStatus: costs.kind === "modeled" && costs.version === "paper-costs-v1" ? "paper-costs-v1" : costs.kind, costBps, exitPrice, exitObservedAt, evidenceStartAt: first ? xnysSessionBounds(first)?.start ?? null : null, evidenceEndAt: last ? xnysSessionBounds(last)?.end ?? null : null, expectedSessions, observedSessions };
}
export function evaluateEquityTradeSetup(signal: FrozenEvaluationSignal, bars: DailyEvidenceBar[], evaluatedAt: string, costs: CostConvention = { kind: "unknown" }): EquityEvaluation {
  if (signal.exchangeCalendar !== "XNYS" || signal.horizonUnit !== "trading_sessions") return emptyResult("UNVERIFIED", "unsupported_calendar", "The setup calendar or horizon unit is unsupported.", []);
  if (/research reference|not claimed/i.test(signal.entryRule)) return emptyResult("UNVERIFIED", "research_only_entry", "The recorded price is a historical research reference, not a demonstrated executable paper entry.", []);
  const cutoffMs = Date.parse(evaluatedAt); const entryMs = Date.parse(signal.entryAt); const issuedMs = Date.parse(signal.issuedAt);
  if (![cutoffMs, entryMs, issuedMs].every(Number.isFinite) || cutoffMs < entryMs || entryMs < issuedMs) return emptyResult("UNVERIFIED", "invalid_time_contract", "The immutable issuance, entry, or evaluation timestamps are incoherent.", []);
  const entryLocalDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(entryMs));
  const entrySession = xnysSessionBounds(entryLocalDate);
  if (entrySession && entryMs > Date.parse(entrySession.start) && entryMs < Date.parse(entrySession.end)) return emptyResult("UNVERIFIED", "entry_session_path_unobserved", `Entry falls inside the ${entryLocalDate} session; daily OHLC cannot establish the post-entry path without finer evidence.`, []);
  const expected = expectedXnysSessions(signal.entryAt, signal.primaryHorizon); if (expected.length !== signal.primaryHorizon) return emptyResult("UNVERIFIED", "calendar_unavailable", "Expected exchange sessions could not be constructed inside the validated 2025–2027 XNYS calendar coverage.", expected);
  const byDate = new Map(bars.map((bar) => [bar.date, bar])); const observed: string[] = [];
  for (const date of expected) {
    const bounds = xnysSessionBounds(date); if (!bounds) return emptyResult("UNVERIFIED", "calendar_unavailable", `No supported session bounds exist for ${date}.`, expected, observed);
    const endMs = Date.parse(bounds.end); const expiryMs = signal.expiresAt ? Date.parse(signal.expiresAt) : Infinity;
    if (endMs > cutoffMs) return emptyResult("OPEN", "awaiting_closed_session", `Session ${date} was not available by the evaluation cutoff.`, expected, observed);
    if (endMs > expiryMs) return emptyResult("UNVERIFIED", "expiry_straddles_session", `Expiry falls inside the ${date} daily bar; daily OHLC cannot prove a pre-expiry touch.`, expected, observed);
    const bar = byDate.get(date); if (!bar) return emptyResult("UNVERIFIED", "missing_required_session", `Required XNYS session ${date} is missing before any later outcome can be certified.`, expected, observed);
    if (bar.availableAt && Date.parse(bar.availableAt) > cutoffMs) return emptyResult("OPEN", "evidence_not_yet_available", `Evidence for ${date} was unavailable at the evaluation cutoff.`, expected, observed);
    if (!finiteOhlc(bar)) return emptyResult("UNVERIFIED", "invalid_ohlc", `Required session ${date} has missing or incoherent OHLC.`, expected, observed);
    observed.push(date);
    const adverseGap = signal.direction === "long" ? bar.open <= signal.stopPrice : bar.open >= signal.stopPrice;
    if (adverseGap) return settle(signal, "MISS", "opening_stop_gap", "The observed session open crossed the stop; the stop-market model exits at the adverse open before intraday extremes.", bar.open, bounds.start, expected, observed, costs);
    const target = signal.direction === "long" ? bar.high >= signal.targetPrice : bar.low <= signal.targetPrice;
    const stop = signal.direction === "long" ? bar.low <= signal.stopPrice : bar.high >= signal.stopPrice;
    if (target && stop) {
      const result = emptyResult("AMBIGUOUS", "intrabar_double_touch", `The ${date} daily bar touched target and stop; finer evidence is required.`, expected, observed);
      return { ...result, evidenceStartAt: xnysSessionBounds(observed[0] ?? date)?.start ?? null, evidenceEndAt: bounds.end };
    }
    if (target) return settle(signal, "HIT", "first_target_touch", "The first verified level touch reached the frozen target.", signal.targetPrice, bounds.end, expected, observed, costs);
    if (stop) return settle(signal, "MISS", "first_stop_touch", "The first verified level touch reached the frozen stop.", signal.stopPrice, bounds.end, expected, observed, costs);
  }
  const finalDate = expected.at(-1); const finalBar = finalDate ? byDate.get(finalDate) : undefined; const bounds = finalDate ? xnysSessionBounds(finalDate) : null;
  if (!finalBar || !bounds || !finiteOhlc(finalBar)) return emptyResult("UNVERIFIED", "missing_time_exit", "The declared horizon close is unavailable; no stale or delayed proxy was substituted.", expected, observed);
  return settle(signal, "TIME_EXIT", "horizon_time_exit", `No level touched in ${signal.primaryHorizon} complete XNYS sessions; the frozen horizon closes at the final session close.`, finalBar.close, bounds.end, expected, observed, costs);
}

// ---------------------------------------------------------------------------
// Equity paper fill rule equity-paper-fill-v1 (prospective only). A setup is
// pending until the first eligible completed daily bar after its signal
// session is observed; that bar's open is the paper fill unless it has already
// crossed the frozen invalidation. Filled setups are then evaluated from the
// fill session onward against the frozen invalidation / target 1, with the
// existing first-touch ordering, ambiguity handling, opening-gap handling and
// 30-session horizon machinery. Costs are paper-costs-v1: 10 bps round-trip.
export const PAPER_FILL_RULE_VERSION_V1 = "equity-paper-fill-v1";
// equity-paper-fill-v2 (contract repair, prospective only): v1 semantics are
// frozen below and are NOT edited. V2 fixes three proven v1 defects —
// F1: date-only next-session eligibility could fill at an open that preceded
// issuance; F2: a fill/post-fill bar opening beyond target 1 settled as a
// level-price HIT and gap handling was asymmetric; F3: closures exposed
// gross R only (repaired in the tracker's fill closure, which now also
// exposes the net R multiple). New records carry v2; v1 records keep the
// v1 decision/evaluator and their original evaluator version.
export const PAPER_FILL_RULE_VERSION = "equity-paper-fill-v2";
export function isPaperFillRuleVersion(version: string | null | undefined): boolean {
  return version === PAPER_FILL_RULE_VERSION_V1 || version === PAPER_FILL_RULE_VERSION;
}
export const PAPER_COST_SCENARIO = "paper-costs-v1";
export const PAPER_FILL_SOURCE = "yahoo-daily-candles";
export const PAPER_FILL_CONTRACT_V1 = "Paper fill = open of first eligible completed session bar after the signal session (rule equity-paper-fill-v1); costs paper-costs-v1";
export const PAPER_FILL_CONTRACT = "Paper fill = open of first eligible completed session bar after the signal session whose session open is after issuance (rule equity-paper-fill-v2); costs paper-costs-v1";
const PAPER_COSTS: CostConvention = { kind: "modeled", roundTripBps: 10, version: PAPER_COST_SCENARIO };

export type PaperFillDecision =
  | { state: "pending"; reason: string }
  | { state: "filled"; fillPrice: number; fillSessionDate: string; fillSource: typeof PAPER_FILL_SOURCE; entryAt: string }
  | { state: "expired_unfilled"; expiryReason: "invalidated_before_fill" | "fill_window_expired_no_observation"; reason: string };

export function decideEquityPaperFill(input: {
  signalDate: string;
  direction: Direction;
  invalidationLevel: number;
  bars: DailyEvidenceBar[];
  evaluatedAt: string;
  fillWindowSessions: number;
}): PaperFillDecision {
  const windowDates = expectedXnysSessions(xnysSessionBounds(input.signalDate)?.end ?? `${input.signalDate}T20:00:00.000Z`, input.fillWindowSessions);
  const lastWindowDate = windowDates.at(-1) ?? input.signalDate;
  const eligible = input.bars
    .filter((bar) => bar.date > input.signalDate && finiteOhlc(bar))
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = eligible[0];
  if (first && finiteOhlc(first)) {
    const sessionIndex = windowDates.indexOf(first.date);
    if (first.date > lastWindowDate || sessionIndex >= input.fillWindowSessions) {
      return { state: "expired_unfilled", expiryReason: "fill_window_expired_no_observation", reason: `The first eligible completed bar arrived on ${first.date}, after the ${input.fillWindowSessions}-session fill window closed on ${lastWindowDate}; the setup was never filled.` };
    }
    const crossed = input.direction === "long" ? !(first.open > input.invalidationLevel) : !(first.open < input.invalidationLevel);
    if (crossed) {
      return { state: "expired_unfilled", expiryReason: "invalidated_before_fill", reason: `The first post-signal completed bar (${first.date}) opened at ${first.open}, beyond the frozen invalidation ${input.invalidationLevel}; the setup never became a position.` };
    }
    return { state: "filled", fillPrice: first.open, fillSessionDate: first.date, fillSource: PAPER_FILL_SOURCE, entryAt: xnysSessionBounds(first.date)?.start ?? `${first.date}T13:30:00.000Z` };
  }
  const elapsed = windowDates.filter((date) => { const end = xnysSessionBounds(date)?.end; return end != null && Date.parse(end) <= Date.parse(input.evaluatedAt); }).length;
  if (elapsed >= input.fillWindowSessions) {
    return { state: "expired_unfilled", expiryReason: "fill_window_expired_no_observation", reason: `No eligible completed bar was ingested within ${input.fillWindowSessions} trading sessions after the ${input.signalDate} signal session; the fill window closed on ${lastWindowDate}.` };
  }
  return { state: "pending", reason: `Pending entry: no eligible completed session bar after the ${input.signalDate} signal session has been observed yet (${elapsed} of ${input.fillWindowSessions} fill-window sessions elapsed).` };
}

// equity-paper-fill-v2 fill decision (F1 repair). Identical to v1 except
// eligibility: a bar is eligible only if it is an XNYS session, its date is
// after the signal session date, AND its session open
// (xnysSessionBounds(bar.date).start) is strictly after the record's
// issuedAt — so an intraday issuance can never fill at an open that occurred
// before issuance. Completed-bars-only (the caller's bars), the invalidation
// screen, and the 5-XNYS-session window counting are unchanged from v1.
export function decideEquityPaperFillV2(input: {
  signalDate: string;
  direction: Direction;
  invalidationLevel: number;
  bars: DailyEvidenceBar[];
  evaluatedAt: string;
  fillWindowSessions: number;
  issuedAt: string;
}): PaperFillDecision {
  const windowDates = expectedXnysSessions(xnysSessionBounds(input.signalDate)?.end ?? `${input.signalDate}T20:00:00.000Z`, input.fillWindowSessions);
  const lastWindowDate = windowDates.at(-1) ?? input.signalDate;
  const issuedMs = Date.parse(input.issuedAt);
  const eligible = input.bars
    .filter((bar) => {
      if (!(bar.date > input.signalDate) || !finiteOhlc(bar) || !isXnysSession(bar.date)) return false;
      const bounds = xnysSessionBounds(bar.date);
      return bounds != null && Number.isFinite(issuedMs) && Date.parse(bounds.start) > issuedMs;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = eligible[0];
  if (first && finiteOhlc(first)) {
    const sessionIndex = windowDates.indexOf(first.date);
    if (first.date > lastWindowDate || sessionIndex >= input.fillWindowSessions) {
      return { state: "expired_unfilled", expiryReason: "fill_window_expired_no_observation", reason: `The first eligible completed bar arrived on ${first.date}, after the ${input.fillWindowSessions}-session fill window closed on ${lastWindowDate}; the setup was never filled.` };
    }
    const crossed = input.direction === "long" ? !(first.open > input.invalidationLevel) : !(first.open < input.invalidationLevel);
    if (crossed) {
      return { state: "expired_unfilled", expiryReason: "invalidated_before_fill", reason: `The first post-signal completed bar (${first.date}) opened at ${first.open}, beyond the frozen invalidation ${input.invalidationLevel}; the setup never became a position.` };
    }
    return { state: "filled", fillPrice: first.open, fillSessionDate: first.date, fillSource: PAPER_FILL_SOURCE, entryAt: xnysSessionBounds(first.date)?.start ?? `${first.date}T13:30:00.000Z` };
  }
  const elapsed = windowDates.filter((date) => { const end = xnysSessionBounds(date)?.end; return end != null && Date.parse(end) <= Date.parse(input.evaluatedAt); }).length;
  if (elapsed >= input.fillWindowSessions) {
    return { state: "expired_unfilled", expiryReason: "fill_window_expired_no_observation", reason: `No eligible completed bar was ingested within ${input.fillWindowSessions} trading sessions after the ${input.signalDate} signal session; the fill window closed on ${lastWindowDate}.` };
  }
  return { state: "pending", reason: `Pending entry: no eligible completed session bar after the ${input.signalDate} signal session whose open follows issuance has been observed yet (${elapsed} of ${input.fillWindowSessions} fill-window sessions elapsed).` };
}

export function paperFillEvaluation(verdict: EvaluationVerdict, reasonCode: string, reason: string, expectedSessions: string[] = [], observedSessions: string[] = []): EquityEvaluation {
  return { verdict, reasonCode, reason, grossReturnPct: null, grossR: null, modeledNetReturnPct: null, modeledNetR: null, costStatus: PAPER_COST_SCENARIO, costBps: 10, exitPrice: null, exitObservedAt: null, evidenceStartAt: observedSessions[0] ? xnysSessionBounds(observedSessions[0])?.start ?? null : null, evidenceEndAt: observedSessions.at(-1) ? xnysSessionBounds(observedSessions.at(-1)!)?.end ?? null : null, expectedSessions, observedSessions };
}

export type PaperFillEvaluationSignal = FrozenEvaluationSignal & { fillSessionDate: string };

function evaluatePaperFillSetup(signal: PaperFillEvaluationSignal, bars: DailyEvidenceBar[], evaluatedAt: string, gapThroughTargetExit: boolean): EquityEvaluation {
  if (signal.exchangeCalendar !== "XNYS" || signal.horizonUnit !== "trading_sessions") return paperFillEvaluation("UNKNOWN", "unsupported_calendar", "Missing coverage: the fill-rule setup calendar or horizon unit is unsupported, so first-touch ordering cannot be established.");
  const after = expectedXnysSessions(signal.entryAt, signal.primaryHorizon);
  if (after.length !== signal.primaryHorizon) return paperFillEvaluation("UNKNOWN", "calendar_unavailable", "Missing coverage: expected exchange sessions could not be constructed inside the validated 2025–2027 XNYS calendar coverage, so first-touch ordering cannot be established.", after);
  const windowDates = [signal.fillSessionDate, ...after];
  const horizonEnd = after.at(-1) ?? signal.fillSessionDate;
  const byDate = new Map<string, DailyEvidenceBar>();
  for (const bar of bars) if (bar.date >= signal.fillSessionDate && bar.date <= horizonEnd) byDate.set(bar.date, bar);
  const observedDates = [...byDate.keys()].sort();
  const latestObserved = observedDates.at(-1);
  if (!latestObserved) return paperFillEvaluation("OPEN", "awaiting_post_fill_evidence", "The setup is filled, but no completed post-fill bar has been observed yet.", windowDates, []);
  const required = windowDates.filter((date) => date <= latestObserved);
  const missing: string[] = [];
  for (const date of required) if (!byDate.has(date)) missing.push(date);
  if (missing.length) {
    const firstMissing = missing[0] ?? latestObserved;
    let gapEnd = firstMissing;
    for (const date of missing) { if (date >= firstMissing && (gapEnd === firstMissing || required[required.indexOf(gapEnd) + 1] === date)) gapEnd = date; else break; }
    const gapLabel = gapEnd === firstMissing ? firstMissing : `${firstMissing} through ${gapEnd}`;
    return paperFillEvaluation("UNKNOWN", "missing_post_fill_coverage", `Missing post-fill coverage: required session ${gapLabel} is absent between the fill session ${signal.fillSessionDate} and the latest observed session ${latestObserved}, so first-touch ordering cannot be established over the window under evaluation. No outcome was appended.`, windowDates, observedDates.filter((date) => date < firstMissing));
  }
  const cutoffMs = Date.parse(evaluatedAt);
  const observed: string[] = [];
  for (const date of required) {
    const bounds = xnysSessionBounds(date); if (!bounds) return paperFillEvaluation("UNKNOWN", "calendar_unavailable", `Missing coverage: no supported session bounds exist for ${date}, so first-touch ordering cannot be established.`, windowDates, observed);
    const bar = byDate.get(date); if (!bar) return paperFillEvaluation("UNKNOWN", "missing_post_fill_coverage", `Missing post-fill coverage: required session ${date} is absent, so first-touch ordering cannot be established. No outcome was appended.`, windowDates, observed);
    if (bar.availableAt && Date.parse(bar.availableAt) > cutoffMs) return paperFillEvaluation("OPEN", "evidence_not_yet_available", `Evidence for ${date} was unavailable at the evaluation cutoff.`, windowDates, observed);
    if (!finiteOhlc(bar)) return paperFillEvaluation("UNKNOWN", "invalid_post_fill_ohlc", `Missing post-fill coverage: required session ${date} has missing or incoherent OHLC, so first-touch ordering cannot be established. No outcome was appended.`, windowDates, observed);
    observed.push(date);
    const adverseGap = signal.direction === "long" ? bar.open <= signal.stopPrice : bar.open >= signal.stopPrice;
    if (adverseGap) return settle(signal, "MISS", "opening_stop_gap", "The observed post-fill session open crossed the frozen invalidation; the stop-market model exits at the adverse open before intraday extremes.", bar.open, bounds.start, windowDates, observed, PAPER_COSTS);
    if (gapThroughTargetExit) {
      // F2 repair (v2 only): uniform gap-through exits. A bar whose open is
      // already beyond target 1 exits at that bar's OPEN, recorded as a
      // gap-through exit — never as a level-price win at the frozen target.
      // Ordering is preserved: adverse (stop) gap first, then target gap,
      // then double-touch AMBIGUOUS, then intraday level touches at the
      // frozen level.
      const targetGap = signal.direction === "long" ? bar.open >= signal.targetPrice : bar.open <= signal.targetPrice;
      if (targetGap) return settle(signal, "HIT", "opening_target_gap", "The observed post-fill session open was already beyond the frozen target 1; the gap-through model exits at that open, not at the frozen target level.", bar.open, bounds.start, windowDates, observed, PAPER_COSTS);
    }
    const target = signal.direction === "long" ? bar.high >= signal.targetPrice : bar.low <= signal.targetPrice;
    const stop = signal.direction === "long" ? bar.low <= signal.stopPrice : bar.high >= signal.stopPrice;
    if (target && stop) {
      const result = paperFillEvaluation("AMBIGUOUS", "intrabar_double_touch", `The ${date} post-fill daily bar touched both target 1 and invalidation; finer evidence is required, so the outcome is ambiguous and is not resolved as a hit or a miss.`, windowDates, observed);
      return { ...result, evidenceStartAt: xnysSessionBounds(observed[0] ?? date)?.start ?? null, evidenceEndAt: bounds.end };
    }
    if (target) return settle(signal, "HIT", "first_target_touch", "The first verified post-fill level touch reached the frozen target 1.", signal.targetPrice, bounds.end, windowDates, observed, PAPER_COSTS);
    if (stop) return settle(signal, "MISS", "first_stop_touch", "The first verified post-fill level touch reached the frozen invalidation.", signal.stopPrice, bounds.end, windowDates, observed, PAPER_COSTS);
  }
  if (latestObserved >= horizonEnd) {
    const finalBar = byDate.get(horizonEnd); const bounds = xnysSessionBounds(horizonEnd);
    if (!finalBar || !bounds || !finiteOhlc(finalBar)) return paperFillEvaluation("UNKNOWN", "missing_time_exit", `Missing post-fill coverage: the horizon session ${horizonEnd} close is unavailable, so no horizon outcome was appended.`, windowDates, observed);
    return settle(signal, "TIME_EXIT", "horizon_time_exit", `No frozen level touched in the ${signal.primaryHorizon} trading sessions after the fill session; the frozen horizon closes at the ${horizonEnd} session close.`, finalBar.close, bounds.end, windowDates, observed, PAPER_COSTS);
  }
  return paperFillEvaluation("OPEN", "no_level_touch_yet", `Filled at the ${signal.fillSessionDate} open; no frozen target 1 or invalidation touch in the ${observed.length} completed post-fill session${observed.length === 1 ? "" : "s"} observed so far.`, windowDates, observed);
}

// equity-paper-fill-v1 evaluator — frozen semantics (no target gap-through:
// a bar opening beyond target 1 settles at the frozen level, as v1 shipped).
export function evaluateEquityPaperFillSetup(signal: PaperFillEvaluationSignal, bars: DailyEvidenceBar[], evaluatedAt: string): EquityEvaluation {
  return evaluatePaperFillSetup(signal, bars, evaluatedAt, false);
}

// equity-paper-fill-v2 evaluator — identical to v1 except uniform
// gap-through exits (F2): opening_target_gap beside opening_stop_gap, each
// modeled at the gapping bar's open; intraday touches still exit at the
// frozen level; TIME_EXIT at the horizon close is unchanged.
export function evaluateEquityPaperFillSetupV2(signal: PaperFillEvaluationSignal, bars: DailyEvidenceBar[], evaluatedAt: string): EquityEvaluation {
  return evaluatePaperFillSetup(signal, bars, evaluatedAt, true);
}

export function evaluateEquityDirectionForecast(signal: FrozenEvaluationSignal, bars: DailyEvidenceBar[], evaluatedAt: string): EquityEvaluation {
  if (signal.exchangeCalendar !== "XNYS" || signal.horizonUnit !== "trading_sessions") return emptyResult("UNVERIFIED", "unsupported_calendar", "The forecast calendar or horizon unit is unsupported.", []);
  const expected = expectedXnysSessions(signal.entryAt, signal.primaryHorizon); const cutoffMs = Date.parse(evaluatedAt); const observed: string[] = [];
  if (!Number.isFinite(cutoffMs) || expected.length !== signal.primaryHorizon) return emptyResult("UNVERIFIED", "calendar_unavailable", "The evaluation time or validated XNYS calendar coverage is unavailable.", expected);
  for (const date of expected) {
    const bounds = xnysSessionBounds(date); const bar = bars.find((item) => item.date === date);
    if (!bounds || Date.parse(bounds.end) > cutoffMs) return emptyResult("OPEN", "awaiting_horizon", "The fixed horizon has not matured.", expected, observed);
    if (bar?.availableAt && (!Number.isFinite(Date.parse(bar.availableAt)) || Date.parse(bar.availableAt) > cutoffMs)) return emptyResult("OPEN", "evidence_not_yet_available", `Evidence for ${date} was unavailable at the evaluation cutoff.`, expected, observed);
    if (!bar || !finiteOhlc(bar)) return emptyResult("UNVERIFIED", "missing_required_session", `Required fixed-horizon session ${date} is missing or invalid.`, expected, observed);
    observed.push(date);
  }
  const date = expected.at(-1); const bar = date ? bars.find((item) => item.date === date) : undefined; const bounds = date ? xnysSessionBounds(date) : null;
  if (!bar || !bounds || !finiteOhlc(bar)) return emptyResult("UNVERIFIED", "missing_horizon_observation", "The exact horizon observation is unavailable.", expected, observed);
  const gross = linearReturnPct(signal.direction, signal.entryPrice, bar.close);
  return settle(signal, (gross ?? 0) > 0 ? "HIT" : "MISS", "fixed_horizon_direction", `Direction is graded only at the fixed ${signal.primaryHorizon}-session close.`, bar.close, bounds.end, expected, observed, { kind: "unknown" });
}

export function acceptedEvaluationRevisions<T extends { id: number; signalId: number; product: string; evaluatedAt: Date; accepted: boolean }>(rows: T[]): Map<string, T> {
  const current = new Map<string, T>();
  for (const row of rows.filter((item) => item.accepted).sort((a, b) => a.evaluatedAt.getTime() - b.evaluatedAt.getTime() || a.id - b.id)) current.set(`${row.signalId}|${row.product}`, row);
  return current;
}
export function acceptedEvaluationRevisionsForCohort<T extends { id: number; signalId: number; product: string; cohortKey: string; evaluatedAt: Date; accepted: boolean }>(rows: T[], cohortKeys: ReadonlySet<string>): Map<string, T> {
  return acceptedEvaluationRevisions(rows.filter((row) => cohortKeys.has(row.cohortKey)));
}

export function assessDirectionalEvidence(returns: number[]): { sampleSufficient: boolean; positiveEconomics: boolean; edgeValidated: false; qualified: boolean } {
  const sampleSufficient = returns.length >= 20;
  const average = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null;
  const positiveEconomics = average != null && average > 0;
  return { sampleSufficient, positiveEconomics, edgeValidated: false, qualified: sampleSufficient && positiveEconomics };
}

export type ReplayFactorQuality = "GOOD" | "NO_DATA" | "STALE" | "ANOMALY";
export type ReplayFactor = { id: string; name: string; weight: number; score: -1 | 0 | 1; contribution: number; reading: string; quality: ReplayFactorQuality; asOf: string; source: string; qualityReason: string };
export type EquityIssuanceGate = { allowed: boolean; reason: string | null; belowSma50: boolean | null; lowerHighs: boolean | null; trend20Negative: boolean | null };
export type ReconstructedEquityCandidate = {
  status: "accepted" | "rejected" | "partial";
  reason: string | null;
  reconstruction: ReturnType<typeof computeEquityDecisionFromRawInputs>;
  gate: EquityIssuanceGate | null;
};
export type EquityDecisionSnapshot = {
  availableThrough: string;
  rawBars: Array<DailyEvidenceBar & { volume?: number | null }>;
  factors: unknown;
  decision: { direction: Direction; score: number };
  levels: { entryPrice: number; stopPrice: number; target1: number; target2: number; atr14?: number };
  canonicalParameters?: { invalidationAtrMultiple?: number; target1R?: number; target2R?: number; weights?: Record<string, number> };
};
export type ReplayMismatch = { field: string; saved: unknown; recomputed: unknown };

function replayRound(value: number, places = 4): number { const f = 10 ** places; return Math.round(value * f) / f; }
function replayAverage(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function replayEma(values: number[], period: number): number | null {
  if (values.length < period) return null; const seed = replayAverage(values.slice(0, period)); if (seed == null) return null;
  const k = 2 / (period + 1); let out = seed; for (const value of values.slice(period)) out = value * k + out * (1 - k); return out;
}
function replayRsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null; let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const current = closes[i], previous = closes[i - 1]; if (current == null || previous == null) return null; const delta = current - previous; gains += Math.max(0, delta); losses += Math.max(0, -delta); }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) { const current = closes[i], previous = closes[i - 1]; if (current == null || previous == null) continue; const delta = current - previous; avgGain = (avgGain * (period - 1) + Math.max(0, delta)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(0, -delta)) / period; }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}
function replayAtr(bars: Array<DailyEvidenceBar & { volume?: number | null }>, period = 14): number | null {
  const trs: number[] = []; for (let i = 1; i < bars.length; i++) { const current = bars[i], previous = bars[i - 1]; if (!current || !previous || current.high == null || current.low == null || previous.close == null) continue; trs.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close))); }
  if (trs.length < period) return null; let value = replayAverage(trs.slice(0, period)); if (value == null) return null; for (const tr of trs.slice(period)) value = (value * (period - 1) + tr) / period; return value;
}
function replayZ(values: number[]): number | null { if (values.length < 10) return null; const mean = replayAverage(values); if (mean == null) return null; const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length); return sd ? ((values.at(-1) ?? mean) - mean) / sd : 0; }
const DEFAULT_WEIGHTS: Record<string, number> = { price_vs_sma20: 6, price_vs_sma50: 8, price_vs_sma200: 8, rsi14_wilder: 20, macd_12_26: 8, volume_direction_z: 20, atr_adjusted_trend30: 20 };

export function computeEquityDecisionFromRawInputs(rawBars: Array<DailyEvidenceBar & { volume?: number | null }>, decisionAt: string, parameters: EquityDecisionSnapshot["canonicalParameters"] = {}) {
  type EligibleBar = DailyEvidenceBar & { open: number; high: number; low: number; close: number; volume?: number | null; availableAt: string };
  const cutoff = Date.parse(decisionAt);
  const observedByCutoff = rawBars.filter((bar) => {
    const available = bar.availableAt ? Date.parse(bar.availableAt) : NaN;
    return Number.isFinite(available) && available <= cutoff;
  });
  const malformedByCutoff = observedByCutoff.filter((bar) => !finiteOhlc(bar));
  const eligible = observedByCutoff.filter((bar): bar is EligibleBar => finiteOhlc(bar) && typeof bar.availableAt === "string").sort((a, b) => a.date.localeCompare(b.date));
  if (!Number.isFinite(cutoff)) return { status: "partial" as const, reason: "decision cutoff is invalid", bars: eligible, factors: [] as ReplayFactor[], decision: null, levels: null };
  if (malformedByCutoff.length) return { status: "partial" as const, reason: `${malformedByCutoff.length} available bar(s) have missing or incoherent OHLC`, bars: eligible, factors: [] as ReplayFactor[], decision: null, levels: null };
  if (eligible.length < 200) return { status: "partial" as const, reason: `reconstruction requires 200 available coherent OHLC bars; received ${eligible.length}`, bars: eligible, factors: [] as ReplayFactor[], decision: null, levels: null };
  const closes = eligible.map((bar) => bar.close); const last = eligible.at(-1); const previous = eligible.at(-2); if (!last || !previous) return { status: "partial" as const, reason: "latest bars unavailable", bars: eligible, factors: [] as ReplayFactor[], decision: null, levels: null };
  const latestAvailableMs = Date.parse(last.availableAt); const ageDays = Math.max(0, (cutoff - latestAvailableMs) / DAY_MS);
  const hasAnomaly = eligible.slice(-260).some((bar, index, rows) => { const prior = rows[index - 1]; if (!prior || prior.close <= 0) return false; const move = bar.close / prior.close - 1; return !Number.isFinite(move) || move <= -1 || Math.abs(move) > .8; });
  const volumes = eligible.map((bar) => bar.volume).filter((value): value is number => typeof value === "number" && Number.isFinite(value)); const atr14 = replayAtr(eligible);
  const mean = (period: number) => replayAverage(closes.slice(-period)); const sma20 = mean(20), sma50 = mean(50), sma200 = mean(200), rsi14 = replayRsi(closes), fast = replayEma(closes, 12), slow = replayEma(closes, 26), volumeZ = replayZ(volumes.slice(-20)); const prior30 = closes.at(-31); const return30 = prior30 && prior30 > 0 ? (last.close / prior30 - 1) * 100 : null; const riskAdjusted = return30 == null || atr14 == null ? null : return30 / Math.max(.01, atr14 / last.close * 100 * Math.sqrt(30));
  const weights = { ...DEFAULT_WEIGHTS, ...(parameters?.weights ?? {}) };
  const factor = (id: string, name: string, rawScore: -1 | 0 | 1, reading: string, hasData = true): ReplayFactor => {
    const quality: ReplayFactorQuality = hasAnomaly ? "ANOMALY" : ageDays > 5 ? "STALE" : !hasData ? "NO_DATA" : "GOOD";
    const score: -1 | 0 | 1 = quality === "GOOD" ? rawScore : 0;
    const qualityReason = quality === "ANOMALY" ? "A recent daily move exceeded the 80% anomaly gate; contribution withheld." : quality === "STALE" ? `Latest source bar is ${replayRound(ageDays, 1)} days old at the decision cutoff; contribution withheld above 5 days.` : quality === "NO_DATA" ? "Minimum source sample was not available; contribution withheld." : "Sample, anomaly, coverage, and freshness gates passed.";
    return { id, name, weight: weights[id] ?? 0, score, contribution: (weights[id] ?? 0) * score, reading, quality, asOf: last.date, source: "persisted Yahoo OHLCV replay", qualityReason };
  };
  const factors = [
    factor("price_vs_sma20", "Price vs SMA 20", sma20 == null ? 0 : last.close > sma20 ? 1 : -1, sma20 == null ? "Unavailable" : `${replayRound(last.close,2)} vs ${replayRound(sma20,2)}`, sma20 != null),
    factor("price_vs_sma50", "Price vs SMA 50", sma50 == null ? 0 : last.close > sma50 ? 1 : -1, sma50 == null ? "Unavailable" : `${replayRound(last.close,2)} vs ${replayRound(sma50,2)}`, sma50 != null),
    factor("price_vs_sma200", "Price vs SMA 200", sma200 == null ? 0 : last.close > sma200 ? 1 : -1, sma200 == null ? "Unavailable" : `${replayRound(last.close,2)} vs ${replayRound(sma200,2)}`, sma200 != null),
    factor("rsi14_wilder", "Wilder RSI 14", rsi14 == null ? 0 : rsi14 >= 55 && rsi14 <= 75 ? 1 : rsi14 <= 45 && rsi14 >= 25 ? -1 : 0, rsi14 == null ? "Unavailable" : String(replayRound(rsi14,2)), rsi14 != null),
    factor("macd_12_26", "MACD 12–26", fast == null || slow == null || Math.abs(fast - slow) < .000001 ? 0 : fast > slow ? 1 : -1, fast == null || slow == null ? "Unavailable" : String(replayRound(fast-slow,2)), fast != null && slow != null),
    factor("volume_direction_z", "High-volume direction", volumeZ == null || volumeZ <= 1 ? 0 : last.close > previous.close ? 1 : last.close < previous.close ? -1 : 0, volumeZ == null ? "Unavailable" : `${replayRound(volumeZ,2)}σ`, volumeZ != null),
    factor("atr_adjusted_trend30", "ATR-adjusted 30-session trend", riskAdjusted == null || Math.abs(riskAdjusted) < .5 ? 0 : riskAdjusted > 0 ? 1 : -1, riskAdjusted == null ? "Unavailable" : String(replayRound(riskAdjusted,2)), riskAdjusted != null),
  ];
  const totalWeight = factors.reduce((sum, row) => sum + row.weight, 0); if (!(totalWeight > 0)) return { status: "partial" as const, reason: "factor weights are unavailable", bars: eligible, factors, decision: null, levels: null };
  const rawScore = Math.round(100 * factors.reduce((sum, row) => sum + row.contribution, 0) / totalWeight); const trendIds = new Set(["price_vs_sma20","price_vs_sma50","price_vs_sma200","macd_12_26","atr_adjusted_trend30"]); const trend = factors.filter((row) => trendIds.has(row.id)); const redundancy = trend.length === trendIds.size && trend.every((row) => row.score === 1) ? -5 : trend.length === trendIds.size && trend.every((row) => row.score === -1) ? 5 : 0; const score = rawScore + redundancy; const direction: Direction = score >= 0 ? "long" : "short";
  if (factors.some((row) => row.quality === "STALE" || row.quality === "ANOMALY")) return { status: "partial" as const, reason: "freshness or anomaly gate withheld one or more required factors", bars: eligible, factors, decision: { direction, score, rawScore, redundancyAdjustment: redundancy }, levels: null };
  if (atr14 == null) return { status: "partial" as const, reason: "ATR-14 unavailable", bars: eligible, factors, decision: { direction, score, rawScore, redundancyAdjustment: redundancy }, levels: null }; const multiple = parameters?.invalidationAtrMultiple ?? 2, target1R = parameters?.target1R ?? 1.5, target2R = parameters?.target2R ?? 2.5; const stopPrice = last.close + (direction === "long" ? -1 : 1) * atr14 * multiple, risk = Math.abs(last.close - stopPrice);
  return { status: "reconstructed" as const, reason: null, bars: eligible, factors, decision: { direction, score, rawScore, redundancyAdjustment: redundancy }, levels: { entryPrice: replayRound(last.close,2), stopPrice: replayRound(stopPrice,2), target1: replayRound(last.close + (direction === "long" ? 1 : -1) * risk * target1R,2), target2: replayRound(last.close + (direction === "long" ? 1 : -1) * risk * target2R,2), atr14: replayRound(atr14,4) } };
}

function reconstructedLowerHighs(points: Array<DailyEvidenceBar & { close: number }>): boolean | null {
  const recent = points.slice(-35); if (recent.length < 12) return null;
  const peaks: number[] = [];
  for (let index = 2; index < recent.length - 2; index += 1) {
    const currentHigh = recent[index]?.high; if (currentHigh == null) continue;
    const neighbors = [recent[index - 2]?.high, recent[index - 1]?.high, recent[index + 1]?.high, recent[index + 2]?.high];
    const measured = neighbors.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (measured.length === neighbors.length && measured.every((value) => currentHigh >= value)) peaks.push(currentHigh);
  }
  if (peaks.length >= 2) return (peaks.at(-1) ?? Infinity) < (peaks.at(-2) ?? -Infinity);
  const latest = recent.slice(-5).map((row) => row.high).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const prior = recent.slice(-10, -5).map((row) => row.high).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return latest.length === 5 && prior.length === 5 ? Math.max(...latest) < Math.max(...prior) : null;
}

export function evaluateEquityIssuanceGate(direction: Direction, stopPrice: number, signalDate: string, history: Array<DailyEvidenceBar & { close: number }>): EquityIssuanceGate {
  const signalDay = history.find((row) => row.date === signalDate) ?? null;
  if (!signalDay || !finiteOhlc(signalDay)) return { allowed: false, reason: `issuance-check unavailable: exact completed signal-day OHLC was not available for ${signalDate}`, belowSma50: null, lowerHighs: null, trend20Negative: null };
  const breached = direction === "long" ? signalDay.low <= stopPrice : signalDay.high >= stopPrice;
  if (breached) return { allowed: false, reason: direction === "long" ? `born-dead LONG: signal-day low ${replayRound(signalDay.low, 4)} <= invalidation ${replayRound(stopPrice, 4)}` : `born-dead SHORT: signal-day high ${replayRound(signalDay.high, 4)} >= invalidation ${replayRound(stopPrice, 4)}`, belowSma50: null, lowerHighs: null, trend20Negative: null };
  if (direction === "long") return { allowed: true, reason: null, belowSma50: null, lowerHighs: null, trend20Negative: null };
  const signalIndex = history.findIndex((row) => row.date === signalDate); const throughSignalDay = signalIndex >= 0 ? history.slice(0, signalIndex + 1) : history.filter((row) => row.date <= signalDate);
  const mean50 = replayAverage(throughSignalDay.slice(-50).map((row) => row.close)); const close20Ago = throughSignalDay.at(-21)?.close;
  const belowSma50 = mean50 == null ? null : signalDay.close < mean50; const lowerHighs = reconstructedLowerHighs(throughSignalDay); const trend20Negative = close20Ago == null ? null : signalDay.close < close20Ago;
  const bearishStructure = belowSma50 === true && (lowerHighs === true || trend20Negative === true);
  return bearishStructure ? { allowed: true, reason: null, belowSma50, lowerHighs, trend20Negative } : { allowed: false, reason: `short-regime: bearish daily structure gate not met on ${signalDate}`, belowSma50, lowerHighs, trend20Negative };
}

export function reconstructAndValidateEquityCandidate(rawBars: Array<DailyEvidenceBar & { volume?: number | null }>, decisionAt: string, signalDate: string, parameters: EquityDecisionSnapshot["canonicalParameters"] = {}): ReconstructedEquityCandidate {
  const reconstruction = computeEquityDecisionFromRawInputs(rawBars, decisionAt, parameters);
  if (reconstruction.status !== "reconstructed" || !reconstruction.decision || !reconstruction.levels) return { status: "partial", reason: reconstruction.reason ?? "candidate reconstruction was incomplete", reconstruction, gate: null };
  const gate = evaluateEquityIssuanceGate(reconstruction.decision.direction, reconstruction.levels.stopPrice, signalDate, reconstruction.bars);
  return gate.allowed ? { status: "accepted", reason: null, reconstruction, gate } : { status: "rejected", reason: gate.reason, reconstruction, gate };
}

function compareReplay(field: string, saved: unknown, recomputed: unknown, mismatches: ReplayMismatch[]): void { if (JSON.stringify(saved) !== JSON.stringify(recomputed)) mismatches.push({ field, saved, recomputed }); }
export function deterministicReplaySnapshot(snapshot: EquityDecisionSnapshot, decisionAt: string) {
  const replay = computeEquityDecisionFromRawInputs(snapshot.rawBars, decisionAt, snapshot.canonicalParameters); const mismatches: ReplayMismatch[] = [];
  if (replay.decision) { compareReplay("decision.direction", snapshot.decision.direction, replay.decision.direction, mismatches); compareReplay("decision.score", snapshot.decision.score, replay.decision.score, mismatches); }
  if (replay.levels) for (const field of ["entryPrice","stopPrice","target1","target2"] as const) compareReplay(`levels.${field}`, snapshot.levels[field], replay.levels[field], mismatches);
  const savedFactors = Array.isArray(snapshot.factors) ? snapshot.factors as Array<Record<string, unknown>> : []; for (const factor of replay.factors) { const saved = savedFactors.find((row) => row.id === factor.id || row.name === factor.name); compareReplay(`factors.${factor.id}.score`, saved?.score ?? null, factor.score, mismatches); }
  return { ...replay, availableThrough: snapshot.availableThrough, mismatches, matchesSaved: replay.status === "reconstructed" && mismatches.length === 0 };
}
