import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { evaluateEquityDirectionForecast, evaluateEquityTradeSetup, type DailyEvidenceBar, type FrozenEvaluationSignal } from "./measurement";

function store() {
  const db = new Database(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE runs (id TEXT PRIMARY KEY, cursor INTEGER NOT NULL, total INTEGER NOT NULL, membership TEXT NOT NULL, lease_token TEXT, lease_expires_at INTEGER, lease_version INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE items (run_id TEXT NOT NULL, signal_id INTEGER NOT NULL, ordinal INTEGER NOT NULL, grading_state TEXT NOT NULL, reason_code TEXT NOT NULL, PRIMARY KEY(run_id, signal_id), UNIQUE(run_id, ordinal), FOREIGN KEY(run_id) REFERENCES runs(id));
    CREATE TABLE revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, signal_id INTEGER NOT NULL, evaluator_version TEXT NOT NULL, product TEXT NOT NULL, evidence_identity TEXT NOT NULL, verdict TEXT NOT NULL, reason_code TEXT NOT NULL, evidence_json TEXT NOT NULL, UNIQUE(signal_id, evaluator_version, product, evidence_identity));
  `);
  return db;
}
function hashRows(db: Database) {
  const rows = db.query("SELECT * FROM revisions ORDER BY id").all();
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(rows)).digest("hex");
}
function reconcile(db: Database, runId: string) {
  const run = db.query("SELECT * FROM runs WHERE id = ?").get(runId) as { total: number; membership: string } | null;
  if (!run) return { code: "RUN_NOT_FOUND" as const };
  const membership = JSON.parse(run.membership) as number[];
  const rows = db.query("SELECT signal_id, ordinal FROM items WHERE run_id = ? ORDER BY ordinal").all(runId) as Array<{ signal_id: number; ordinal: number }>;
  const expected = new Set(membership); const seen = new Set<number>(); const duplicateMembershipIds = membership.filter((id) => seen.has(id) || !seen.add(id));
  const missingIds = membership.filter((id) => !rows.some((row) => row.signal_id === id));
  const unexpectedIds = rows.filter((row) => !expected.has(row.signal_id)).map((row) => row.signal_id);
  const ordinalMismatches = membership.flatMap((id, ordinal) => { const row = rows.find((item) => item.signal_id === id); return row && row.ordinal !== ordinal ? [id] : []; });
  return { code: "OK" as const, originalExpected: run.total, membershipCount: membership.length, missingIds, unexpectedIds, duplicateMembershipIds, ordinalMismatches, reconciled: run.total === membership.length && !missingIds.length && !unexpectedIds.length && !duplicateMembershipIds.length && !ordinalMismatches.length };
}
function signal(overrides: Partial<FrozenEvaluationSignal> = {}): FrozenEvaluationSignal {
  return { signalId: 1, direction: "long", entryPrice: 100, stopPrice: 90, targetPrice: 115, entryAt: "2026-10-01T13:30:00.000Z", issuedAt: "2026-09-30T20:00:00.000Z", expiresAt: null, primaryHorizon: 3, horizonUnit: "trading_sessions", exchangeCalendar: "XNYS", entryRule: "fixture", ...overrides };
}
function bar(date: string, overrides: Partial<DailyEvidenceBar> = {}): DailyEvidenceBar { return { date, open: 100, high: 105, low: 95, close: 102, availableAt: `${date}T20:00:00.000Z`, ...overrides }; }

describe("measurement run database integrity", () => {
  test("unknown explicit run ID is RUN_NOT_FOUND; null is the only new-run path", () => {
    const db = store(); expect(reconcile(db, "unknown")).toEqual({ code: "RUN_NOT_FOUND" });
    db.query("INSERT INTO runs(id,cursor,total,membership) VALUES(?,?,?,?)").run("new", 0, 0, "[]");
    expect(reconcile(db, "new")).toMatchObject({ code: "OK", reconciled: true, originalExpected: 0 });
  });

  test("50→49 cannot close and original denominator remains 50", () => {
    const db = store(); const ids = Array.from({ length: 50 }, (_, index) => index + 1);
    db.query("INSERT INTO runs(id,cursor,total,membership) VALUES(?,?,?,?)").run("r", 49, 50, JSON.stringify(ids));
    const insert = db.prepare("INSERT INTO items(run_id,signal_id,ordinal,grading_state,reason_code) VALUES(?,?,?,?,?)");
    for (const [ordinal, id] of ids.slice(0, 49).entries()) insert.run("r", id, ordinal, "evaluated", "hit");
    expect(reconcile(db, "r")).toMatchObject({ reconciled: false, originalExpected: 50, membershipCount: 50, missingIds: [50] });
  });

  test("duplicate, unexpected and ordinal corruption are rejected by identity/constraints", () => {
    const db = store(); db.query("INSERT INTO runs(id,cursor,total,membership) VALUES(?,?,?,?)").run("r", 0, 2, "[1,1]");
    db.query("INSERT INTO items(run_id,signal_id,ordinal,grading_state,reason_code) VALUES(?,?,?,?,?)").run("r", 1, 1, "queued", "awaiting");
    expect(reconcile(db, "r")).toMatchObject({ reconciled: false, duplicateMembershipIds: [1], ordinalMismatches: [1] });
    expect(() => db.query("INSERT INTO items(run_id,signal_id,ordinal,grading_state,reason_code) VALUES(?,?,?,?,?)").run("r", 1, 0, "queued", "duplicate")).toThrow();
    db.query("DELETE FROM items").run(); db.query("UPDATE runs SET membership='[1,2]', total=2 WHERE id='r'").run();
    db.query("INSERT INTO items(run_id,signal_id,ordinal,grading_state,reason_code) VALUES(?,?,?,?,?)").run("r", 1, 0, "queued", "awaiting");
    db.query("INSERT INTO items(run_id,signal_id,ordinal,grading_state,reason_code) VALUES(?,?,?,?,?)").run("r", 9, 1, "queued", "unexpected");
    expect(reconcile(db, "r")).toMatchObject({ reconciled: false, missingIds: [2], unexpectedIds: [9] });
  });

  test("stale concurrent cursor/lease attempts have one durable winner", () => {
    const db = store(); db.query("INSERT INTO runs(id,cursor,total,membership) VALUES(?,?,?,?)").run("r", 0, 1, "[1]");
    const acquire = db.prepare("UPDATE runs SET lease_token=?,lease_expires_at=?,lease_version=lease_version+1 WHERE id=? AND cursor=? AND (lease_token IS NULL OR lease_expires_at<?)");
    expect(acquire.run("a", 200, "r", 0, 100).changes).toBe(1);
    expect(acquire.run("b", 200, "r", 0, 100).changes).toBe(0);
    const commit = db.prepare("UPDATE runs SET cursor=?,lease_token=NULL,lease_expires_at=NULL WHERE id=? AND cursor=? AND lease_token=?");
    expect(commit.run(1, "r", 0, "a").changes).toBe(1);
    expect(commit.run(1, "r", 0, "b").changes).toBe(0);
  });

  test("interruption after evaluation write before cursor commit replays without duplicates or rewrites", () => {
    const db = store(); db.query("INSERT INTO runs(id,cursor,total,membership,lease_token,lease_expires_at) VALUES(?,?,?,?,?,?)").run("r", 0, 1, "[1]", "dead-worker", 10);
    const insert = db.prepare("INSERT OR IGNORE INTO revisions(signal_id,evaluator_version,product,evidence_identity,verdict,reason_code,evidence_json) VALUES(?,?,?,?,?,?,?)");
    expect(insert.run(1, "v1", "trade_setup", "e1", "HIT", "target_first", "{}").changes).toBe(1);
    const hashAfterInterruptedWrite = hashRows(db);
    expect(db.query("SELECT cursor FROM runs WHERE id='r'").get()).toEqual({ cursor: 0 });
    const acquire = db.prepare("UPDATE runs SET lease_token=?,lease_expires_at=?,lease_version=lease_version+1 WHERE id=? AND cursor=? AND (lease_token IS NULL OR lease_expires_at<?)");
    expect(acquire.run("fresh-worker", 300, "r", 0, 100).changes).toBe(1);
    expect(insert.run(1, "v1", "trade_setup", "e1", "HIT", "target_first", "{}").changes).toBe(0);
    expect(db.query("UPDATE runs SET cursor=1,lease_token=NULL,lease_expires_at=NULL WHERE id='r' AND cursor=0 AND lease_token='fresh-worker'").run().changes).toBe(1);
    expect(db.query("SELECT COUNT(*) AS n FROM revisions").get()).toEqual({ n: 1 });
    expect(hashRows(db)).toBe(hashAfterInterruptedWrite);
  });
});

describe("accepted evaluator result → grading/trade traces", () => {
  const cutoff = "2026-10-20T00:00:00.000Z";
  test("missing initial, middle and tail candles stay UNVERIFIED/open", () => {
    const initial = evaluateEquityTradeSetup(signal(), [bar("2026-10-02"), bar("2026-10-05")], cutoff, { kind: "unknown" });
    const middle = evaluateEquityTradeSetup(signal(), [bar("2026-10-01"), bar("2026-10-05", { high: 120 })], cutoff, { kind: "unknown" });
    const tail = evaluateEquityTradeSetup(signal(), [bar("2026-10-01"), bar("2026-10-02")], cutoff, { kind: "unknown" });
    expect([initial.verdict, middle.verdict, tail.verdict]).toEqual(["UNVERIFIED", "UNVERIFIED", "UNVERIFIED"]);
  });
  test("forming/unavailable, expiry-straddling and same-bar outcomes do not manufacture resolution", () => {
    const forming = evaluateEquityTradeSetup(signal(), [bar("2026-10-02", { availableAt: "2026-10-21T20:00:00.000Z" }), bar("2026-10-05", { high: 120 })], cutoff, { kind: "unknown" });
    const expired = evaluateEquityTradeSetup(signal({ expiresAt: "2026-10-02T16:00:00.000Z" }), [bar("2026-10-02", { high: 120 }), bar("2026-10-05")], cutoff, { kind: "unknown" });
    const ambiguous = evaluateEquityTradeSetup(signal(), [bar("2026-10-02", { high: 120, low: 85 }), bar("2026-10-05"), bar("2026-10-06")], cutoff, { kind: "unknown" });
    expect(forming.verdict).toBe("OPEN"); expect(expired.verdict).not.toBe("HIT"); expect(ambiguous.verdict).toBe("AMBIGUOUS");
  });
  test("fixed-horizon direction remains a separate accepted product", () => {
    const bars = [bar("2026-10-02", { high: 120, close: 100 }), bar("2026-10-05", { close: 95 }), bar("2026-10-06", { low: 85, close: 90 })];
    const trade = evaluateEquityTradeSetup(signal(), bars, cutoff, { kind: "unknown" });
    const direction = evaluateEquityDirectionForecast(signal(), bars, cutoff);
    expect([trade.verdict, direction.verdict]).toEqual(["HIT", "MISS"]);
    expect([trade.reasonCode, direction.reasonCode]).toEqual(["first_target_touch", "fixed_horizon_direction"]);
  });
  test("provider failure is retry-pending while trade state stays open", () => {
    const db = store(); db.query("INSERT INTO runs(id,cursor,total,membership) VALUES(?,?,?,?)").run("r", 0, 1, "[1]");
    db.query("INSERT INTO items(run_id,signal_id,ordinal,grading_state,reason_code) VALUES(?,?,?,?,?)").run("r", 1, 0, "retry_pending", "daily_ohlc_transport_failure");
    const row = db.query("SELECT grading_state,reason_code FROM items WHERE run_id='r' AND signal_id=1").get();
    expect(row).toEqual({ grading_state: "retry_pending", reason_code: "daily_ohlc_transport_failure" });
    expect(reconcile(db, "r")).toMatchObject({ reconciled: true });
  });
});
