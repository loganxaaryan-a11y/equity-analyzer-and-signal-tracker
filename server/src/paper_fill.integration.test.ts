import { describe, expect, test } from "bun:test";
import type { Ctx } from "@hatch/space-sdk";
import { Actions, computeDailySignalSnapshots } from "./actions";
import * as schema from "./schema";

// Sandbox verification for the equity paper fill rule (migration 0051).
// Cases (a)–(f) run against frozen equity-paper-fill-v1 semantics; cases
// (g)–(i) verify the equity-paper-fill-v2 contract repair (F1 issuedAt-aware
// eligibility, F2 uniform gap-through exits, F3 net R in the closure).
// Every case uses a test-labeled synthetic signal in an isolated in-memory
// DB double and a synthetic Yahoo-shaped candle series injected through the
// monitoring lane's dependency seam — the same seam the production daily job
// uses. No durable tracker row is read or written.

const SIGNAL_DATE = "2026-08-14"; // Friday
const factor = { name: "Price vs SMA 20", weight: 6, score: 1, contribution: 6, reading: "fixture", quality: "GOOD", asOf: SIGNAL_DATE, source: "synthetic fixture", qualityReason: "fixture coverage complete" };

function fillSignal(id: number, symbol: string) {
  return {
    id, symbol, instrumentName: "Synthetic paper-fill fixture", setupType: "Trend", direction: "long", confidence: 25,
    entryPrice: 100, signalDate: SIGNAL_DATE, factorBreakdownJson: JSON.stringify([factor]),
    invalidationLevel: 90, invalidationAtr14: 5, invalidationAtrMultiple: 2, invalidationMethod: "2× ATR-14 from adjusted daily bars",
    roomToBreatheAtr: 2, tightInvalidation: false, invalidationGrade: "VOLATILITY", provenanceIncomplete: false,
    provenanceReferenceEntryPrice: 100, provenanceSourceAsOf: "2026-08-14T20:00:00.000Z",
    entryState: "pending_entry", fillRuleVersion: "equity-paper-fill-v1", costScenario: "paper-costs-v1", fillWindowSessions: 5,
    fillPrice: null, fillSessionDate: null, fillSource: null, fillRecordedAt: null, expiryReason: null,
    target1: 115, target2: 125, strategyId: "equity-factor-agreement", strategyVersion: "3.1.0-measurement-closure",
    parameterHash: "atr2-target1.5R-weights-6-8-8-20-8-20-20", buildId: "phase1-final-signoff-2026-10-09",
    decisionAt: "2026-08-14T20:00:00.000Z", availableAt: "2026-08-14T20:00:00.000Z", issuedAt: "2026-08-14T20:05:00.000Z",
    entryAt: null, expiresAt: null, inputSnapshotId: "fill-fixture-snapshot", issuanceIdentity: `fill-fixture-${id}`,
    barStart: "2026-08-14T13:30:00.000Z", barEnd: "2026-08-14T20:00:00.000Z", barIsClosed: true,
    priceBasis: "Yahoo adjusted OHLC paper fill",
    entryRule: "Paper fill = open of first eligible completed session bar after the signal session (rule equity-paper-fill-v1); costs paper-costs-v1",
    riskPerUnit: 10, primaryHorizon: 30, horizonUnit: "trading_sessions", featureValuesJson: JSON.stringify([factor]),
    gateResultsJson: JSON.stringify({ allowed: true }), scoreDefinition: "fixture", dataCoverage: 1, validationStatus: "collecting",
    exchangeCalendar: "XNYS", venue: "Yahoo Finance", instrumentType: "EQUITY", sourceAsOf: "2026-08-14T20:00:00.000Z",
    barTimestamp: "2026-08-14T20:00:00.000Z", barState: "closed", sourceUrl: "https://example.test/synthetic-fill-fixture",
    return5d: null, return14d: null, return30d: null, sourceCandidateId: null,
    createdAt: new Date("2026-08-14T20:05:00.000Z"), updatedAt: new Date("2026-08-14T20:05:00.000Z"),
  } as any;
}

function fillSignalV2(id: number, symbol: string, overrides: Record<string, unknown> = {}) {
  return {
    ...fillSignal(id, symbol),
    fillRuleVersion: "equity-paper-fill-v2",
    entryRule: "Paper fill = open of first eligible completed session bar after the signal session whose session open is after issuance (rule equity-paper-fill-v2); costs paper-costs-v1",
    issuanceIdentity: `fill-fixture-v2-${id}`,
    ...overrides,
  } as any;
}

const bar = (date: string, open: number, high: number, low: number, close: number) => ({ date, open, high, low, close, volume: 1_000 });
const seriesOf = (points: any[]) => ({ meta: {}, points, weekly: [], events: [], sourceUrl: "https://example.test/synthetic-fill-fixture" }) as any;
const SIGNAL_DAY_BAR = bar(SIGNAL_DATE, 99, 101, 98, 100);

type Rows = { signals: any[]; revisions: any[]; verdicts: any[]; interim: any[]; briefs: any[]; legacyEvaluations: any[] };
function fixtureDb(initialSignals: any[]) {
  const rows: Rows = { signals: [...initialSignals], revisions: [], verdicts: [], interim: [], briefs: [], legacyEvaluations: [] };
  const rowsFor = (table: unknown): any[] => table === schema.trackedSignals ? rows.signals : table === schema.signalEvaluationRevisions ? rows.revisions : table === schema.scorecardVerdicts ? rows.verdicts : table === schema.signalInterimSnapshots ? rows.interim : table === schema.signalDailyBriefs ? rows.briefs : table === schema.signalEvaluationsV2 ? rows.legacyEvaluations : [];
  const commitInsert = (table: unknown, value: any) => {
    const target = rowsFor(table);
    if (table === schema.signalEvaluationRevisions) {
      if (target.some((row) => row.signalId === value.signalId && row.evaluatorVersion === value.evaluatorVersion && row.product === value.product && row.evidenceIdentity === value.evidenceIdentity)) return false;
      target.push({ id: target.length + 1, evaluatedAt: new Date("2026-10-09T16:00:00.000Z"), ...value }); return true;
    }
    if (table === schema.signalEvaluationsV2 && target.some((row) => row.signalId === value.signalId && row.evaluationVersion === value.evaluationVersion && row.product === value.product)) return false;
    if (table === schema.signalInterimSnapshots) target.push({ id: target.length + 1, ...value });
    else if (table === schema.signalDailyBriefs) target.push({ id: target.length + 1, ...value });
    else target.push(value);
    return true;
  };
  const makeOperation = (run: () => unknown) => { const operation: any = { run, where: () => operation, onConflictDoNothing: () => operation, onConflictDoUpdate: () => operation, returning: async () => run() ? [{ id: 1 }] : [], then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => { run(); }).then(resolve, reject) }; return operation; };
  const makeQuery = () => {
    let table: unknown = null; let limit: number | null = null;
    const query: any = { from: (next: unknown) => { table = next; return query; }, where: () => query, orderBy: () => query, limit: (value: number) => { limit = value; return Promise.resolve(rowsFor(table).slice(0, limit)); }, then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve(limit == null ? rowsFor(table) : rowsFor(table).slice(0, limit)).then(resolve, reject) };
    return query;
  };
  const db: any = {
    select: () => makeQuery(),
    insert: (table: unknown) => ({ values: (value: any) => makeOperation(() => commitInsert(table, value)) }),
    update: (table: unknown) => ({ set: (values: any) => makeOperation(() => { for (const row of rowsFor(table)) Object.assign(row, values); }) }),
    batch: async (operations: any[]) => { for (const operation of operations) operation.run(); },
  };
  const ctx = { db: () => db, invalidateQueries: () => undefined } as unknown as Ctx;
  return { ctx, rows };
}

function lane(_store: ReturnType<typeof fixtureDb>, seriesRef: { current: any }, nowIso: string) {
  return { now: () => new Date(nowIso), loadFreshHistory: async () => seriesRef.current, loadCachedHistory: async () => null };
}

describe("equity-paper-fill-v1 sandbox chain", () => {
  test("(a) TARGET: pending_entry → fill at S+1 open → automatic HIT closure, net = gross − 10 bps", async () => {
    const store = fixtureDb([fillSignal(901, "FILLTEST-A")]);
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR]) };
    // Pass 1: no eligible post-signal bar yet — the setup stays pending_entry
    // with a PENDING_ENTRY verdict, and is not an issued position.
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-15T12:00:00.000Z"));
    let row = store.rows.signals[0];
    expect(row.entryState).toBe("pending_entry");
    expect(row.entryPrice).toBe(100); // reference entry, not a position entry
    let tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.signals[0]?.tradeSetupEvaluation?.verdict).toBe("PENDING_ENTRY");
    expect(tracker.signals[0]?.tradeSetupEvaluation?.costStatus).toBe("paper-costs-v1");
    expect(tracker.signals[0]?.entryLabel).toBe("PENDING ENTRY");
    expect(tracker.outcomeCounts.pending).toBe(1);
    expect(tracker.outcomeCounts.issued).toBe(0);
    // Pass 2: S+1 bar fills at its open (101); S+2 touches target 1 (115).
    seriesRef.current = seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 106, 99, 104), bar("2026-08-18", 105, 116, 103, 114)]);
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-19T12:00:00.000Z"));
    row = store.rows.signals[0];
    expect(row.entryState).toBe("filled");
    expect(row.fillPrice).toBe(101);
    expect(row.fillSessionDate).toBe("2026-08-17");
    expect(row.fillSource).toBe("yahoo-daily-candles");
    expect(row.entryPrice).toBe(101); // entry of record is now the fill price
    expect(row.provenanceReferenceEntryPrice).toBe(100); // reference preserved
    tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    const signal = tracker.signals[0];
    expect(signal?.tradeSetupEvaluation?.verdict).toBe("HIT");
    expect(signal?.tradeSetupEvaluation?.evaluatorVersion).toBe("equity-eval-3.3.0");
    expect(signal?.tradeSetupEvaluation?.grossReturnPct).toBeCloseTo(13.8614, 3);
    expect(signal?.tradeSetupEvaluation?.modeledNetReturnPct).toBeCloseTo(13.7614, 3);
    expect(signal?.monitoringClosure?.outcome).toBe("HIT");
    expect(signal?.monitoringClosure?.level).toBe("TARGET 1");
    expect(signal?.monitoringClosure?.closingMark).toBe(115);
    expect(signal?.monitoringClosure?.rMultiple).toBeCloseTo(1.2727, 3);
    // F3: the closure also exposes the net R multiple beside gross R
    // (grossR 1.2727 − cost 101×0.1% ÷ risk 11 ≈ 0.0092 → ≈ 1.2636).
    expect(signal?.monitoringClosure?.netRMultiple).toBeCloseTo(1.2636, 3);
    expect(signal?.monitoringClosure?.modeledNetReturnPct).toBeCloseTo(13.7614, 3);
    expect(tracker.outcomeCounts.resolved).toBe(1);
    expect(tracker.outcomeCounts.issued).toBe(1);
    // Automatic settlement: the lane appended revisions; no manual verdicts.
    expect(store.rows.verdicts).toHaveLength(0);
    expect(store.rows.revisions.filter((r) => r.product === "trade_setup").map((r) => r.verdict)).toEqual(["PENDING_ENTRY", "HIT"]);
  });

  test("(b) STOP: fill then invalidation touch → automatic MISS closure at INVALIDATION", async () => {
    const store = fixtureDb([fillSignal(902, "FILLTEST-B")]);
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 105, 99, 103), bar("2026-08-18", 102, 104, 89, 95)]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-19T12:00:00.000Z"));
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    const signal = tracker.signals[0];
    expect(store.rows.signals[0].entryState).toBe("filled");
    expect(signal?.tradeSetupEvaluation?.verdict).toBe("MISS");
    expect(signal?.monitoringClosure?.outcome).toBe("MISSED");
    expect(signal?.monitoringClosure?.level).toBe("INVALIDATION");
    expect(signal?.monitoringClosure?.closingMark).toBe(90);
    expect(signal?.tradeSetupEvaluation?.grossReturnPct).toBeCloseTo(-10.8911, 3);
    expect(signal?.tradeSetupEvaluation?.modeledNetReturnPct).toBeCloseTo(-10.9911, 3);
    expect(tracker.outcomeCounts.resolved).toBe(1);
  });

  test("(c) AMBIGUITY: one post-fill bar touches both levels → AMBIGUOUS, not resolved", async () => {
    const store = fixtureDb([fillSignal(903, "FILLTEST-C")]);
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 106, 99, 104), bar("2026-08-18", 108, 116, 89, 100)]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-19T12:00:00.000Z"));
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    const signal = tracker.signals[0];
    expect(signal?.tradeSetupEvaluation?.verdict).toBe("AMBIGUOUS");
    expect(signal?.monitoringClosure).toBeNull();
    expect(tracker.outcomeCounts.ambiguous).toBe(1);
    expect(tracker.outcomeCounts.resolved).toBe(0);
  });

  test("(d) MISSING COVERAGE: gap defeats first-touch ordering → UNKNOWN, no closure", async () => {
    const store = fixtureDb([fillSignal(904, "FILLTEST-D")]);
    // 2026-08-18 is missing between the fill session and a later target touch.
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 106, 99, 104), bar("2026-08-19", 105, 116, 103, 114)]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-20T12:00:00.000Z"));
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    const signal = tracker.signals[0];
    expect(store.rows.signals[0].entryState).toBe("filled");
    expect(signal?.tradeSetupEvaluation?.verdict).toBe("UNKNOWN");
    expect(signal?.tradeSetupEvaluation?.reason).toContain("2026-08-18");
    expect(signal?.tradeSetupEvaluation?.costStatus).toBe("paper-costs-v1");
    expect(signal?.monitoringClosure).toBeNull();
    expect(tracker.outcomeCounts.unknown).toBe(1);
    expect(tracker.outcomeCounts.resolved).toBe(0);
    expect(tracker.outcomeCounts.unverified).toBe(0);
  });

  test("(e) INVALIDATED BEFORE FILL: first bar opens beyond invalidation → expired_unfilled, never a position", async () => {
    const store = fixtureDb([fillSignal(905, "FILLTEST-E")]);
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 89, 95, 88, 92)]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-18T12:00:00.000Z"));
    const row = store.rows.signals[0];
    expect(row.entryState).toBe("expired_unfilled");
    expect(row.expiryReason).toBe("invalidated_before_fill");
    expect(row.fillPrice).toBeNull();
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.signals[0]?.entryLabel).toBe("EXPIRED UNFILLED");
    expect(tracker.outcomeCounts.issued).toBe(0);
    expect(tracker.outcomeCounts.open).toBe(0);
    expect(tracker.outcomeCounts.expiredUnfilled).toBe(1);
  });

  test("(f) WINDOW EXPIRY: no eligible bar within 5 sessions → expired_unfilled (fill_window_expired_no_observation)", async () => {
    const store = fixtureDb([fillSignal(906, "FILLTEST-F")]);
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-24T12:00:00.000Z"));
    const row = store.rows.signals[0];
    expect(row.entryState).toBe("expired_unfilled");
    expect(row.expiryReason).toBe("fill_window_expired_no_observation");
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.outcomeCounts.issued).toBe(0);
    expect(tracker.outcomeCounts.expiredUnfilled).toBe(1);
  });
});

describe("equity-paper-fill-v2 contract repair sandbox chain", () => {
  test("(g) F1 INTRADAY ISSUANCE: a same-day bar whose open preceded issuedAt is NOT eligible; the next session fills", async () => {
    // Signal session is Friday 2026-08-14 (prior completed session); the
    // record was issued intraday Monday 2026-08-17 at 15:00Z — after that
    // session's 13:30Z open. Under v1 date-only eligibility the Monday bar
    // would fill at an open that occurred before issuance; under v2 it is
    // ineligible and the setup fills at Tuesday's open instead.
    const signal = fillSignalV2(907, "FILLTEST-G", { issuedAt: "2026-08-17T15:00:00.000Z", decisionAt: "2026-08-17T15:00:00.000Z", availableAt: "2026-08-17T15:00:00.000Z" });
    const store = fixtureDb([signal]);
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 106, 99, 104), bar("2026-08-18", 102, 107, 100, 105)]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-19T12:00:00.000Z"));
    const row = store.rows.signals[0];
    expect(row.entryState).toBe("filled");
    expect(row.fillSessionDate).toBe("2026-08-18");
    expect(row.fillPrice).toBe(102);
    expect(row.entryPrice).toBe(102);
    // Fill time (the fill session open) stays separate from when the lane
    // recorded the fill.
    expect(row.entryAt).toBe("2026-08-18T13:30:00.000Z");
    expect(row.fillRecordedAt).toBeInstanceOf(Date);
    expect((row.fillRecordedAt as Date).toISOString()).toBe("2026-08-19T12:00:00.000Z");
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.signals[0]?.tradeSetupEvaluation?.evaluatorVersion).toBe("equity-eval-3.4.0");
    expect(tracker.signals[0]?.tradeSetupEvaluation?.verdict).toBe("OPEN");
  });

  test("(h) F2 FILL-BAR TARGET GAP: fill bar opens beyond target 1 → gap-through exit at its own open, not a level-price HIT", async () => {
    const store = fixtureDb([fillSignalV2(908, "FILLTEST-H")]);
    // Fill bar (S+1) opens at 120, already beyond target 1 (115).
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 120, 122, 118, 121)]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-18T12:00:00.000Z"));
    const row = store.rows.signals[0];
    expect(row.entryState).toBe("filled");
    expect(row.fillPrice).toBe(120);
    const hitRevision = store.rows.revisions.find((r) => r.product === "trade_setup" && r.verdict === "HIT");
    expect(hitRevision?.reasonCode).toBe("opening_target_gap");
    expect(hitRevision?.evaluatorVersion).toBe("equity-eval-3.4.0");
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    const signal = tracker.signals[0];
    expect(signal?.tradeSetupEvaluation?.verdict).toBe("HIT");
    // Exit is the bar's open (120), so gross ≈ 0 — not the frozen target
    // price (115), which under v1 produced a mechanical level-price result.
    expect(signal?.monitoringClosure?.closingMark).toBe(120);
    expect(signal?.monitoringClosure?.realizedReturnPct).toBeCloseTo(0, 6);
    expect(signal?.monitoringClosure?.rMultiple).toBeCloseTo(0, 6);
    expect(signal?.monitoringClosure?.modeledNetReturnPct).toBeCloseTo(-0.1, 6);
    expect(signal?.monitoringClosure?.netRMultiple).toBeCloseTo(-0.004, 4);
    expect(tracker.outcomeCounts.resolved).toBe(1);
  });

  test("(i) F2 POST-FILL TARGET GAP: a later bar gaps through target 1 → exit at that bar's open recorded as gap-through", async () => {
    const store = fixtureDb([fillSignalV2(909, "FILLTEST-I")]);
    // Fill at S+1 open 101 (no touch); S+2 opens at 118, beyond target 1.
    const seriesRef = { current: seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 106, 99, 104), bar("2026-08-18", 118, 120, 117, 119)]) };
    await computeDailySignalSnapshots(store.ctx, lane(store, seriesRef, "2026-08-19T12:00:00.000Z"));
    const hitRevision = store.rows.revisions.find((r) => r.product === "trade_setup" && r.verdict === "HIT");
    expect(hitRevision?.reasonCode).toBe("opening_target_gap");
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    const signal = tracker.signals[0];
    expect(signal?.tradeSetupEvaluation?.verdict).toBe("HIT");
    // Exit at the gapping bar's open (118): gross = (118−101)/101 ≈ 16.8317%,
    // not the frozen target level (115 → 13.8614%).
    expect(signal?.monitoringClosure?.closingMark).toBe(118);
    expect(signal?.tradeSetupEvaluation?.grossReturnPct).toBeCloseTo(16.8317, 3);
    expect(signal?.tradeSetupEvaluation?.modeledNetReturnPct).toBeCloseTo(16.7317, 3);
    expect(signal?.monitoringClosure?.rMultiple).toBeCloseTo(1.5455, 3);
    expect(signal?.monitoringClosure?.netRMultiple).toBeCloseTo(1.5363, 3);
    expect(tracker.outcomeCounts.resolved).toBe(1);
  });
});
