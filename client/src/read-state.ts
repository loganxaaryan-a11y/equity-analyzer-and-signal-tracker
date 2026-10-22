// Read-state helpers: a failed read is never rendered as an empty database.
// Ported from the crypto Theory Watch fix (PR #1, commit 65ae167),
// adapted to equity's read actions. These are UI wait limits only — they do
// not cancel server execution.

export const READ_WAIT_MS = 15_000;

/** Reject if the read takes longer than the UI wait limit. */
export function readWithDeadline<T>(read: () => Promise<T>, label = "Read"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${READ_WAIT_MS / 1000} seconds. Retry the read.`)),
      READ_WAIT_MS,
    );
    Promise.resolve().then(read).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** One-line, de-prefixed error for the visible panel. */
export function shortError(error: unknown): string {
  const text = String(error).replace(/^Error:\s*/, "");
  return text.length > 240 ? text.slice(0, 240) + "…" : text;
}

/** Full technical detail for the expandable <details> block. */
export function techDetail(error: unknown): string {
  if (error instanceof Error && error.stack) return error.stack;
  try { return JSON.stringify(error, null, 2); } catch { return String(error); }
}
