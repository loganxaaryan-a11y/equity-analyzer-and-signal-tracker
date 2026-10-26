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

// Batched-scan resume selection (scan/resume repair). The deployed schedule's
// rule is resume-newest-first: while the newest batch for a universe is
// unfinished it MUST be resumed — across session cycle keys — and a new batch
// must never be forked over it; an older batch superseded by a newer one is
// never resurrected. The previous loader resumed only a batch whose stored
// cycle key equalled the current session's key, so a batch whose driver died
// in an earlier session (e.g. run 46, wedged at 20/101) was orphaned at the
// next session boundary and every later cycle forked fresh work instead of
// finishing it. Cycle keys now only feed the same-session done guard; they
// never gate resume.
export const SCAN_BATCH_IN_FLIGHT_STAGES: readonly string[] = ["open", "finalizing", "maintenance", "brief"];

export function isScanBatchInFlight(stage: string): boolean {
  return SCAN_BATCH_IN_FLIGHT_STAGES.includes(stage);
}

export type ScanBatchLike = { id: number; stage: string; runId?: number };

// Pick the batch a scan invocation must drive, or null when no batch may be
// resumed (the caller then applies its same-session done guard / creates a
// fresh batch). `batches` is every recent batch for one universe, any stage.
// An explicit `namedBatchId` (the deployed schedule's resume protocol) is
// honored only when it names the newest batch overall — in flight or done —
// so a stale run-log id can never resurrect a superseded batch.
export function pickScanBatchToResume<T extends ScanBatchLike>(batches: T[], namedBatchId?: number | null): T | null {
  if (!batches.length) return null;
  const newest = batches.reduce((best, row) => (row.id > best.id ? row : best));
  if (namedBatchId != null) {
    const named = batches.find((row) => row.id === namedBatchId);
    return named && named.id === newest.id ? named : null;
  }
  return isScanBatchInFlight(newest.stage) ? newest : null;
}

// Named-batch patch (2026-10-26) — explicit batch requests fail explicitly.
//
// A scan RUN id and a scan BATCH id are different identifiers for different
// rows: batch 28 is the scan_batch_runs row whose runId (market_scan_runs
// id) is 46. A caller that passes 46 as `batchRunId` is passing a run id,
// not a batch id. The old loader turned every non-newest named id into a
// silent null and then either returned a different completed batch (the
// same-session done guard) or created a brand-new batch — so an explicit
// request could quietly report, or create, work the caller never asked
// for. `resolveNamedScanBatch` makes that impossible: a named request
// resolves to exactly the named batch, or to a typed mismatch the caller
// must surface. It never substitutes another batch and never creates one.
export type NamedBatchResolution<T extends ScanBatchLike> =
  | { status: "matched"; batch: T }
  | {
      status: "mismatch";
      requestedBatchId: number;
      reason: "not_found" | "superseded" | "run_id_not_batch_id";
      message: string;
      newestBatchId: number | null;
      // When the requested value is a scan run id, the batch that run
      // actually owns — named so the caller can correct its own log to the
      // scan-batch id (run 46 → scan-batch 28) instead of guessing.
      correctBatchIdForRunId: number | null;
      runIdForRequested: number | null;
    };

export function resolveNamedScanBatch<T extends ScanBatchLike>(batches: T[], namedBatchId: number): NamedBatchResolution<T> {
  const newest = batches.length ? batches.reduce((best, row) => (row.id > best.id ? row : best)) : null;
  const named = batches.find((row) => row.id === namedBatchId);
  if (named && newest && named.id === newest.id) return { status: "matched", batch: named };
  if (named) {
    return {
      status: "mismatch",
      requestedBatchId: namedBatchId,
      reason: "superseded",
      message: `NAMED_BATCH_MISMATCH: requested scan batch ${namedBatchId} exists but is superseded by newer scan batch ${newest?.id ?? "unknown"}; a superseded batch is never resumed or substituted. No other batch was returned and no new scan was created. Correct the caller to the newest scan-batch id or start a new batch with no batchRunId.`,
      newestBatchId: newest?.id ?? null,
      correctBatchIdForRunId: null,
      runIdForRequested: named.runId ?? null,
    };
  }
  // Run-id confusion: the requested value names a scan run, not a batch.
  const byRunId = batches.find((row) => row.runId != null && row.runId === namedBatchId);
  if (byRunId) {
    return {
      status: "mismatch",
      requestedBatchId: namedBatchId,
      reason: "run_id_not_batch_id",
      message: `NAMED_BATCH_MISMATCH: requested batchRunId ${namedBatchId} is a scan RUN id, not a scan-batch id. Scan run ${namedBatchId} owns scan batch ${byRunId.id}; pass batchRunId ${byRunId.id} to resume/report that batch. Run ids and batch ids are distinct and are never substituted silently. No other batch was returned and no new scan was created.`,
      newestBatchId: newest?.id ?? null,
      correctBatchIdForRunId: byRunId.id,
      runIdForRequested: namedBatchId,
    };
  }
  return {
    status: "mismatch",
    requestedBatchId: namedBatchId,
    reason: "not_found",
    message: `NAMED_BATCH_MISMATCH: requested scan batch ${namedBatchId} was not found among the known scan batches for this universe (newest known scan batch: ${newest?.id ?? "none"}). A missing named batch is never turned into automatic selection of another batch. No other batch was returned and no new scan was created.`,
    newestBatchId: newest?.id ?? null,
    correctBatchIdForRunId: null,
    runIdForRequested: null,
  };
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
