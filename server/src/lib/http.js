// ============================================================
//  http.js — tiny dependency-free HTTP helpers. `fetchText` with a
//  hard timeout, and `mapLimit` for bounded-concurrency fan-out so one
//  slow feed can't stall the whole refresh.
// ============================================================
const UA = "Ledger-Relay/0.1 (+https://github.com/amosroger91/ZuccBook)";

export async function fetchText(url, { timeoutMs = 12000, headers } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml, */*", ...headers },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Run `worker` over `items` with at most `limit` promises in flight.
 *  Never rejects — a failing item resolves to null in the results array. */
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch {
        results[idx] = null;
      }
    }
  });
  await Promise.all(runners);
  return results;
}
