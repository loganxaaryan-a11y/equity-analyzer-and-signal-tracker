import { describe, expect, test } from "bun:test";
import { batchDoneInCycle, buildScanProofStamps, cycleKeyPreservedOnResume, cycleKeySessionDate, discoveryCycleKey, isCompletedSessionRowStale, isCompletedSessionStale, isScanRunOverdue } from "./scan_session_identity";
import { pickScanBatchToResume } from "./scan_on_demand";
import { PAPER_ISSUANCE_COHORT_CAP } from "./actions";

// Expert Q4 (2026-10-25) — run 46 session identity. Calendar anchors:
// Friday 2026-10-23 is a trading day; Saturday 2026-10-24 and Sunday
// 2026-10-25 are not, so Oct 23 remains the latest completed US session
// all weekend. Monday 2026-10-26 is the next session. Run 46's batch was
// created under Friday's 15:30 cycle key and wedged unfinished; it is
// resumed and finished on Sunday Oct 25 in this demonstration.

const FRIDAY_CYCLE = "2026-10-23-1530";
const MONDAY_CYCLE = "2026-10-26-0930";

describe("Q4 cycle key and original session identity", () => {
  test("discoveryCycleKey names Friday's 15:30 session on Friday and all weekend, then Monday's session", () => {
    expect(discoveryCycleKey(new Date("2026-10-23T19:30:00.000Z"))).toBe(FRIDAY_CYCLE); // Fri 15:30 EDT
    expect(discoveryCycleKey(new Date("2026-10-25T21:12:00.000Z"))).toBe(FRIDAY_CYCLE); // Sun 17:12 EDT
    expect(discoveryCycleKey(new Date("2026-10-26T13:35:00.000Z"))).toBe(MONDAY_CYCLE); // Mon 09:35 EDT
    expect(cycleKeySessionDate(FRIDAY_CYCLE)).toBe("2026-10-23");
    expect(cycleKeySessionDate(null)).toBeNull();
  });

  test("a resumed batch keeps its original cycle key — the resume never re-stamps it", () => {
    const batch = { id: 28, stage: "open", cycleKey: FRIDAY_CYCLE };
    // Resumed on Monday, when the current session's key is MONDAY_CYCLE:
    // the batch's identity remains Friday's key and Friday's session.
    expect(cycleKeyPreservedOnResume(batch.cycleKey)).toBe(FRIDAY_CYCLE);
    expect(cycleKeyPreservedOnResume(batch.cycleKey)).not.toBe(MONDAY_CYCLE);
    expect(cycleKeyPreservedOnResume(null)).toBeNull();
  });

  test("the done guard keys on the completion session, not the batch's original cycle", () => {
    // Created Friday, completed Sunday afternoon EDT — Sunday resolves to
    // Friday's cycle, so the batch satisfies Friday-cycle retries only.
    const finishedSunday = { cycleKey: FRIDAY_CYCLE, completedAt: new Date("2026-10-25T21:09:00.000Z") };
    expect(batchDoneInCycle(finishedSunday, FRIDAY_CYCLE)).toBe(true);
    expect(batchDoneInCycle(finishedSunday, MONDAY_CYCLE)).toBe(false);
    // Legacy row without a stored completion time falls back to its
    // original cycle key.
    const legacy = { cycleKey: FRIDAY_CYCLE, completedAt: null };
    expect(batchDoneInCycle(legacy, FRIDAY_CYCLE)).toBe(true);
    expect(batchDoneInCycle(legacy, MONDAY_CYCLE)).toBe(false);
  });
});

describe("Q4 three separate times (getAutoScan proof stamps)", () => {
  test("resumed run 46 keeps its Oct 23 market-data session while analysis and completion record the actual Sunday finishing times", () => {
    const stamps = buildScanProofStamps({
      runId: 46,
      status: "ok",
      dataThroughSession: "2026-10-23",
      computedAt: new Date("2026-10-25T21:05:00.000Z"),
      completedAt: new Date("2026-10-25T21:09:00.000Z"),
      derivedComputedAt: null,
      createdAt: new Date("2026-10-23T19:35:00.000Z"),
    });
    // All three labeled fields are present in the response shape…
    expect(stamps.marketDataSession).toBe("2026-10-23");
    expect(stamps.analysisTime).toBe("2026-10-25T21:05:00.000Z");
    expect(stamps.completionTime).toBe("2026-10-25T21:09:00.000Z");
    // …and distinct from one another: the analysis is never relabeled as
    // current-session data, and completion is not the analysis time.
    expect(new Set([stamps.marketDataSession, stamps.analysisTime, stamps.completionTime]).size).toBe(3);
    // Legacy fields mirror the same stored values.
    expect(stamps.dataThroughSession).toBe(stamps.marketDataSession);
    expect(stamps.computedAt).toBe(stamps.analysisTime);
  });

  test("an unfinished run has an analysis time but no completion time", () => {
    const stamps = buildScanProofStamps({
      runId: 46,
      status: "partial",
      dataThroughSession: "2026-10-23",
      computedAt: null,
      completedAt: null,
      derivedComputedAt: new Date("2026-10-25T21:05:00.000Z"),
      createdAt: new Date("2026-10-23T19:35:00.000Z"),
    });
    expect(stamps.marketDataSession).toBe("2026-10-23");
    expect(stamps.analysisTime).toBe("2026-10-25T21:05:00.000Z");
    expect(stamps.completionTime).toBeNull();
  });
});

describe("Q4 completed-session staleness", () => {
  test("an Oct 23 board on Sunday Oct 25 is NOT stale — Oct 23 is still the latest completed session", () => {
    expect(isCompletedSessionStale("2026-10-23", "2026-10-25T21:12:00.000Z")).toBe(false); // Sunday
    expect(isCompletedSessionStale("2026-10-23", "2026-10-24T15:00:00.000Z")).toBe(false); // Saturday
    expect(isCompletedSessionStale("2026-10-23", "2026-10-26T14:00:00.000Z")).toBe(false); // Monday morning, before Monday's close publishes
  });

  test("an Oct 23 board becomes stale only once a newer completed session exists", () => {
    expect(isCompletedSessionStale("2026-10-23", "2026-10-26T21:30:00.000Z")).toBe(true); // Monday after close + publication
    expect(isCompletedSessionStale(null, "2026-10-25T21:12:00.000Z")).toBe(true);
  });

  test("a board row on the board's own session is not stale; a lagging row is", () => {
    expect(isCompletedSessionRowStale("2026-10-23", "2026-10-23")).toBe(false);
    expect(isCompletedSessionRowStale("2026-10-22", "2026-10-23")).toBe(true);
    expect(isCompletedSessionRowStale(null, "2026-10-23")).toBe(false);
  });

  test("a run covering the latest completed session is not overdue for weekend age alone", () => {
    const fridaySuccess = new Date("2026-10-23T20:00:00.000Z");
    expect(isScanRunOverdue({ lastSuccessAt: fridaySuccess, dataThroughSession: "2026-10-23", now: new Date("2026-10-25T21:12:00.000Z") })).toBe(false);
    // The same age with a session that is no longer the latest completed
    // one IS overdue.
    expect(isScanRunOverdue({ lastSuccessAt: fridaySuccess, dataThroughSession: "2026-10-22", now: new Date("2026-10-25T21:12:00.000Z") })).toBe(true);
    expect(isScanRunOverdue({ lastSuccessAt: null, dataThroughSession: "2026-10-23", now: new Date("2026-10-25T21:12:00.000Z") })).toBe(true);
  });
});

describe("Q4 resume does not fork over an unfinished batch", () => {
  test("run 46's unfinished newest batch is the resume pick, across cycle keys", () => {
    const batches = [
      { id: 27, stage: "done", cycleKey: FRIDAY_CYCLE },
      { id: 28, stage: "open", cycleKey: FRIDAY_CYCLE }, // run 46, wedged at 20/101
    ];
    expect(pickScanBatchToResume(batches)?.id).toBe(28);
    expect(pickScanBatchToResume(batches, 28)?.id).toBe(28);
    // A superseded id never resurrects the older batch.
    expect(pickScanBatchToResume(batches, 27)).toBeNull();
  });

  test("a completed newest batch is not resumed — the next scan waits for its session", () => {
    expect(pickScanBatchToResume([{ id: 28, stage: "done", cycleKey: FRIDAY_CYCLE }])).toBeNull();
  });
});

describe("Q4 paper cohort cap unchanged", () => {
  test("the 5-position paper cohort cap is exactly 5", () => {
    expect(PAPER_ISSUANCE_COHORT_CAP).toBe(5);
  });
});
