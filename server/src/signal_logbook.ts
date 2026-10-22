import { expectedXnysSessions } from "./measurement";

export type MonitoringSnapshot = {
  capturedDay: string;
  capturedAt: Date;
  currentPrice: number;
  distanceTarget1Pct: number;
  distanceInvalidationPct: number;
};

export type MonitoringSignal = {
  direction: "long" | "short";
  entryPrice: number;
  signalDate: string;
  entryAt: string | null;
  issuedAt: string | null;
  decisionAt: string | null;
  barEnd: string | null;
  invalidationLevel: number | null;
  primaryHorizon: number;
  horizonUnit: string;
};

export type SignalMonitoringClosure = {
  outcome: "HIT" | "MISSED" | "EXPIRED";
  level: "TARGET 1" | "INVALIDATION" | "HORIZON";
  closingMark: number;
  closingAt: string;
  markDay: string;
  realizedReturnPct: number;
  rMultiple: number | null;
  horizonSessions: number;
  horizonEndDay: string | null;
};

function returnAndR(signal: MonitoringSignal, mark: number): { realizedReturnPct: number; rMultiple: number | null } {
  const realizedReturnPct = (signal.direction === "long" ? (mark - signal.entryPrice) / signal.entryPrice : (signal.entryPrice - mark) / signal.entryPrice) * 100;
  const initialRiskPct = signal.invalidationLevel == null ? null : Math.abs(signal.entryPrice - signal.invalidationLevel) / signal.entryPrice * 100;
  return { realizedReturnPct, rMultiple: initialRiskPct != null && initialRiskPct > 0 ? realizedReturnPct / initialRiskPct : null };
}

export function monitoringHorizonEndDay(signal: MonitoringSignal): string | null {
  if (signal.horizonUnit !== "trading_sessions" || !Number.isInteger(signal.primaryHorizon) || signal.primaryHorizon <= 0) return null;
  const base = signal.entryAt ?? signal.issuedAt ?? signal.decisionAt ?? signal.barEnd ?? `${signal.signalDate}T23:59:59.000Z`;
  return expectedXnysSessions(base, signal.primaryHorizon).at(-1) ?? null;
}

export function buildSignalMonitoringClosure(signal: MonitoringSignal, snapshots: MonitoringSnapshot[]): SignalMonitoringClosure | null {
  const horizonEndDay = monitoringHorizonEndDay(signal);
  const ordered = [...snapshots].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  for (const snapshot of ordered) {
    const levelClosure = snapshot.distanceInvalidationPct <= 0
      ? { outcome: "MISSED" as const, level: "INVALIDATION" as const }
      : snapshot.distanceTarget1Pct <= 0
        ? { outcome: "HIT" as const, level: "TARGET 1" as const }
        : null;
    // A persisted mark on the final session still gets the frozen-level check
    // first. Any later mark cannot retroactively turn a time-expired call into
    // a hit or miss.
    const horizonReached = horizonEndDay != null && snapshot.capturedDay >= horizonEndDay;
    const event = levelClosure ?? (horizonReached ? { outcome: "EXPIRED" as const, level: "HORIZON" as const } : null);
    if (!event) continue;
    const performance = returnAndR(signal, snapshot.currentPrice);
    return {
      ...event,
      closingMark: snapshot.currentPrice,
      closingAt: snapshot.capturedAt.toISOString(),
      markDay: snapshot.capturedDay,
      realizedReturnPct: performance.realizedReturnPct,
      rMultiple: performance.rMultiple,
      horizonSessions: signal.primaryHorizon,
      horizonEndDay,
    };
  }
  return null;
}
