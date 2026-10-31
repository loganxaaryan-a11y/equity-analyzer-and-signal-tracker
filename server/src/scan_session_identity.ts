// Expert Q4 (2026-10-25) — scan session identity: three separate times.
//
// A batched scan run carries THREE different facts that the old resume path
// collapsed into one another:
//
//   1. Market-data session (dataThroughSession): the last completed US
//      session the scan's inputs actually reached. Frozen by the data the
//      batch was created for; resuming the batch in a later session must
//      NEVER re-stamp it — the analysis belongs to its original session.
//   2. Analysis time (computedAt): when the scan actually ran / computed
//      its results (finalization). For a resumed run 46 this is the
//      resume-day instant, not the original session's date.
//   3. Completion time (completedAt): when the batch fully finished
//      (finalization + maintenance + brief stages all done). Distinct
//      from the analysis time, which is stamped earlier, at finalization.
//
// This module is pure: cycle-key derivation, the never-re-stamp resume
// rule, the same-session done guard keyed on COMPLETION (not on the
// batch's original cycle key), the three-field proof-stamp builder used
// by getAutoScan, and the completed-session staleness rule (a session is
// stale only when a NEWER completed session exists — never merely
// because it is not today's calendar date).

import { latestCompletedSessionDate } from "./freshness";

export const DISCOVERY_SESSION_SLOTS = ["0930", "1130", "1330", "1530"] as const;

// Cycle key for the batched discovery scan. The four scheduled sessions
// (09:30 / 11:30 / 13:30 / 15:30 America/New_York, Mon–Fri) each own a batch
// cycle: the key names the most recent scheduled session at or before `now`
// (e.g. "2026-10-16-1130"). Before the first slot of a trading day — and on
// weekends — it resolves to the previous trading day's 15:30 session, so a
// completed batch only ever satisfies retries inside its own session.
export function discoveryCycleKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  let year = Number(part("year")); let month = Number(part("month")); let day = Number(part("day"));
  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let weekday = weekdayIndex[part("weekday")] ?? 0;
  const hhmm = `${part("hour")}${part("minute")}`;
  const isWeekday = () => weekday >= 1 && weekday <= 5;
  let slot: string | undefined = isWeekday() ? [...DISCOVERY_SESSION_SLOTS].reverse().find((candidate) => candidate <= hhmm) : undefined;
  while (!slot) {
    const previous = new Date(Date.UTC(year, month - 1, day) - 86_400_000);
    year = previous.getUTCFullYear(); month = previous.getUTCMonth() + 1; day = previous.getUTCDate(); weekday = previous.getUTCDay();
    if (isWeekday()) slot = "1530";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${slot ?? "1530"}`;
}

// The session date a cycle key names ("2026-10-23-1530" → "2026-10-23").
export function cycleKeySessionDate(cycleKey: string | null | undefined): string | null {
  if (!cycleKey) return null;
  const match = cycleKey.match(/^(\d{4}-\d{2}-\d{2})-\d{4}$/);
  return match?.[1] ?? null;
}

// Q4 resume rule: a resumed batch KEEPS its original cycle key. The old
// loader re-stamped the batch with the resuming session's key, which
// relabeled the original session's analysis as current-session work and
// obscured the batch's original data session. The original key is the
// batch's identity and is never overwritten; the session that finishes
// the batch is recorded through its completion time instead.
export function cycleKeyPreservedOnResume(originalCycleKey: string | null): string | null {
  return originalCycleKey;
}

// Same-session done guard, keyed on COMPLETION rather than on the batch's
// original cycle key: a batch satisfies the guard for the session in which
// it COMPLETED (a worker timeout after completion must not fork a fresh
// batch on the same session's retry), and it must NOT satisfy the guard
// for any later session — the next scan starts only when the schedule or
// newer data calls for a new session, never forced by the resume itself.
// Legacy batches completed before completion times were stored fall back
// to their (original) cycle key.
export function batchDoneInCycle(batch: { cycleKey: string | null; completedAt: Date | null }, currentCycleKey: string): boolean {
  if (batch.completedAt) return discoveryCycleKey(batch.completedAt) === currentCycleKey;
  return batch.cycleKey != null && batch.cycleKey === currentCycleKey;
}

export type ScanProofStamps = {
  runId: number;
  // Legacy pair, kept for existing readers.
  computedAt: string | null;
  dataThroughSession: string | null;
  // Q4 three labeled display fields — always present as separate fields:
  marketDataSession: string | null;
  analysisTime: string | null;
  completionTime: string | null;
  status: string;
};

// Build the proof stamps for a scan run from its OWN stored rows only.
// marketDataSession comes from the data the run used; analysisTime is the
// stored computedAt (falling back to the run's latest per-symbol
// completion, then its creation time — all run-owned instants, never the
// read-time wall clock); completionTime is the stored completion instant
// (null while the run has not fully finished).
export function buildScanProofStamps(input: {
  runId: number;
  status: string;
  dataThroughSession: string | null;
  computedAt: Date | null;
  completedAt: Date | null;
  derivedComputedAt: Date | null;
  createdAt: Date;
}): ScanProofStamps {
  const analysisTime = (input.computedAt ?? input.derivedComputedAt ?? input.createdAt).toISOString();
  return {
    runId: input.runId,
    computedAt: analysisTime,
    dataThroughSession: input.dataThroughSession,
    marketDataSession: input.dataThroughSession,
    analysisTime,
    completionTime: input.completedAt ? input.completedAt.toISOString() : null,
    status: input.status,
  };
}

// Q4 staleness rule for a completed-session board: the board's session is
// stale ONLY when a newer completed US session exists that the board does
// not reach. Friday Oct 23 is the latest completed session all weekend, so
// on Sunday Oct 25 an Oct 23 board is current — its date differing from
// today's date is not staleness.
export function isCompletedSessionStale(dataThroughSession: string | null, nowIso: string): boolean {
  if (!dataThroughSession) return true;
  return dataThroughSession < latestCompletedSessionDate(nowIso);
}

// Per-row completed-session staleness: a row's completed candle is stale
// only when its own session lags the board's data-through session. A row
// sitting exactly on the board's session is not stale for that reason,
// whatever today's calendar date is.
export function isCompletedSessionRowStale(candleSessionDate: string | null, dataThroughSession: string | null): boolean {
  return candleSessionDate != null && dataThroughSession != null && candleSessionDate < dataThroughSession;
}

// A scan run is overdue only when it has no success heartbeat, or when a
// newer completed session exists that the run does not cover AND its last
// success is older than the 36h window. Covering the latest completed
// session (e.g. an Oct 23 run read on Sunday Oct 25) is never overdue
// merely for being more than 36h old over a weekend.
export function isScanRunOverdue(input: { lastSuccessAt: Date | null; dataThroughSession: string | null; now: Date }): boolean {
  if (!input.lastSuccessAt) return true;
  if (!isCompletedSessionStale(input.dataThroughSession, input.now.toISOString())) return false;
  return input.now.getTime() - input.lastSuccessAt.getTime() > 36 * 60 * 60 * 1000;
}
