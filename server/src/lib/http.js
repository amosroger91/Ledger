// ============================================================
//  http.js — tiny dependency-free HTTP helpers. `fetchText` tries the
//  source directly first, then falls back through public CORS proxies
//  (many feeds — Reddit, YouTube, some news — throttle or block a bare
//  datacenter IP; the proxies front the request). `mapLimit` runs a
//  bounded-concurrency fan-out so one slow feed can't stall the refresh.
// ============================================================
const UA = "Ledger-Relay/0.1 (+https://github.com/amosroger91/ZuccBook)";

const PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

async function tryFetch(url, timeoutMs, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml, */*", ...headers },
    });
    if (!r.ok) return null;
    const txt = await r.text();
    return txt || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Fetch text, direct first then via CORS proxies. Pass {proxy:false} for APIs
 *  that are already CORS/keyless-friendly (iTunes, NVD) to skip the fallback. */
export async function fetchText(url, { timeoutMs = 12000, headers, proxy = true } = {}) {
  const direct = await tryFetch(url, timeoutMs, headers);
  if (direct != null) return direct;
  if (!proxy) return null;
  for (const p of PROXIES) {
    const via = await tryFetch(p(url), timeoutMs, headers);
    if (via != null) return via;
  }
  return null;
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
