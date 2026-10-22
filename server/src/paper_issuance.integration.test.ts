import { describe, expect, test } from "bun:test";
import type { Ctx } from "@hatch/space-sdk";
import { Actions, computeDailySignalSnapshots, recordSignal } from "./actions";
import * as schema from "./schema";

// Sandbox verification for the bounded equity paper restart activation:
// the post-reconcile issuance step inside the daily postmortem lane.
// Cases (a)–(f) are the activation contract's required checks — cohort
// capacity with reservations, reservation release on expiry, permanent
// cohort consumption after settlement, dedupe/idempotency, fail-stop with
// halt set + clear, and reconcile-before-issuance ordering — plus (g), the
// happy path through the REAL recordSignal issuance path. Every case runs
// against an isolated in-memory DB double with synthetic series injected
// through the lane's dependency seams; no durable tracker row is read or
// written.

const SIGNAL_DATE = "2026-08-14"; // Friday
const factor = { name: "Price vs SMA 20", weight: 6, score: 1, contribution: 6, reading: "fixture", quality: "GOOD", asOf: SIGNAL_DATE, source: "synthetic fixture", qualityReason: "fixture coverage complete" };

function fillSignal(id: number, symbol: string, overrides: Record<string, unknown> = {}) {
  return {
    id, symbol, instrumentName: "Synthetic restart fixture", setupType: "Trend", direction: "long", confidence: 25,
    entryPrice: 100, signalDate: SIGNAL_DATE, factorBreakdownJson: JSON.stringify([factor]),
    invalidationLevel: 90, invalidationAtr14: 5, invalidationAtrMultiple: 2, invalidationMethod: "2× ATR-14 from adjusted daily bars",
    roomToBreatheAtr: 2, tightInvalidation: false, invalidationGrade: "VOLATILITY", provenanceIncomplete: false,
    provenanceReferenceEntryPrice: 100, provenanceSourceAsOf: "2026-08-14T20:00:00.000Z",
    entryState: "pending_entry", fillRuleVersion: "equity-paper-fill-v2", costScenario: "paper-costs-v1", fillWindowSessions: 5,
    fillPrice: null, fillSessionDate: null, fillSource: null, fillRecordedAt: null, expiryReason: null,
    target1: 115, target2: 125, strategyId: "equity-factor-agreement", strategyVersion: "3.1.0-measurement-closure",
    parameterHash: "atr2-target1.5R-weights-6-8-8-20-8-20-20", buildId: "phase1-final-signoff-2026-10-09",
    decisionAt: "2026-08-14T20:00:00.000Z", availableAt: "2026-08-14T20:00:00.000Z", issuedAt: "2026-08-14T20:05:00.000Z",
    entryAt: null, expiresAt: null, inputSnapshotId: "restart-fixture-snapshot", issuanceIdentity: `restart-fixture-${id}`,
    barStart: "2026-08-14T13:30:00.000Z", barEnd: "2026-08-14T20:00:00.000Z", barIsClosed: true,
    priceBasis: "Yahoo adjusted OHLC paper fill",
    entryRule: "Paper fill = open of first eligible completed session bar after the signal session whose session open is after issuance (rule equity-paper-fill-v2); costs paper-costs-v1",
    riskPerUnit: 10, primaryHorizon: 30, horizonUnit: "trading_sessions", featureValuesJson: JSON.stringify([factor]),
    gateResultsJson: JSON.stringify({ allowed: true }), scoreDefinition: "fixture", dataCoverage: 1, validationStatus: "collecting",
    exchangeCalendar: "XNYS", venue: "Yahoo Finance", instrumentType: "EQUITY", sourceAsOf: "2026-08-14T20:00:00.000Z",
    barTimestamp: "2026-08-14T20:00:00.000Z", barState: "closed", sourceUrl: "https://example.test/synthetic-restart-fixture",
    return5d: null, return14d: null, return30d: null, sourceCandidateId: null,
    createdAt: new Date("2026-08-14T20:05:00.000Z"), updatedAt: new Date("2026-08-14T20:05:00.000Z"),
    ...overrides,
  } as any;
}
function filledSignal(id: number, symbol: string, overrides: Record<string, unknown> = {}) {
  return fillSignal(id, symbol, {
    entryState: "filled", entryPrice: 101, fillPrice: 101, fillSessionDate: "2026-08-17", fillSource: "yahoo-daily-candles",
    fillRecordedAt: new Date("2026-08-18T12:00:00.000Z"), entryAt: "2026-08-17T13:30:00.000Z",
    ...overrides,
  });
}
function candidateRow(id: number, symbol: string, runId: number, overrides: Record<string, unknown> = {}) {
  return {
    id, runId, symbol, instrumentName: "Synthetic restart candidate", sector: "Fixture", direction: "long", agreementScore: 25,
    activeFlags: 1, return15d: 1, volumeZ: 1, rankScore: 100, confidenceTier: "medium", dimensionsJson: "[]", researchRequiredJson: "[]",
    factorBreakdownJson: JSON.stringify([factor]), invalidationLevel: 90, sourceUrl: "https://example.test/synthetic-restart-fixture",
    why: "fixture candidate", sourceAsOf: "2026-08-14T20:00:00.000Z", status: "candidate", issuedSignalId: null,
    createdAt: new Date("2026-08-15T12:00:00.000Z"), ...overrides,
  } as any;
}
function batchRow(id: number, runId: number) {
  return { id, universe: "sp100", runId, symbolListJson: "[]", processedCount: 1, stage: "done", cycleKey: "2026-08-14-1530", createdAt: new Date("2026-08-15T12:00:00.000Z"), updatedAt: new Date("2026-08-15T12:00:00.000Z") } as any;
}
function batchResultRow(id: number, batchRunId: number, symbol: string, allowed = true) {
  return {
    id, batchRunId, symbol,
    gateJson: "{}",
    issuanceJson: JSON.stringify({ issuance: { allowed, reason: allowed ? null : "born-dead fixture", belowSma50: null, lowerHighs: null, trend20Negative: null }, signalDay: { date: SIGNAL_DATE, open: 99, high: 101, low: 98, close: 100, volume: 1_000 }, issuanceSourceUrl: "https://example.test/synthetic-restart-fixture" }),
    rankScore: 100, completedAt: new Date("2026-08-15T12:00:00.000Z"),
  } as any;
}

const bar = (date: string, open: number, high: number, low: number, close: number) => ({ date, open, high, low, close, volume: 1_000 });
const seriesOf = (points: any[]) => ({ meta: {}, points, weekly: [], events: [], sourceUrl: "https://example.test/synthetic-restart-fixture" }) as any;
const SIGNAL_DAY_BAR = bar(SIGNAL_DATE, 99, 101, 98, 100);
const MILD_SERIES = seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 106, 99, 104), bar("2026-08-18", 105, 110, 103, 108)]);
const HIT_SERIES = seriesOf([SIGNAL_DAY_BAR, bar("2026-08-17", 101, 106, 99, 104), bar("2026-08-18", 105, 116, 103, 114)]);

type Rows = {
  signals: any[]; revisions: any[]; verdicts: any[]; interim: any[]; briefs: any[]; legacyEvaluations: any[];
  candidates: any[]; batches: any[]; batchResults: any[]; issuanceState: any[]; issuancePasses: any[];
  suppressed: any[]; events: any[]; inputSnapshots: any[]; notifications: any[];
};
// Extract simple `column = param` pairs from a drizzle where clause so
// fixture updates apply to the rows production intended (the production
// lane code itself filters selects in JS, so selects stay unfiltered).
function eqPairs(cond: unknown): Array<[string, unknown]> {
  const pairs: Array<[string, unknown]> = [];
  let lastColumn: string | null = null; let lastOperator = "";
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.value) && record.value.every((v) => typeof v === "string")) { lastOperator += (record.value as string[]).join(""); return; }
    if (typeof record.name === "string" && "table" in record) { lastColumn = record.name as string; lastOperator = ""; return; }
    if ("value" in record && !("queryChunks" in record) && typeof record.value !== "object") {
      if (lastColumn && lastOperator.includes("=") && !lastOperator.includes("<") && !lastOperator.includes(">")) pairs.push([lastColumn, record.value]);
      lastOperator = "";
      return;
    }
    if (Array.isArray(record.queryChunks)) { for (const chunk of record.queryChunks as unknown[]) walk(chunk); return; }
    if (Array.isArray(node)) { for (const chunk of node as unknown[]) walk(chunk); }
  };
  walk(cond);
  return pairs;
}
function fixtureDb(initial: Partial<Rows> = {}) {
  const rows: Rows = {
    signals: [...(initial.signals ?? [])], revisions: [], verdicts: [], interim: [], briefs: [], legacyEvaluations: [],
    candidates: [...(initial.candidates ?? [])], batches: [...(initial.batches ?? [])], batchResults: [...(initial.batchResults ?? [])],
    issuanceState: [...(initial.issuanceState ?? [])], issuancePasses: [], suppressed: [], events: [], inputSnapshots: [], notifications: [],
  };
  let failOnTable: unknown = null;
  const rowsFor = (table: unknown): any[] =>
    table === schema.trackedSignals ? rows.signals : table === schema.signalEvaluationRevisions ? rows.revisions
    : table === schema.scorecardVerdicts ? rows.verdicts : table === schema.signalInterimSnapshots ? rows.interim
    : table === schema.signalDailyBriefs ? rows.briefs : table === schema.signalEvaluationsV2 ? rows.legacyEvaluations
    : table === schema.marketScanSignals ? rows.candidates : table === schema.scanBatchRuns ? rows.batches
    : table === schema.scanBatchSymbolResults ? rows.batchResults : table === schema.equityPaperIssuanceState ? rows.issuanceState
    : table === schema.equityPaperIssuancePasses ? rows.issuancePasses : table === schema.suppressedSignalCandidates ? rows.suppressed
    : table === schema.signalEvents ? rows.events : table === schema.signalInputSnapshots ? rows.inputSnapshots
    : table === schema.equityNotifications ? rows.notifications : [];
  const nextId = (table: unknown) => rowsFor(table).reduce((max, row) => Math.max(max, typeof row.id === "number" ? row.id : 0), 0) + 1;
  const commitInsert = (table: unknown, value: any) => {
    const target = rowsFor(table);
    if (table === schema.signalEvaluationRevisions) {
      if (target.some((row) => row.signalId === value.signalId && row.evaluatorVersion === value.evaluatorVersion && row.product === value.product && row.evidenceIdentity === value.evidenceIdentity)) return false;
      target.push({ id: target.length + 1, evaluatedAt: new Date("2026-10-09T16:00:00.000Z"), accepted: true, ...value }); return true;
    }
    if (table === schema.signalEvaluationsV2 && target.some((row) => row.signalId === value.signalId && row.evaluationVersion === value.evaluationVersion && row.product === value.product)) return false;
    if (table === schema.trackedSignals && value.issuanceIdentity && target.some((row) => row.issuanceIdentity === value.issuanceIdentity)) return false;
    if (table === schema.equityPaperIssuanceState && target.some((row) => row.id === value.id)) return false;
    const stored = value.id == null && table !== schema.signalInputSnapshots ? { id: nextId(table), ...value } : value;
    target.push(stored);
    return true;
  };
  const makeOperation = (run: () => unknown) => {
    const operation: any = {
      run,
      where: (cond: unknown) => { operation.cond = cond; return operation; },
      onConflictDoNothing: () => operation, onConflictDoUpdate: () => operation,
      returning: async () => run() ? [{ id: 1 }] : [],
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => { run(); }).then(resolve, reject),
    };
    return operation;
  };
  const makeUpdateOperation = (table: unknown, values: any) => {
    const operation: any = {
      cond: null as unknown,
      where: (cond: unknown) => { operation.cond = cond; return operation; },
      onConflictDoNothing: () => operation, onConflictDoUpdate: () => operation,
      returning: async () => { operation.apply(); return [{ id: 1 }]; },
      apply: () => {
        const pairs = eqPairs(operation.cond);
        for (const row of rowsFor(table)) {
          if (pairs.length && !pairs.every(([column, value]) => row[column] === value)) continue;
          Object.assign(row, values);
        }
        return true;
      },
      run: () => operation.apply(),
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => { operation.apply(); }).then(resolve, reject),
    };
    return operation;
  };
  const makeQuery = () => {
    let table: unknown = null; let limit: number | null = null;
    const resolveRows = () => { if (failOnTable != null && table === failOnTable) throw new Error("injected fixture select failure"); return limit == null ? [...rowsFor(table)] : rowsFor(table).slice(0, limit); };
    const query: any = {
      from: (next: unknown) => { table = next; return query; }, where: () => query, orderBy: () => query,
      limit: (value: number) => { limit = value; return Promise.resolve(resolveRows()); },
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(resolveRows).then(resolve, reject),
    };
    return query;
  };
  const db: any = {
    select: () => makeQuery(),
    insert: (table: unknown) => ({ values: (value: any) => makeOperation(() => commitInsert(table, value)) }),
    update: (table: unknown) => ({ set: (values: any) => makeUpdateOperation(table, values) }),
    delete: (_table: unknown) => makeOperation(() => true),
    batch: async (operations: any[]) => { for (const operation of operations) operation.run(); },
  };
  const ctx = { db: () => db, invalidateQueries: () => undefined } as unknown as Ctx;
  return { ctx, rows, setFailOnTable: (table: unknown) => { failOnTable = table; } };
}

function lane(store: ReturnType<typeof fixtureDb>, nowIso: string, seriesBySymbol: Map<string, any> = new Map(), extra: Record<string, unknown> = {}) {
  return {
    now: () => new Date(nowIso),
    loadFreshHistory: async (_ctx: Ctx, symbol: string) => seriesBySymbol.get(symbol) ?? MILD_SERIES,
    loadCachedHistory: async () => null,
    issueCandidate: async (_ctx: Ctx, candidate: any) => {
      const id = 5000 + store.rows.signals.length + 1;
      store.rows.signals.push(fillSignal(id, candidate.symbol, { sourceCandidateId: candidate.id, issuedAt: nowIso }));
      const stored = store.rows.candidates.find((row) => row.id === candidate.id);
      if (stored) { stored.status = "issued"; stored.issuedSignalId = id; }
      return { recorded: true, signalId: id, note: "fixture issuance" };
    },
    ...extra,
  } as any;
}
const batchWithCandidate = (candidateId: number, symbol: string, runId = 77, batchId = 7) => ({
  candidates: [candidateRow(candidateId, symbol, runId)],
  batches: [batchRow(batchId, runId)],
  batchResults: [batchResultRow(1, batchId, symbol)],
});

describe("bounded equity paper restart — post-reconcile issuance", () => {
  test("(a) CAPACITY: 3 filled + 2 pending reservations refuse a 6th qualifying candidate", async () => {
    const store = fixtureDb({
      signals: [filledSignal(101, "FILL-A"), filledSignal(102, "FILL-B"), filledSignal(103, "FILL-C"), fillSignal(104, "PEND-A"), fillSignal(105, "PEND-B")],
      ...batchWithCandidate(201, "NEWCO"),
    });
    const result = await computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-16T12:00:00.000Z", new Map([["PEND-A", seriesOf([SIGNAL_DAY_BAR])], ["PEND-B", seriesOf([SIGNAL_DAY_BAR])], ["FILL-A", seriesOf([SIGNAL_DAY_BAR])], ["FILL-B", seriesOf([SIGNAL_DAY_BAR])], ["FILL-C", seriesOf([SIGNAL_DAY_BAR])]])));
    expect(result.issuance.created).toHaveLength(0);
    expect(result.issuance.skippedCapacity.map((row) => row.symbol)).toEqual(["NEWCO"]);
    expect(result.issuance.cohortFilled).toBe(3);
    expect(result.issuance.cohortPending).toBe(2);
    expect(store.rows.signals.filter((row) => row.symbol === "NEWCO")).toHaveLength(0);
    const read = await Actions.getPaperIssuance.handler(store.ctx, { limit: 5 });
    expect(read.cohort).toEqual({ cap: 5, filled: 3, pending: 2, expiredUnfilled: 0 });
    expect(read.passes[0]?.skippedCapacity.map((row) => row.symbol)).toEqual(["NEWCO"]);
  });

  test("(b) RELEASE: a pending setup expiring unfilled in reconcile frees its reservation for the same pass", async () => {
    const store = fixtureDb({
      signals: [filledSignal(111, "FILL-A"), filledSignal(112, "FILL-B"), filledSignal(113, "FILL-C"), filledSignal(114, "FILL-D"), fillSignal(115, "OLDCO")],
      ...batchWithCandidate(211, "NEWCO"),
    });
    const series = new Map([["OLDCO", seriesOf([SIGNAL_DAY_BAR])]]);
    const result = await computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-24T12:00:00.000Z", series));
    const old = store.rows.signals.find((row) => row.symbol === "OLDCO");
    expect(old.entryState).toBe("expired_unfilled");
    expect(old.expiryReason).toBe("fill_window_expired_no_observation");
    expect(result.issuance.created.map((row) => row.symbol)).toEqual(["NEWCO"]);
    expect(result.issuance.skippedCapacity).toHaveLength(0);
    expect(result.issuance.cohortFilled).toBe(4);
    expect(result.issuance.cohortPending).toBe(1);
    const created = store.rows.signals.find((row) => row.symbol === "NEWCO");
    expect(created.entryState).toBe("pending_entry");
    expect(created.fillRuleVersion).toBe("equity-paper-fill-v2");
  });

  test("(c) COHORT HALT: after 5 cumulative fills, candidates are refused even once all 5 positions have settled", async () => {
    const store = fixtureDb({
      signals: [filledSignal(121, "SET-A"), filledSignal(122, "SET-B"), filledSignal(123, "SET-C"), filledSignal(124, "SET-D"), filledSignal(125, "SET-E")],
      ...batchWithCandidate(221, "NEWCO"),
    });
    const series = new Map(["SET-A", "SET-B", "SET-C", "SET-D", "SET-E"].map((symbol) => [symbol, HIT_SERIES] as const));
    const result = await computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-19T12:00:00.000Z", series));
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.outcomeCounts.resolved).toBe(5);
    expect(result.issuance.created).toHaveLength(0);
    expect(result.issuance.skippedCapacity.map((row) => row.symbol)).toEqual(["NEWCO"]);
    expect(result.issuance.cohortFilled).toBe(5);
  });

  test("(d) DEDUPE: re-running the pass creates no duplicate; a symbol with an active fill-rule record is skipped", async () => {
    const store = fixtureDb({
      signals: [fillSignal(135, "SAMECO")],
      candidates: [candidateRow(231, "DUPCO", 77, { rankScore: 200 }), candidateRow(232, "SAMECO", 77, { rankScore: 100 })],
      batches: [batchRow(7, 77)],
      batchResults: [batchResultRow(1, 7, "DUPCO"), batchResultRow(2, 7, "SAMECO")],
    });
    const first = await computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-21T12:00:00.000Z"));
    expect(first.issuance.created.map((row) => row.symbol)).toEqual(["DUPCO"]);
    expect(first.issuance.skippedDuplicates.map((row) => row.symbol)).toEqual(["SAMECO"]);
    const second = await computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-22T12:00:00.000Z"));
    expect(second.issuance.created).toHaveLength(0);
    expect(second.issuance.skippedDuplicates.map((row) => row.symbol)).toContain("DUPCO");
    expect(store.rows.signals.filter((row) => row.symbol === "DUPCO")).toHaveLength(1);
  });

  test("(e)+(f) FAIL-STOP + ORDERING: a reconcile failure issues nothing and sets the halt; a later successful pass clears it and resumes", async () => {
    const store = fixtureDb({
      signals: [filledSignal(141, "HELD")],
      ...batchWithCandidate(241, "FAILCO"),
    });
    const failing = lane(store, "2026-08-21T12:00:00.000Z", new Map(), {
      loadFreshHistory: async () => { throw new Error("synthetic provider outage"); },
      loadCachedHistory: async () => null,
    });
    const first = await computeDailySignalSnapshots(store.ctx, failing);
    expect(first.issuance.reconcileOk).toBe(false);
    expect(first.issuance.halted).toBe(true);
    expect(first.issuance.created).toHaveLength(0);
    expect(store.rows.signals.filter((row) => row.symbol === "FAILCO")).toHaveLength(0);
    let read = await Actions.getPaperIssuance.handler(store.ctx, { limit: 5 });
    expect(read.state.halted).toBe(true);
    expect(read.state.haltReason).toContain("Reconcile did not complete successfully");
    expect(read.state.haltedAt).not.toBeNull();
    const second = await computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-22T12:00:00.000Z"));
    expect(second.issuance.reconcileOk).toBe(true);
    expect(second.issuance.haltCleared).toBe(true);
    expect(second.issuance.halted).toBe(false);
    expect(second.issuance.created.map((row) => row.symbol)).toEqual(["FAILCO"]);
    read = await Actions.getPaperIssuance.handler(store.ctx, { limit: 5 });
    expect(read.state.halted).toBe(false);
    expect(read.passes.map((pass) => pass.reconcileOk)).toEqual([true, false]);
  });

  test("(f) ORDERING (throw): a reconcile that throws skips issuance, sets the halt, and the failure propagates", async () => {
    const store = fixtureDb({ signals: [filledSignal(151, "HELD")], ...batchWithCandidate(251, "THROWCO") });
    store.setFailOnTable(schema.signalEvaluationRevisions);
    await expect(computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-21T12:00:00.000Z"))).rejects.toThrow("injected fixture select failure");
    expect(store.rows.signals.filter((row) => row.symbol === "THROWCO")).toHaveLength(0);
    store.setFailOnTable(null);
    const read = await Actions.getPaperIssuance.handler(store.ctx, { limit: 5 });
    expect(read.state.halted).toBe(true);
    expect(read.state.haltReason).toContain("Reconcile threw in this pass");
    expect(read.passes[0]?.reconcileOk).toBe(false);
  });

  test("WRITE FAIL-STOP: a setup-creation failure sets the durable halt and stops further issuance", async () => {
    const store = fixtureDb({ ...batchWithCandidate(261, "BOOMCO") });
    const failingIssuer = async () => { throw new Error("synthetic write failure"); };
    const result = await computeDailySignalSnapshots(store.ctx, lane(store, "2026-08-21T12:00:00.000Z", new Map(), { issueCandidate: failingIssuer }));
    expect(result.issuance.created).toHaveLength(0);
    expect(result.issuance.halted).toBe(true);
    expect(result.issuance.haltReason).toContain("Setup creation failed for BOOMCO");
    const read = await Actions.getPaperIssuance.handler(store.ctx, { limit: 5 });
    expect(read.state.halted).toBe(true);
    expect(read.passes[0]?.declined.map((row) => row.symbol)).toEqual(["BOOMCO"]);
  });
});

describe("bounded equity paper restart — real issuance path", () => {
  test("(g) HAPPY PATH: the lane issues through recordSignal and stores a v2 pending_entry setup with paper-costs-v1", async () => {
    const dateAt = (index: number) => new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
    const availability = (date: string) => `${date}T20:00:00.000Z`;
    const history = Array.from({ length: 230 }, (_unused, index) => {
      const close = 70 + index * .14;
      return { date: dateAt(index), open: close - .1, high: close + .5, low: close - .5, close, volume: 1_000 + index, availableAt: availability(dateAt(index)) };
    });
    const last = history[history.length - 1]!;
    const signalDate = last.date;
    const store = fixtureDb({
      candidates: [candidateRow(271, "REALCO", 77, { sourceAsOf: availability(signalDate) })],
      batches: [batchRow(7, 77)],
      batchResults: [{ ...batchResultRow(1, 7, "REALCO"), issuanceJson: JSON.stringify({ issuance: { allowed: true, reason: null, belowSma50: null, lowerHighs: null, trend20Negative: null }, signalDay: last, issuanceSourceUrl: "https://example.test/synthetic-restart-fixture" }) }],
    });
    const risk = 10;
    const issuer = async (ctx: Ctx, candidate: any) => {
      const result = await recordSignal(ctx, candidate.symbol, candidate.instrumentName, "Trend", "long", 25, signalDate, {
        factors: [], levels: { entryPrice: last.close, stopPrice: last.close - risk, target1: last.close + risk * 1.5, target2: last.close + risk * 2.5, riskPerUnit: risk, direction: "long", atr14: risk / 2, invalidationAtrMultiple: 2, invalidationBasis: "2× ATR-14 from adjusted daily bars" },
        sourceAsOf: availability(signalDate), barTimestamp: availability(signalDate), barState: "closed", sourceUrl: "https://example.test/synthetic-restart-fixture", exchangeCalendar: "XNYS", instrumentType: "EQUITY",
      }, { candidateId: candidate.id, loadIssuanceEvidence: async () => ({ signalDay: last as any, history: history as any, sourceUrl: "https://example.test/synthetic-restart-fixture", error: null }), logSuppressed: async () => {} });
      const signal = store.rows.signals.find((row) => row.sourceCandidateId === candidate.id) ?? store.rows.signals[0];
      return { recorded: result.recorded, signalId: signal?.id ?? null, note: result.recorded ? "issued via recordSignal" : `suppressed: ${result.suppressedReason}` };
    };
    const result = await computeDailySignalSnapshots(store.ctx, lane(store, "2025-08-19T12:00:00.000Z", new Map(), { issueCandidate: issuer }));
    expect(result.issuance.created.map((row) => row.symbol)).toEqual(["REALCO"]);
    expect(result.issuance.created[0]?.signalSession).toBe(signalDate);
    const signal = store.rows.signals.find((row) => row.symbol === "REALCO");
    expect(signal.entryState).toBe("pending_entry");
    expect(signal.fillRuleVersion).toBe("equity-paper-fill-v2");
    expect(signal.costScenario).toBe("paper-costs-v1");
    expect(signal.sourceCandidateId).toBe(271);
    const candidate = store.rows.candidates.find((row) => row.id === 271);
    expect(candidate.status).toBe("issued");
    expect(candidate.issuedSignalId).toBe(signal.id);
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.outcomeCounts.pending).toBe(1);
    expect(tracker.paperIssuance.cohortPending).toBe(1);
    expect(tracker.paperIssuance.halted).toBe(false);
  });
});
