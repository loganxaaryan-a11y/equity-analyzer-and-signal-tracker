import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { Ctx } from "@hatch/space-sdk";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { eq } from "drizzle-orm";
import { buildFreshnessDashboard, runMarketDataRefresh, type MarketRefreshDependencies } from "./actions";
import * as schema from "./schema";

const opened: Database[] = [];

function isolatedDatabase() {
  const client = new Database(":memory:");
  opened.push(client);
  const db = drizzle(client, { schema });
  migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  let invalidations = 0;
  const ctx = { db: () => db, invalidateQueries: () => { invalidations += 1; } } as unknown as Ctx;
  return { client, db, ctx, invalidations: () => invalidations };
}

afterEach(() => {
  while (opened.length) opened.pop()?.close();
});

type FixtureOverrides = { eventAt?: string; price?: number; priorClose?: number; latestClose?: number };
function providerFixture(overrides: FixtureOverrides = {}) {
  const eventAt = overrides.eventAt ?? "2026-10-12T14:00:00.000Z";
  const price = overrides.price ?? 110;
  const priorClose = overrides.priorClose ?? 104;
  const latestClose = overrides.latestClose ?? price;
  return {
    meta: {
      regularMarketPrice: price,
      regularMarketTime: Math.floor(Date.parse(eventAt) / 1000),
      currency: "USD",
      exchangeName: "Yahoo Finance synthetic fixture",
      fullExchangeName: "Yahoo Finance synthetic fixture",
    },
    points: [
      { date: "2026-10-11", open: 102, high: 106, low: 101, close: priorClose, volume: 1_000 },
      { date: "2026-10-12", open: 105, high: 112, low: 104, close: latestClose, volume: 2_000 },
    ],
    weekly: [],
    events: [],
    sourceUrl: "https://example.test/synthetic-market-provider",
  };
}

function deterministicDependencies(input: {
  times: string[];
  responses: Array<ReturnType<typeof providerFixture> | Error | (() => Promise<ReturnType<typeof providerFixture>>) >;
  onRetry?: () => void;
}): MarketRefreshDependencies {
  let clockIndex = 0;
  let responseIndex = 0;
  return {
    now: () => new Date(input.times[Math.min(clockIndex++, input.times.length - 1)] ?? "2026-10-12T14:00:00.000Z"),
    retryDelay: async () => { input.onRetry?.(); },
    fetchSeries: (async () => {
      const next = input.responses[responseIndex++];
      if (next instanceof Error) throw next;
      if (typeof next === "function") return next();
      if (!next) throw new Error("synthetic provider fixture exhausted");
      return next;
    }) as MarketRefreshDependencies["fetchSeries"],
  };
}

async function insertSignal(store: ReturnType<typeof isolatedDatabase>, input: { symbol?: string; issuedAt: string; entryAt?: string; target1?: number; invalidationLevel?: number }) {
  const rows = await store.db.insert(schema.trackedSignals).values({
    symbol: input.symbol ?? "FIX-USD",
    instrumentName: "Synthetic immutable decision",
    setupType: "Synthetic integration fixture",
    direction: "long",
    confidence: 42,
    entryPrice: 100,
    signalDate: "2026-10-12",
    invalidationLevel: input.invalidationLevel ?? 90,
    target1: input.target1 ?? 105,
    target2: 120,
    issuedAt: input.issuedAt,
    entryAt: input.entryAt ?? input.issuedAt,
    validationStatus: "collecting",
    exchangeCalendar: "XNYS",
    venue: "Yahoo Finance",
    priceBasis: "Yahoo adjusted OHLC research reference",
    sourceAsOf: "2026-10-12T13:00:00.000Z",
    barTimestamp: "2026-10-12T13:00:00.000Z",
  }).returning();
  const row = rows[0];
  if (!row) throw new Error("signal fixture insert failed");
  return row;
}

function rawDecisionBytes(client: Database, id: number): string {
  const row = client.query("SELECT * FROM tracked_signals WHERE id = ?").get(id);
  return JSON.stringify(row);
}

describe("deterministic market refresh action / worker / read-model integration", () => {
  test("success advances observation stream pointers and exposes independent provider, receipt, and success clocks", async () => {
    const store = isolatedDatabase();
    const first = deterministicDependencies({
      times: ["2026-10-12T14:01:00.000Z", "2026-10-12T14:02:00.000Z", "2026-10-12T14:03:00.000Z", "2026-10-12T14:04:00.000Z"],
      responses: [providerFixture()],
    });
    const firstRun = await runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "diagnostic" }, first);
    expect(firstRun.status).toBe("ok");
    const firstState = await store.db.select().from(schema.marketRefreshState).where(eq(schema.marketRefreshState.symbol, "FIX-USD"));
    const firstQuote = firstState.find((row) => row.observationKind === "quote");
    expect(firstQuote?.latestObservationId).toBeNumber();

    const second = deterministicDependencies({
      times: ["2026-10-12T14:05:00.000Z", "2026-10-12T14:06:00.000Z", "2026-10-12T14:07:00.000Z", "2026-10-12T14:08:00.000Z"],
      responses: [providerFixture({ price: 111, latestClose: 111 })],
    });
    const secondRun = await runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "diagnostic" }, second);
    expect(secondRun.symbols[0]?.observationsWritten).toBeGreaterThan(0);
    const secondState = await store.db.select().from(schema.marketRefreshState).where(eq(schema.marketRefreshState.symbol, "FIX-USD"));
    const secondQuote = secondState.find((row) => row.observationKind === "quote");
    expect(secondQuote?.latestObservationId).toBeGreaterThan(firstQuote?.latestObservationId ?? 0);

    const read = await buildFreshnessDashboard(store.ctx, "FIX-USD", new Date("2026-10-12T14:10:00.000Z"));
    const quote = read.symbols[0]?.inputs.find((row) => row.kind === "quote");
    expect(quote?.eventAt).toBe("2026-10-12T14:00:00.000Z");
    expect(quote?.receivedAt).toBe("2026-10-12T14:07:00.000Z");
    expect(quote?.lastSuccessAt).toBe("2026-10-12T14:07:00.000Z");
    expect(quote?.providerAgeSeconds).toBe(600);
    expect(quote?.fetchAgeSeconds).toBe(180);
    expect(store.invalidations()).toBe(2);
  });

  test("unchanged response reuses observations while recording successful refresh health", async () => {
    const store = isolatedDatabase();
    const fixture = providerFixture({ eventAt: "2026-10-12T13:00:00.000Z" });
    await runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "diagnostic" }, deterministicDependencies({ times: ["2026-10-12T13:01:00.000Z", "2026-10-12T13:02:00.000Z", "2026-10-12T13:03:00.000Z"], responses: [fixture] }));
    const before = (await store.db.select().from(schema.marketRefreshState).where(eq(schema.marketRefreshState.symbol, "FIX-USD"))).find((row) => row.observationKind === "quote");
    const result = await runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "scheduled" }, deterministicDependencies({ times: ["2026-10-12T13:30:00.000Z", "2026-10-12T13:31:00.000Z", "2026-10-12T13:32:00.000Z"], responses: [fixture] }));
    expect(result.symbols[0]?.observationsWritten).toBe(0);
    expect(result.symbols[0]?.observationsReused).toBe(3);
    const after = (await store.db.select().from(schema.marketRefreshState).where(eq(schema.marketRefreshState.symbol, "FIX-USD"))).find((row) => row.observationKind === "quote");
    expect(after?.latestObservationId).toBe(before?.latestObservationId);
    expect(after?.lastAttemptAt.toISOString()).toBe("2026-10-12T13:32:00.000Z");
    expect(after?.lastSuccessAt?.toISOString()).toBe("2026-10-12T13:32:00.000Z");
    const read = await buildFreshnessDashboard(store.ctx, "FIX-USD", new Date("2026-10-12T13:35:00.000Z"));
    const quote = read.symbols[0]?.inputs.find((row) => row.kind === "quote");
    expect(quote?.eventAt).toBe("2026-10-12T13:00:00.000Z");
    expect(quote?.receivedAt).toBe("2026-10-12T13:03:00.000Z");
    expect(quote?.lastSuccessAt).toBe("2026-10-12T13:32:00.000Z");
  });

  test("provider outage preserves the stream pointer and last success while advancing attempt health", async () => {
    const store = isolatedDatabase();
    await runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "diagnostic" }, deterministicDependencies({ times: ["2026-10-12T14:00:00.000Z", "2026-10-12T14:01:00.000Z", "2026-10-12T14:02:00.000Z"], responses: [providerFixture()] }));
    const before = (await store.db.select().from(schema.marketRefreshState).where(eq(schema.marketRefreshState.symbol, "FIX-USD"))).find((row) => row.observationKind === "quote");
    const outage = await runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "scheduled" }, deterministicDependencies({ times: ["2026-10-12T14:15:00.000Z", "2026-10-12T14:16:00.000Z", "2026-10-12T14:17:00.000Z"], responses: [new Error("synthetic provider outage")] }));
    expect(outage.status).toBe("failed");
    expect(outage.symbols[0]?.error).toBe("synthetic provider outage");
    const after = (await store.db.select().from(schema.marketRefreshState).where(eq(schema.marketRefreshState.symbol, "FIX-USD"))).find((row) => row.observationKind === "quote");
    expect(after?.latestObservationId).toBe(before?.latestObservationId);
    expect(after?.lastSuccessAt?.toISOString()).toBe(before?.lastSuccessAt?.toISOString());
    expect(after?.lastAttemptAt.toISOString()).toBe("2026-10-12T14:16:00.000Z");
    expect(after?.status).toBe("error");
  });

  test("429 retries exactly once through the injected delay and recovers into persisted state", async () => {
    const store = isolatedDatabase();
    let retries = 0;
    const result = await runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "diagnostic" }, deterministicDependencies({
      times: ["2026-10-12T14:00:00.000Z", "2026-10-12T14:01:00.000Z", "2026-10-12T14:02:00.000Z"],
      responses: [new Error("429 synthetic rate limit"), providerFixture()],
      onRetry: () => { retries += 1; },
    }));
    expect(retries).toBe(1);
    expect(result.status).toBe("ok");
    expect(result.symbols[0]?.observationsWritten).toBe(3);
    const rows = await store.db.select().from(schema.marketObservations);
    expect(rows).toHaveLength(3);
  });

  test("concurrent same-symbol action triggers share one provider worker without duplicating observations", async () => {
    const store = isolatedDatabase();
    let providerCalls = 0;
    let release: () => void = () => {};
    let markEntered: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { markEntered = resolve; });
    const response = async () => { providerCalls += 1; markEntered(); await gate; return providerFixture(); };
    const dependencies = deterministicDependencies({
      times: ["2026-10-12T14:00:00.000Z", "2026-10-12T14:00:01.000Z", "2026-10-12T14:01:00.000Z", "2026-10-12T14:01:01.000Z", "2026-10-12T14:02:00.000Z", "2026-10-12T14:02:01.000Z"],
      responses: [response],
    });
    const first = runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "manual" }, dependencies);
    const second = runMarketDataRefresh(store.ctx, { symbols: ["FIX-USD"], trigger: "scheduled" }, dependencies);
    await entered;
    expect(providerCalls).toBe(1);
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a.runId).not.toBe(b.runId);
    expect(providerCalls).toBe(1);
    expect(await store.db.select().from(schema.marketObservations)).toHaveLength(3);
    const runs = await store.db.select().from(schema.marketRefreshRuns);
    expect(runs).toHaveLength(2);
    expect(runs.every((row) => row.status === "ok")).toBe(true);
  });

  test("stale and pre-issuance quotes append no barrier events and issued decision bytes remain immutable", async () => {
    const store = isolatedDatabase();
    const staleSignal = await insertSignal(store, { symbol: "STALE-USD", issuedAt: "2026-10-12T12:00:00.000Z" });
    const futureSignal = await insertSignal(store, { symbol: "FUTURE-USD", issuedAt: "2026-10-12T15:00:00.000Z" });
    const staleBefore = rawDecisionBytes(store.client, staleSignal.id);
    const futureBefore = rawDecisionBytes(store.client, futureSignal.id);

    const stale = await runMarketDataRefresh(store.ctx, { symbols: ["STALE-USD"], trigger: "diagnostic" }, deterministicDependencies({
      times: ["2026-10-12T14:00:00.000Z", "2026-10-12T14:01:00.000Z", "2026-10-12T14:02:00.000Z"],
      responses: [providerFixture({ eventAt: "2026-10-12T10:00:00.000Z", price: 120, latestClose: 120 })],
    }));
    const preIssuance = await runMarketDataRefresh(store.ctx, { symbols: ["FUTURE-USD"], trigger: "diagnostic" }, deterministicDependencies({
      times: ["2026-10-12T14:03:00.000Z", "2026-10-12T14:04:00.000Z", "2026-10-12T14:05:00.000Z"],
      responses: [providerFixture({ eventAt: "2026-10-12T14:00:00.000Z", price: 120, latestClose: 120 })],
    }));
    expect(stale.symbols[0]?.status).toBe("stale");
    expect(stale.symbols[0]?.statusEventsAppended).toBe(0);
    expect(preIssuance.symbols[0]?.statusEventsAppended).toBe(0);
    expect(await store.db.select().from(schema.signalStatusEvents)).toHaveLength(0);
    expect(rawDecisionBytes(store.client, staleSignal.id)).toBe(staleBefore);
    expect(rawDecisionBytes(store.client, futureSignal.id)).toBe(futureBefore);
  });
});
