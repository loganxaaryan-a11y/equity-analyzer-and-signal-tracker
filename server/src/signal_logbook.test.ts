import { describe, expect, test } from "bun:test";
import { buildSignalMonitoringClosure, monitoringHorizonEndDay, type MonitoringSignal } from "./signal_logbook";

const legacySignal: MonitoringSignal = {
  direction: "long",
  entryPrice: 100,
  signalDate: "2026-10-01",
  entryAt: "2026-10-01T20:00:00.000Z",
  issuedAt: "2026-10-01T20:00:00.000Z",
  decisionAt: "2026-10-01T20:00:00.000Z",
  barEnd: "2026-10-01T20:00:00.000Z",
  invalidationLevel: 90,
  primaryHorizon: 3,
  horizonUnit: "trading_sessions",
};

const snapshot = (capturedDay: string, currentPrice: number, distances = { target: 10, invalidation: 10 }) => ({
  capturedDay,
  capturedAt: new Date(`${capturedDay}T20:05:00.000Z`),
  currentPrice,
  distanceTarget1Pct: distances.target,
  distanceInvalidationPct: distances.invalidation,
});

describe("signal logbook monitor", () => {
  test("moves a level-open legacy signal to EXPIRED on its own stored trading-session horizon", () => {
    const frozenBefore = structuredClone(legacySignal);
    expect(monitoringHorizonEndDay(legacySignal)).toBe("2026-10-06");
    expect(buildSignalMonitoringClosure(legacySignal, [
      snapshot("2026-10-02", 101),
      snapshot("2026-10-05", 102),
      snapshot("2026-10-06", 103),
    ])).toEqual({
      outcome: "EXPIRED",
      level: "HORIZON",
      closingMark: 103,
      closingAt: "2026-10-06T20:05:00.000Z",
      markDay: "2026-10-06",
      realizedReturnPct: 3,
      rMultiple: 0.3,
      horizonSessions: 3,
      horizonEndDay: "2026-10-06",
    });
    expect(legacySignal).toEqual(frozenBefore);
  });

  test("keeps a frozen-level crossing ahead of horizon expiry", () => {
    const closure = buildSignalMonitoringClosure(legacySignal, [
      snapshot("2026-10-02", 101),
      snapshot("2026-10-05", 115, { target: 0, invalidation: 20 }),
      snapshot("2026-10-06", 116),
    ]);
    expect(closure?.outcome).toBe("HIT");
    expect(closure?.level).toBe("TARGET 1");
    expect(closure?.markDay).toBe("2026-10-05");
  });
});
