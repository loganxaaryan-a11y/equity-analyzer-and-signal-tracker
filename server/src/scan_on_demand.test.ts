import { describe, expect, test } from "bun:test";
import { isRecentlyActive, isScanBatchInFlight, isScanRunLive, maxSessionDate, pickLiveScanRun, pickScanBatchToResume, resolveNamedScanBatch, sessionDateFromValue, type ScanRunStateLike } from "./scan_on_demand";

const now = new Date("2026-10-20T12:00:00.000Z");
function row(partial: Partial<ScanRunStateLike> & { id: number }): ScanRunStateLike {
  return {
    status: "running",
    heartbeatAt: new Date(now.getTime() - 60 * 1000),
    deadlineAt: new Date(now.getTime() + 10 * 60 * 1000),
    marketScanRunId: null,
    startedAt: new Date(now.getTime() - 5 * 60 * 1000),
    ...partial,
  };
}

describe("scan on-demand in-progress lock", () => {
  test("a running row with a future deadline is live", () => {
    expect(isScanRunLive(row({ id: 1 }), now)).toBe(true);
  });

  test("a running row whose deadline has passed is NOT in progress (stale run never wedges the trigger)", () => {
    expect(isScanRunLive(row({ id: 2, deadlineAt: new Date(now.getTime() - 1) }), now)).toBe(false);
  });

  test("a running row whose heartbeat stopped is NOT in progress (killed driver never wedges the trigger)", () => {
    expect(isScanRunLive(row({ id: 5, heartbeatAt: new Date(now.getTime() - 6 * 60 * 1000) }), now)).toBe(false);
  });

  test("a completed row is never live — there is no done-lock", () => {
    expect(isScanRunLive(row({ id: 3, status: "ok" }), now)).toBe(false);
    expect(isScanRunLive(row({ id: 4, status: "failed" }), now)).toBe(false);
  });

  test("an in-flight batch record is live only while its steps keep advancing it", () => {
    expect(isRecentlyActive(new Date(now.getTime() - 60 * 1000), now)).toBe(true);
    expect(isRecentlyActive(new Date(now.getTime() - 6 * 60 * 1000), now)).toBe(false);
  });

  test("pickLiveScanRun returns the newest live row and ignores stale/completed rows", () => {
    const rows = [
      row({ id: 1 }),
      row({ id: 2, deadlineAt: new Date(now.getTime() - 60_000) }),
      row({ id: 3, status: "partial" }),
      row({ id: 4 }),
    ];
    expect(pickLiveScanRun(rows, now)?.id).toBe(4);
    expect(pickLiveScanRun([rows[1]!, rows[2]!], now)).toBeNull();
    expect(pickLiveScanRun([], now)).toBeNull();
  });
});

describe("batched-scan resume selection (newest-first, cross-cycle)", () => {
  // The run-46 case: batch 27 finished Friday's 15:30 session; batch 28
  // (run 46) was created later under the same stored cycle key and its
  // driver was killed at 20/101. The next session's key differs — resume
  // must still pick batch 28, never fork a new batch over it.
  const friday = [
    { id: 27, stage: "done", cycleKey: "2026-10-23-1530" },
    { id: 28, stage: "open", cycleKey: "2026-10-23-1530" },
  ];

  test("an unfinished newest batch is resumed regardless of its stored cycle key", () => {
    expect(pickScanBatchToResume(friday)?.id).toBe(28);
    expect(pickScanBatchToResume([{ id: 28, stage: "finalizing", cycleKey: "2026-10-23-1530" }])?.id).toBe(28);
    expect(pickScanBatchToResume([{ id: 28, stage: "maintenance", cycleKey: null }])?.id).toBe(28);
    expect(pickScanBatchToResume([{ id: 28, stage: "brief", cycleKey: "2026-10-26-0930" }])?.id).toBe(28);
  });

  test("a completed newest batch is not resumed (no done-lock at this layer)", () => {
    expect(pickScanBatchToResume([{ id: 27, stage: "done", cycleKey: "2026-10-23-1530" }])).toBeNull();
    expect(pickScanBatchToResume([])).toBeNull();
  });

  test("an older unfinished batch superseded by a newer batch is never resumed", () => {
    const batches = [
      { id: 19, stage: "open", cycleKey: "2026-10-21-1530" },
      { id: 28, stage: "done", cycleKey: "2026-10-23-1530" },
    ];
    expect(pickScanBatchToResume(batches)).toBeNull();
  });

  test("the deployed schedule's explicit batchRunId is honored only for the newest batch", () => {
    expect(pickScanBatchToResume(friday, 28)?.id).toBe(28);
    // A done newest batch named explicitly is returned so the caller can
    // report done instead of forking a duplicate.
    expect(pickScanBatchToResume([{ id: 27, stage: "done", cycleKey: "2026-10-23-1530" }], 27)?.id).toBe(27);
    // A superseded id from a stale run log never resurrects an older batch.
    expect(pickScanBatchToResume(friday, 27)).toBeNull();
    expect(pickScanBatchToResume(friday, 999)).toBeNull();
  });

  test("in-flight stages are exactly the pipeline's working stages", () => {
    for (const stage of ["open", "finalizing", "maintenance", "brief"]) expect(isScanBatchInFlight(stage)).toBe(true);
    expect(isScanBatchInFlight("done")).toBe(false);
  });
});

describe("named-batch patch (2026-10-26): explicit requests fail explicitly", () => {
  // Batch 28 owns scan run 46. Run ids and batch ids are distinct.
  const batches = [
    { id: 27, stage: "done", runId: 44 },
    { id: 28, stage: "done", runId: 46 },
  ];

  test("an explicit request for the newest batch matches that batch exactly", () => {
    const resolved = resolveNamedScanBatch(batches, 28);
    expect(resolved.status).toBe("matched");
    if (resolved.status === "matched") {
      expect(resolved.batch.id).toBe(28);
      expect(resolved.batch.runId).toBe(46);
    }
  });

  test("passing scan RUN id 46 as batchRunId is a run-id mismatch naming scan-batch 28 — never a silent substitution", () => {
    const resolved = resolveNamedScanBatch(batches, 46);
    expect(resolved.status).toBe("mismatch");
    if (resolved.status === "mismatch") {
      expect(resolved.reason).toBe("run_id_not_batch_id");
      expect(resolved.correctBatchIdForRunId).toBe(28);
      expect(resolved.runIdForRequested).toBe(46);
      expect(resolved.message).toContain("46 is a scan RUN id");
      expect(resolved.message).toContain("scan batch 28");
    }
  });

  test("a superseded batch id is an explicit superseded mismatch, not another completed batch", () => {
    const resolved = resolveNamedScanBatch(batches, 27);
    expect(resolved.status).toBe("mismatch");
    if (resolved.status === "mismatch") {
      expect(resolved.reason).toBe("superseded");
      expect(resolved.newestBatchId).toBe(28);
    }
  });

  test("a missing batch id fails explicitly instead of turning into automatic selection", () => {
    const resolved = resolveNamedScanBatch(batches, 999);
    expect(resolved.status).toBe("mismatch");
    if (resolved.status === "mismatch") {
      expect(resolved.reason).toBe("not_found");
      expect(resolved.message).toContain("never turned into automatic selection");
      expect(resolved.message).toContain("no new scan was created");
    }
    expect(resolveNamedScanBatch([], 28).status).toBe("mismatch");
  });
});

describe("proof-stamp data-through derivation", () => {
  test("session dates come from the values the scan used, max wins", () => {
    expect(maxSessionDate(["2026-10-16T21:00:00.000Z", "2026-10-19", null, "2026-10-15T00:00:00.000Z"])).toBe("2026-10-19");
  });

  test("no usable input dates yields null, never a wall-clock guess", () => {
    expect(maxSessionDate([null, undefined, "", "not-a-date"])).toBeNull();
    expect(sessionDateFromValue("2026-13-40T00:00:00.000Z")).toBeNull();
    expect(sessionDateFromValue("2026-10-19T21:00:00.000Z")).toBe("2026-10-19");
  });
});
