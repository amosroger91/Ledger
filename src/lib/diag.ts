// ============================================================
//  diag.ts — opt-in runtime diagnostics for hunting main-thread
//  stalls ("page unresponsive"). Everything here is gated behind
//  the `?diag` query flag, so it is completely inert for normal
//  visitors (zero cost — the calls early-return).
// ============================================================

export const DIAG =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("diag");

const t0 = typeof performance !== "undefined" ? performance.now() : 0;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Log a labelled checkpoint with elapsed-since-load (only when ?diag). */
export function diag(label: string, extra?: unknown): void {
  if (!DIAG) return;
  console.log(`[DIAG +${Math.round(now() - t0)}ms] ${label}`, extra ?? "");
}

/** Time a synchronous or async section and log how long it blocked (when ?diag). */
export async function diagTime<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
  if (!DIAG) return fn();
  const start = now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(now() - start);
    console.log(`[DIAG] ${label} took ${ms}ms`);
  }
}

/** Arm a heartbeat that prints any main-thread stall over `thresholdMs`. The
 *  console is captured out-of-process, so these survive a frozen UI and pinpoint
 *  when (and, paired with diag() checkpoints, where) the thread was pinned. */
export function armHeartbeat(thresholdMs = 200): void {
  let last = now();
  setInterval(() => {
    const n = now();
    const gap = n - last;
    last = n;
    if (gap > thresholdMs) console.log(`[HB] main-thread stalled ${Math.round(gap)}ms`);
  }, 100);
  console.log("[HB] diag heartbeat armed");
}
