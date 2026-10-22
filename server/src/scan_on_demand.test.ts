import { describe, expect, test } from "bun:test";
import { isRecentlyActive, isScanRunLive, maxSessionDate, pickLiveScanRun, sessionDateFromValue, type ScanRunStateLike } from "./scan_on_demand";

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
