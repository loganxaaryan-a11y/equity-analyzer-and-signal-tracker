// Batch 5 Part 6 (equity) — scan on demand: pure lock + proof-stamp helpers.
//
// Reliability/access only. Nothing in this module scores, gates, selects, or
// ranks: it decides whether an equity scan run is still in flight (from its
// own run-state record's heartbeat + deadline) and derives the data-through
// session stamp from dates the scan's inputs actually carried. The scan
// pipeline itself is untouched by these helpers.

// A running scan-state row is "live" only while its driver keeps heartbeating
// (the batched driver heartbeats between bounded steps, and no single action
// invocation may run longer than the platform's 120s budget) and only until
// its overall deadline. A run whose heartbeat has gone stale — or whose
// deadline has passed — is treated as not-in-progress: stale/dead runs can
// never wedge the on-demand trigger, and the next trigger closes them out as
// failed before starting fresh.
export const SCAN_RUN_DEADLINE_MS = 30 * 60 * 1000;
export const SCAN_HEARTBEAT_STALE_MS = 5 * 60 * 1000;

export type ScanRunStateLike = {
  id: number;
  status: string;
  heartbeatAt: Date;
  deadlineAt: Date;
  marketScanRunId: number | null;
  startedAt: Date;
};

export function isScanRunLive(row: ScanRunStateLike, now: Date): boolean {
  return row.status === "running"
    && row.deadlineAt.getTime() > now.getTime()
    && now.getTime() - row.heartbeatAt.getTime() < SCAN_HEARTBEAT_STALE_MS;
}

// True while a timestamp (e.g. an in-flight batch's updatedAt, advanced by
// every bounded step) is fresh enough to belong to a driver that is still
// working. A stale in-flight record never blocks a fresh run.
export function isRecentlyActive(at: Date, now: Date, windowMs: number = SCAN_HEARTBEAT_STALE_MS): boolean {
  return now.getTime() - at.getTime() < windowMs;
}

// The single in-progress lock: the newest live running row, or null. There is
// deliberately NO done-lock — a completed run never blocks the next trigger.
export function pickLiveScanRun<T extends ScanRunStateLike>(rows: T[], now: Date): T | null {
  let live: T | null = null;
  for (const row of rows) {
    if (!isScanRunLive(row, now)) continue;
    if (!live || row.id > live.id) live = row;
  }
  return live;
}

// Extract the YYYY-MM-DD session date from a stored timestamp/bar value.
// Accepts ISO timestamps ("2026-10-19T21:00:00.000Z") and bare dates
// ("2026-10-19"); anything else yields null rather than a guessed date.
export function sessionDateFromValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const date = match[1]!;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible calendar dates the regex alone would pass (e.g. 2026-13-40).
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}

// Data-through session: the latest session date among the values the scan
// actually used (completed bar dates / provider event dates / signal
// source-as-of dates). Derived from the data, never from the wall clock.
export function maxSessionDate(values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const value of values) {
    const date = sessionDateFromValue(value);
    if (date && (!best || date > best)) best = date;
  }
  return best;
}
