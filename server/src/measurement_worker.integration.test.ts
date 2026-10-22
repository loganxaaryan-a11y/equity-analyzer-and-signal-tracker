import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Ctx } from "@hatch/space-sdk";
import * as schema from "./schema";
import { Actions, measurementCompletionPredicate, persistDailyMeasurementRun, runMeasurementBatch } from "./actions";

function productionStore() {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const name of readdirSync("drizzle").filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    sqlite.exec(readFileSync(join("drizzle", name), "utf8"));
  }
  const db = drizzle(sqlite, { schema });
  const ctx = { db: () => db, invalidateQueries: () => undefined } as unknown as Ctx;
  return { sqlite, db, ctx };
}

function completeSignal(id: number, symbol: string) {
  return {
    id,
    symbol,
    instrumentName: symbol,
    setupType: "fixture",
    direction: "long" as const,
    confidence: 80,
    entryPrice: 100,
    signalDate: "2026-10-01",
    invalidationLevel: 90,
    target1: 115,
    issuedAt: "2026-09-30T20:00:00.000Z",
    entryAt: "2026-10-01T13:30:00.000Z",
    primaryHorizon: 1,
    horizonUnit: "trading_sessions",
    exchangeCalendar: "XNYS",
    strategyId: "fixture",
    strategyVersion: "locked-v1",
    parameterHash: "frozen",
    priceBasis: "adjusted-daily",
    entryRule: "first eligible quote after issuance",
  };
}

const hitSeries = {
  meta: { symbol: "GOOD", currency: "USD", regularMarketPrice: 116 },
  sourceUrl: "https://query1.finance.yahoo.com/v8/finance/chart/GOOD",
  points: [{ date: "2026-10-01", open: 100, high: 116, low: 99, close: 115, volume: 1000 }],
  weekly: [{ date: "2026-10-01", close: 115 }],
  events: [],
};

async function revisionHash(sqlite: Database) {
  const rows = sqlite.query("SELECT signal_id,evaluator_version,product,evidence_identity,verdict,reason_code,evidence_json FROM signal_evaluation_revisions ORDER BY id").all();
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(rows)).digest("hex");
}

function fixedClock(value: Date) { return () => new Date(value); }

describe("production measurement action recovery", () => {
  test("shared completion predicate rejects terminal rows without committed cursor/status metadata", () => {
    expect(measurementCompletionPredicate({ cursor: 0, totalInScope: 50, status: "partial", completedAt: null }, true, 0, 0)).toBe(false);
    expect(measurementCompletionPredicate({ cursor: 49, totalInScope: 50, status: "partial", completedAt: null }, true, 0, 0)).toBe(false);
    expect(measurementCompletionPredicate({ cursor: 50, totalInScope: 50, status: "complete", completedAt: new Date("2026-10-12T16:00:00Z") }, true, 0, 0)).toBe(true);
  });

  test("actual handler records evaluable, provider-failed and excluded members separately", async () => {
    const { sqlite, db, ctx } = productionStore();
    await db.insert(schema.trackedSignals).values([
      completeSignal(1, "GOOD"),
      completeSignal(2, "FAIL"),
      { ...completeSignal(3, "EXCLUDED"), issuedAt: null, entryAt: null },
    ]);
    const result = await runMeasurementBatch(ctx, { batchSize: 3 }, {
      now: fixedClock(new Date("2026-10-12T16:00:00Z")),
      loadHistory: async (_ctx, symbol) => { if (symbol === "FAIL") throw new Error("fixture provider outage"); return { ...hitSeries, symbol }; },
      loadCachedHistory: async () => null,
    });
    expect(result.cursor).toBe(3);
    expect(result.status).toBe("failed");
    expect(result.counts).toMatchObject({ evaluated: 1, failed: 1, excluded: 1, queued: 0 });
    expect(result.items.map((row) => [row.signalId, row.gradingState])).toEqual([[1, "evaluated"], [2, "retry_pending"], [3, "excluded"]]);
    expect(sqlite.query("SELECT COUNT(*) AS n FROM signal_evaluation_revisions").get()).toEqual({ n: 2 });
    sqlite.close();
  });

  test("interruption after accepted revision/item write resumes in a fresh action context without duplicates or rewrites", async () => {
    const { sqlite, db, ctx } = productionStore();
    await db.insert(schema.trackedSignals).values(completeSignal(1, "GOOD"));
    let interrupted = false;
    await expect(runMeasurementBatch(ctx, { batchSize: 1 }, {
      now: fixedClock(new Date("2026-10-12T16:00:00Z")),
      loadHistory: async () => hitSeries,
      afterItemWrite: () => { if (!interrupted) { interrupted = true; throw new Error("INJECTED_AFTER_ITEM_WRITE"); } },
    })).rejects.toThrow("INJECTED_AFTER_ITEM_WRITE");
    expect(sqlite.query("SELECT cursor FROM measurement_runs").get()).toEqual({ cursor: 0 });
    const beforeCount = Number((sqlite.query("SELECT COUNT(*) AS n FROM signal_evaluation_revisions").get() as { n: number }).n);
    const beforeHash = await revisionHash(sqlite);
    const freshCtx = { db: () => db, invalidateQueries: () => undefined } as unknown as Ctx;
    const resumed = await runMeasurementBatch(freshCtx, { runId: (sqlite.query("SELECT id FROM measurement_runs").get() as { id: string }).id, cursor: 0, batchSize: 1 }, { now: fixedClock(new Date("2026-10-12T16:01:00Z")), loadHistory: async () => { throw new Error("terminal catch-up must not refetch"); } });
    expect(resumed.status).toBe("complete");
    expect(resumed.cursor).toBe(1);
    expect(Number((sqlite.query("SELECT COUNT(*) AS n FROM signal_evaluation_revisions").get() as { n: number }).n)).toBe(beforeCount);
    expect(await revisionHash(sqlite)).toBe(beforeHash);
    expect(resumed.batches).toHaveLength(1);
    expect(resumed.batches[0]).toMatchObject({ beforeCursor: 0, afterCursor: 1, duplicateRowsCreated: 0, historyRowsRewritten: 0 });
    sqlite.close();
  });

  test("expired worker is fenced after provider pause; only the reacquired worker commits", async () => {
    const { sqlite, db, ctx } = productionStore();
    await db.insert(schema.trackedSignals).values(completeSignal(1, "GOOD"));
    let now = new Date("2026-10-12T16:00:00Z");
    let enteredProvider: () => void = () => undefined;
    const providerEntered = new Promise<void>((resolve) => { enteredProvider = resolve; });
    let releaseProvider: () => void = () => undefined;
    const providerGate = new Promise<void>((resolve) => { releaseProvider = resolve; });
    const workerA = runMeasurementBatch(ctx, { batchSize: 1 }, {
      now: () => new Date(now),
      loadHistory: async () => { enteredProvider(); await providerGate; return hitSeries; },
    });
    await providerEntered;
    now = new Date("2026-10-12T16:06:00Z");
    const workerB = await runMeasurementBatch({ db: () => db, invalidateQueries: () => undefined } as unknown as Ctx, { runId: (sqlite.query("SELECT id FROM measurement_runs").get() as { id: string }).id, cursor: 0, batchSize: 1 }, { now: () => new Date(now), loadHistory: async () => hitSeries });
    expect(workerB.status).toBe("complete");
    releaseProvider();
    await expect(workerA).rejects.toThrow("LEASE_LOST");
    expect(sqlite.query("SELECT cursor FROM measurement_runs").get()).toEqual({ cursor: 1 });
    expect(sqlite.query("SELECT COUNT(*) AS n FROM signal_evaluation_revisions").get()).toEqual({ n: 2 });
    expect(sqlite.query("SELECT COUNT(*) AS n FROM measurement_run_batches").get()).toEqual({ n: 1 });
    sqlite.close();
  });

  test("cursor commit survives crash before batch-row insertion through durable journal recovery", async () => {
    const { sqlite, db, ctx } = productionStore();
    await db.insert(schema.trackedSignals).values(completeSignal(1, "GOOD"));
    let runId = "";
    await expect(runMeasurementBatch(ctx, { batchSize: 1 }, {
      now: fixedClock(new Date("2026-10-12T16:00:00Z")),
      loadHistory: async () => hitSeries,
      afterCursorCommit: ({ runId: value }) => { runId = value; throw new Error("INJECTED_AFTER_CURSOR_COMMIT"); },
    })).rejects.toThrow("INJECTED_AFTER_CURSOR_COMMIT");
    expect(sqlite.query("SELECT cursor,status FROM measurement_runs WHERE id=?").get(runId)).toEqual({ cursor: 1, status: "complete" });
    expect(sqlite.query("SELECT COUNT(*) AS n FROM measurement_batch_commit_journal WHERE run_id=?").get(runId)).toEqual({ n: 1 });
    expect(sqlite.query("SELECT COUNT(*) AS n FROM measurement_run_batches WHERE run_id=?").get(runId)).toEqual({ n: 0 });
    const recovered = await runMeasurementBatch({ db: () => db, invalidateQueries: () => undefined } as unknown as Ctx, { runId, cursor: 1, batchSize: 1 }, { now: fixedClock(new Date("2026-10-12T16:01:00Z")) });
    expect(recovered.status).toBe("complete");
    expect(recovered.batches).toHaveLength(1);
    expect(recovered.batches[0]?.note).toContain("recovered from the durable cursor-linked journal");
    sqlite.close();
  });

  test("50 terminal items with cursor 0 remain partial until one production-handler cursor commit", async () => {
    const { sqlite, db, ctx } = productionStore();
    const ids = Array.from({ length: 50 }, (_, index) => index + 1);
    const runId = "terminal-before-cursor";
    await db.insert(schema.measurementRuns).values({ id: runId, terminal: "equity", cohortKey: "fixture", evaluatorVersion: "fixture-v1", sourceCommit: "fixture", status: "partial", startedAt: new Date("2026-10-12T15:00:00Z"), completedAt: null, updatedAt: new Date("2026-10-12T15:00:00Z"), cutoffAt: "2026-10-12T15:00:00Z", cursor: 0, totalInScope: 50, membershipJson: JSON.stringify(ids), definitionsJson: "{}" });
    await db.insert(schema.measurementRunItems).values(ids.map((signalId, ordinal) => ({ runId, signalId, ordinal, gradingState: "excluded" as const, reasonCode: "fixture_terminal", reason: "Terminal before cursor commit", updatedAt: new Date("2026-10-12T15:00:00Z") })));
    expect(measurementCompletionPredicate({ cursor: 0, totalInScope: 50, status: "partial", completedAt: null }, true, 0, 0)).toBe(false);
    const result = await runMeasurementBatch(ctx, { runId, cursor: 0, batchSize: 1 }, { now: fixedClock(new Date("2026-10-12T16:00:00Z")), loadHistory: async () => { throw new Error("terminal catch-up must not fetch"); } });
    expect(result.status).toBe("complete");
    expect(result.cursor).toBe(50);
    expect(result.counts.excluded).toBe(50);
    expect(result.batches).toHaveLength(1);
    expect(sqlite.query("SELECT cursor,status,completed_at FROM measurement_runs WHERE id=?").get(runId)).toMatchObject({ cursor: 50, status: "complete" });
    sqlite.close();
  });

  test("daily postmortem persistence drains the frozen cohort and the homepage read path retrieves it", async () => {
    const { sqlite, db, ctx } = productionStore();
    await db.insert(schema.trackedSignals).values(Array.from({ length: 50 }, (_unused, index) => ({ ...completeSignal(index + 1, `LEGACY${index + 1}`), issuedAt: null, entryAt: null })));
    const completed = await persistDailyMeasurementRun(ctx, {
      now: fixedClock(new Date("2026-10-15T05:45:00Z")),
      loadHistory: async () => { throw new Error("excluded contracts must not fetch evidence"); },
    });
    expect(completed.status).toBe("complete");
    expect(completed.cursor).toBe(50);
    expect(completed.counts).toMatchObject({ inScope: 50, excluded: 50, failed: 0, queued: 0 });
    expect(completed.batches).toHaveLength(3);
    const latest = await Actions.getLatestMeasurementRun.handler(ctx, {});
    expect(latest).not.toBeNull();
    expect(latest?.runId).toBe(completed.runId);
    expect(latest?.status).toBe("complete");
    expect(sqlite.query("SELECT COUNT(*) AS n FROM measurement_runs").get()).toEqual({ n: 1 });
    sqlite.close();
  });
});
