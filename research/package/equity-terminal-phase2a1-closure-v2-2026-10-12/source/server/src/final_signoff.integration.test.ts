import { describe, expect, test } from "bun:test";
import type { Ctx } from "@hatch/space-sdk";
import { Actions, computeDailySignalSnapshots, recordSignal } from "./actions";
import * as schema from "./schema";
import { expectedXnysSessions, reconstructAndValidateEquityCandidate, type DailyEvidenceBar } from "./measurement";

type TestPoint = Omit<DailyEvidenceBar, "open" | "high" | "low" | "close" | "availableAt"> & { open: number; high: number; low: number; close: number; volume: number; availableAt: string };
function dateAt(index: number) { return new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10); }
function availability(date: string) { return `${date}T20:00:00.000Z`; }
function barsForLongToShort(): TestPoint[] {
  return Array.from({ length: 230 }, (_unused, index) => {
    const close = 70 + index * .16 + (index < 180 ? 0 : Math.sin((index - 180) * .2) - (index - 180) * .12);
    return { date: dateAt(index), open: close, high: close + .5, low: close - .5, close, volume: index === 229 ? 1_000_000 : 1_000, availableAt: availability(dateAt(index)) };
  }).map((bar, index, rows) => index === 209 ? { ...bar, close: (rows[229]?.close ?? 100) - 2, open: (rows[229]?.close ?? 100) - 2, high: (rows[229]?.close ?? 100) - 1.5, low: (rows[229]?.close ?? 100) - 2.5 } : index === 228 ? { ...bar, close: (rows[229]?.close ?? 100) + 1, open: (rows[229]?.close ?? 100) + 1, high: (rows[229]?.close ?? 100) + 1.5, low: (rows[229]?.close ?? 100) + .5 } : bar);
}
function risingBars(): TestPoint[] {
  return Array.from({ length: 230 }, (_unused, index) => {
    const close = 70 + index * .14;
    return { date: dateAt(index), open: close - .1, high: close + .5, low: close - .5, close, volume: 1_000 + index, availableAt: availability(dateAt(index)) };
  });
}
function draftEvidence(direction: "long" | "short", entryPrice: number, stopPrice: number) {
  const risk = Math.abs(entryPrice - stopPrice);
  return {
    factors: [],
    levels: { entryPrice, stopPrice, target1: entryPrice + (direction === "long" ? 1 : -1) * risk * 1.5, target2: entryPrice + (direction === "long" ? 1 : -1) * risk * 2.5, riskPerUnit: risk, direction, atr14: risk / 2, invalidationAtrMultiple: 2, invalidationBasis: "2× ATR-14 from adjusted daily bars" },
    sourceAsOf: availability(dateAt(229)), barTimestamp: availability(dateAt(229)), barState: "closed" as const, sourceUrl: "https://example.test/yahoo-fixture", exchangeCalendar: "XNYS", instrumentType: "EQUITY",
  };
}
function isolatedDb(options: { failAt?: number; interleave?: boolean } = {}) {
  const signals: any[] = []; const snapshots: any[] = []; const events: any[] = []; let failed = false; let queue = Promise.resolve();
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => signals.length ? [signals[0]] : [] }) }) }),
    insert: (_table: unknown) => ({ values: (value: any) => ({ onConflictDoNothing: (_args?: unknown) => ({ value }) }) }),
    batch: async (operations: Array<{ value?: any }>) => {
      const run = async () => {
        if (options.interleave) await new Promise((resolve) => setTimeout(resolve, 0));
        const staged = operations.map((operation) => operation.value).filter(Boolean);
        for (let index = 0; index < staged.length; index += 1) {
          if (!failed && options.failAt === index) { failed = true; throw new Error(`injected boundary ${index}`); }
        }
        for (const value of staged) {
          if (value.issuanceIdentity && !signals.some((row) => row.issuanceIdentity === value.issuanceIdentity)) signals.push(value);
          else if (value.rawInputsJson && !snapshots.some((row) => row.signalId === value.signalId)) snapshots.push(value);
          else if (value.eventType === "issued") { if (!events.some((row) => row.signalId === value.signalId && row.eventType === "issued")) events.push(value); }
          else if (value.eventType && !events.some((row) => row.contentHash === value.contentHash)) events.push(value);
        }
      };
      const next = queue.then(run, run); queue = next.catch(() => undefined); return next;
    },
  };
  return { ctx: { db: () => db } as unknown as Ctx, signals, snapshots, events };
}

type PipelineRows = { signals: any[]; revisions: any[]; verdicts: any[]; interim: any[]; briefs: any[]; legacyEvaluations: any[] };
function pipelineFixture() {
  const entryAt = "2026-08-17T13:30:00.000Z";
  const expected = expectedXnysSessions(entryAt, 30);
  const points = expected.map((date, index) => ({ date, open: 100 + index * .3, high: 102 + index * .4, low: 98 + index * .2, close: 100 + index * .35, volume: 1_000 }));
  const factor = { name: "Price vs SMA 20", weight: 6, score: 1, contribution: 6, reading: "fixture", quality: "GOOD", asOf: "2026-08-14", source: "synthetic fixture", qualityReason: "fixture coverage complete" };
  const signal = { id: 701, symbol: "FIX", instrumentName: "Synthetic daily-action fixture", setupType: "Trend", direction: "long", confidence: 25, entryPrice: 100, signalDate: "2026-08-14", factorBreakdownJson: JSON.stringify([factor]), invalidationLevel: 90, invalidationAtr14: 5, invalidationAtrMultiple: 2, invalidationMethod: "2× ATR-14 from adjusted daily bars", target1: 115, target2: 125, strategyId: "equity-factor-agreement", strategyVersion: "3.1.0-measurement-closure", parameterHash: "atr2-target1.5R-weights-6-8-8-20-8-20-20", buildId: "phase1-final-signoff-2026-10-09", decisionAt: "2026-08-14T20:00:00.000Z", availableAt: "2026-08-14T20:00:00.000Z", issuedAt: entryAt, entryAt, expiresAt: null, inputSnapshotId: "fixture-snapshot", issuanceIdentity: "fixture-identity", barStart: "2026-08-14T13:30:00.000Z", barEnd: "2026-08-14T20:00:00.000Z", barIsClosed: true, priceBasis: "Yahoo adjusted OHLC research reference", entryRule: "Reference entry equals the completed adjusted daily close; paper execution is not claimed", riskPerUnit: 10, primaryHorizon: 30, horizonUnit: "trading_sessions", featureValuesJson: JSON.stringify([factor]), gateResultsJson: JSON.stringify({ allowed: true }), scoreDefinition: "fixture", dataCoverage: 1, validationStatus: "collecting", exchangeCalendar: "XNYS", venue: "Yahoo Finance", instrumentType: "EQUITY", sourceAsOf: "2026-08-14T20:00:00.000Z", barTimestamp: "2026-08-14T20:00:00.000Z", barState: "closed", sourceUrl: "https://example.test/synthetic-fixture", return5d: null, return14d: null, return30d: null, updatedAt: new Date("2026-08-14T20:00:00.000Z") };
  return { signal, points, series: { meta: {}, points, weekly: [], events: [], sourceUrl: "https://example.test/synthetic-fixture" } as any };
}
function pipelineDb(initialSignals: any[]) {
  const rows: PipelineRows = { signals: [...initialSignals], revisions: [], verdicts: [], interim: [], briefs: [], legacyEvaluations: [] };
  const rowsFor = (table: unknown): any[] => table === schema.trackedSignals ? rows.signals : table === schema.signalEvaluationRevisions ? rows.revisions : table === schema.scorecardVerdicts ? rows.verdicts : table === schema.signalInterimSnapshots ? rows.interim : table === schema.signalDailyBriefs ? rows.briefs : table === schema.signalEvaluationsV2 ? rows.legacyEvaluations : [];
  const commitInsert = (table: unknown, value: any) => {
    const target = rowsFor(table);
    if (table === schema.signalEvaluationRevisions) {
      if (target.some((row) => row.signalId === value.signalId && row.evaluatorVersion === value.evaluatorVersion && row.product === value.product && row.evidenceIdentity === value.evidenceIdentity)) return;
      target.push({ id: target.length + 1, evaluatedAt: new Date("2026-10-09T16:00:00.000Z"), ...value }); return;
    }
    if (table === schema.signalEvaluationsV2 && target.some((row) => row.signalId === value.signalId && row.evaluationVersion === value.evaluationVersion && row.product === value.product)) return;
    if (table === schema.signalInterimSnapshots) target.push({ id: target.length + 1, ...value });
    else if (table === schema.signalDailyBriefs) target.push({ id: target.length + 1, ...value });
    else target.push(value);
  };
  const makeOperation = (run: () => void) => { const operation: any = { run, where: () => operation, onConflictDoNothing: () => operation, onConflictDoUpdate: () => operation, returning: async () => { run(); return []; }, then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => { run(); }).then(resolve, reject) }; return operation; };
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

describe("final Phase 1 equity candidate consistency", () => {
  test("actual recordSignal rejects the expert LONG-to-SHORT counterexample before persistence", async () => {
    const history = barsForLongToShort(); const last = history.at(-1)!; const initial = draftEvidence("long", last.close, 99.23);
    let suppressed: any = null; let dbOpened = false;
    const ctx = { db: () => { dbOpened = true; throw new Error("persistence must not be reached"); } } as unknown as Ctx;
    const result = await recordSignal(ctx, "FIX", "Synthetic fixture", "TREND", "long", 20, last.date, initial, {
      loadIssuanceEvidence: async () => ({ signalDay: last as any, history: history as any, sourceUrl: initial.sourceUrl, error: null }),
      logSuppressed: async (_ctx, row) => { suppressed = row; },
    });
    expect(result.recorded).toBe(false);
    expect(dbOpened).toBe(false);
    expect(suppressed.direction).toBe("short");
    expect(suppressed.decision.allowed).toBe(false);
    expect(suppressed.invalidation).not.toBe(99.23);
  });

  test("changing the draft stop cannot change the reconstructed final rejection", async () => {
    const history = barsForLongToShort(); const last = history.at(-1)!; const suppressedStops: number[] = [];
    const ctx = { db: () => { throw new Error("persistence must not be reached"); } } as unknown as Ctx;
    for (const draftStop of [99.23, 95.5]) {
      const initial = draftEvidence("long", last.close, draftStop);
      const result = await recordSignal(ctx, "FIX", "Synthetic fixture", "TREND", "long", 20, last.date, initial, { loadIssuanceEvidence: async () => ({ signalDay: last as any, history: history as any, sourceUrl: initial.sourceUrl, error: null }), logSuppressed: async (_ctx, row) => { suppressedStops.push(row.invalidation); } });
      expect(result.recorded).toBe(false);
    }
    expect(suppressedStops[0]).toBe(suppressedStops[1]);
    expect(suppressedStops[0]).not.toBe(99.23);
  });

  test("mirrored SHORT-to-LONG case stores one bundle whose snapshot, gate and levels match", async () => {
    const history = risingBars(); const last = history.at(-1)!; const initial = draftEvidence("short", last.close, last.close + .25); const store = isolatedDb();
    const result = await recordSignal(store.ctx, "MIRROR", "Synthetic mirror", "TREND", "short", 20, last.date, initial, { loadIssuanceEvidence: async () => ({ signalDay: last as any, history: history as any, sourceUrl: initial.sourceUrl, error: null }) });
    expect(result.recorded).toBe(true);
    expect(result.acceptedCandidate?.direction).toBe("long");
    expect(store.signals).toHaveLength(1); expect(store.snapshots).toHaveLength(1); expect(store.events).toHaveLength(1);
    const stored = store.signals[0]; const snapshot = JSON.parse(store.snapshots[0].rawInputsJson); const event = JSON.parse(store.events[0].payloadJson);
    expect(stored.invalidationLevel).toBe(result.acceptedCandidate?.levels.stopPrice);
    expect(snapshot.levels).toEqual(result.acceptedCandidate?.levels);
    expect(snapshot.gateResults).toEqual(result.acceptedCandidate?.gate);
    expect(event.levels).toEqual(result.acceptedCandidate?.levels);
  });

  test("actual production batch rolls back at every write boundary and retry completes exactly one bundle", async () => {
    const history = risingBars(); const last = history.at(-1)!; const initial = draftEvidence("short", last.close, last.close + .25);
    for (const failAt of [0, 1, 2]) {
      const store = isolatedDb({ failAt });
      const dependencies = { loadIssuanceEvidence: async () => ({ signalDay: last as any, history: history as any, sourceUrl: initial.sourceUrl, error: null }) };
      await expect(recordSignal(store.ctx, "ROLL", "Rollback fixture", "TREND", "short", 20, last.date, initial, dependencies)).rejects.toThrow(`injected boundary ${failAt}`);
      expect([store.signals.length, store.snapshots.length, store.events.length]).toEqual([0, 0, 0]);
      const retried = await recordSignal(store.ctx, "ROLL", "Rollback fixture", "TREND", "short", 20, last.date, initial, dependencies);
      expect(retried.recorded).toBe(true);
      expect([store.signals.length, store.snapshots.length, store.events.filter((row) => row.eventType === "issued").length]).toEqual([1, 1, 1]);
    }
  });

  test("interleaved identical and competing requests deterministically return one original bundle", async () => {
    const history = risingBars(); const last = history.at(-1)!; const initial = draftEvidence("short", last.close, last.close + .25); const store = isolatedDb({ interleave: true });
    const changed = history.map((bar, index) => index === 210 ? { ...bar, close: bar.close + .2, high: bar.high + .2 } : bar);
    const first = recordSignal(store.ctx, "RACE", "Race fixture", "TREND", "short", 20, last.date, initial, { loadIssuanceEvidence: async () => ({ signalDay: last as any, history: history as any, sourceUrl: initial.sourceUrl, error: null }) });
    const second = recordSignal(store.ctx, "RACE", "Race fixture", "TREND", "short", 20, last.date, initial, { loadIssuanceEvidence: async () => ({ signalDay: changed.at(-1) as any, history: changed as any, sourceUrl: initial.sourceUrl, error: null }) });
    const [acceptedA, acceptedB] = await Promise.all([first, second]);
    expect(acceptedA.recorded).toBe(true); expect(acceptedB.recorded).toBe(true);
    expect(store.signals).toHaveLength(1); expect(store.snapshots).toHaveLength(1); expect(store.events.filter((row) => row.eventType === "issued")).toHaveLength(1);
    expect(acceptedA.acceptedCandidate?.inputSnapshotId).toBe(acceptedB.acceptedCandidate?.inputSnapshotId);
  });

  test("shared production reconstruction preserves anomaly and freshness gates", () => {
    const history = risingBars(); const last = history.at(-1)!; const stale = history.map((bar) => ({ ...bar, availableAt: "2025-01-01T20:00:00.000Z" }));
    const staleResult = reconstructAndValidateEquityCandidate(stale, availability(last.date), last.date);
    expect(staleResult.status).toBe("partial");
    expect(staleResult.reconstruction.factors.every((factor) => factor.quality === "STALE")).toBe(true);
    const anomaly = history.map((bar, index) => index === 220 ? { ...bar, close: bar.close * 2, high: bar.high * 2, open: bar.open * 2 } : bar);
    const anomalyResult = reconstructAndValidateEquityCandidate(anomaly, availability(last.date), last.date);
    expect(anomalyResult.status).toBe("partial");
    expect(anomalyResult.reconstruction.factors.every((factor) => factor.quality === "ANOMALY")).toBe(true);
  });
});


describe("final Phase 1 daily action and read-model integration", () => {
  test("actual daily action core creates one revision set, and tracker/scorecard select the accepted cohort", async () => {
    const fixture = pipelineFixture(); const store = pipelineDb([fixture.signal]);
    const dependencies = { now: () => new Date("2026-10-09T16:00:00.000Z"), loadFreshHistory: async () => fixture.series, loadCachedHistory: async () => null };
    const first = await computeDailySignalSnapshots(store.ctx, dependencies);
    expect(first.ok).toBe(true); expect(first.settlementUpdatedRows).toBe(2); expect(store.rows.revisions).toHaveLength(2);
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    const scorecard = await Actions.getScorecard.handler(store.ctx, {});
    expect(tracker.signals[0]?.directionEvaluation?.verdict).toBe("HIT");
    expect(tracker.signals[0]?.tradeSetupEvaluation?.verdict).toBe("UNVERIFIED");
    expect(tracker.outcomeCounts.unverified).toBe(1);
    expect(scorecard.trackRecord.excluded.unverified).toBe(1);
    expect(scorecard.trackRecord.gradedClosed).toBe(0);
    const second = await computeDailySignalSnapshots(store.ctx, dependencies);
    expect(second.settlementUpdatedRows).toBe(0); expect(store.rows.revisions).toHaveLength(2);
  });

  test("provider failure with adequate cache resolves only eligible forecast evidence and reports degraded status", async () => {
    const fixture = pipelineFixture(); const store = pipelineDb([fixture.signal]);
    const result = await computeDailySignalSnapshots(store.ctx, { now: () => new Date("2026-10-09T16:00:00.000Z"), loadFreshHistory: async () => { throw new Error("synthetic provider outage"); }, loadCachedHistory: async () => fixture.series });
    expect(result.ok).toBe(false); expect(result.errors.some((error) => error.includes("fresh evidence fetch"))).toBe(true);
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.signals[0]?.directionEvaluation?.verdict).toBe("HIT");
    expect(tracker.signals[0]?.tradeSetupEvaluation?.verdict).toBe("UNVERIFIED");
  });

  test("provider failure with inadequate cache remains unresolved with explicit coverage", async () => {
    const fixture = pipelineFixture(); const store = pipelineDb([fixture.signal]);
    const emptySeries = { ...fixture.series, points: [] };
    const result = await computeDailySignalSnapshots(store.ctx, { now: () => new Date("2026-10-09T16:00:00.000Z"), loadFreshHistory: async () => { throw new Error("synthetic provider outage"); }, loadCachedHistory: async () => emptySeries });
    expect(result.ok).toBe(false); expect(result.settlementPendingRows).toBeGreaterThan(0);
    const tracker = await Actions.getSignalTracker.handler(store.ctx, { limit: 20, cursor: null });
    expect(tracker.signals[0]?.directionEvaluation?.verdict).toBe("UNVERIFIED");
    expect(tracker.outcomeCounts.unverified).toBe(1);
  });
});
