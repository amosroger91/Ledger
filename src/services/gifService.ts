// ============================================================
//  gifService — GIF search via Tenor (Google's free GIF API), using
//  the long-standing public demo key. Results are just CDN URLs; we
//  drop the GIF's URL into a post/reply and every client renders it
//  inline (animated) straight from Tenor — nothing heavy is relayed.
//  Swap GIF_KEY for your own free key if you hit rate limits.
// ============================================================
const GIF_KEY = "LIVDSRZULELA";                 // Tenor public demo key
const BASE = "https://g.tenor.com/v1";          // v1 still works with the demo key
const PROXIES = ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?url="];

export interface Gif { full: string; preview: string; w: number; h: number; title: string; }

async function getJson(url: string): Promise<any> {
  // Direct first (Tenor sends CORS), then proxy fallback for resilience.
  try { const r = await fetch(url, { cache: "no-store" }); if (r.ok) return await r.json(); } catch {}
  for (const prox of PROXIES) {
    try { const r = await fetch(prox + encodeURIComponent(url), { cache: "no-store" }); if (r.ok) return await r.json(); } catch {}
  }
  throw new Error("Tenor unreachable");
}

function mapResult(res: any): Gif | null {
  const m = (res.media && res.media[0]) || {};
  const full = (m.gif && m.gif.url) || (m.mediumgif && m.mediumgif.url) || (m.tinygif && m.tinygif.url);
  const preview = (m.tinygif && m.tinygif.url) || (m.nanogif && m.nanogif.url) || full;
  const dims = (m.tinygif && m.tinygif.dims) || (m.gif && m.gif.dims) || [200, 200];
  return full ? { full, preview, w: dims[0] || 200, h: dims[1] || 200, title: res.content_description || "GIF" } : null;
}

export async function searchGifs(query: string, limit = 24): Promise<Gif[]> {
  const q = (query || "").trim();
  const url = q
    ? `${BASE}/search?q=${encodeURIComponent(q)}&key=${GIF_KEY}&limit=${limit}&media_filter=minimal&contentfilter=high&ar_range=all`
    : `${BASE}/trending?key=${GIF_KEY}&limit=${limit}&media_filter=minimal&contentfilter=high`;
  const j = await getJson(url);
  return (j.results || []).map(mapResult).filter(Boolean) as Gif[];
}
