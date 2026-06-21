// ============================================================
//  factCheckService — optional fact-check context for RSS-Bot posts.
//  We pull PolitiFact's public RSS (recent fact-checks), index it
//  locally, and match a post's keywords against it. When there's a
//  confident overlap we surface a small "Fact check" card under the
//  post linking to PolitiFact. CORS-friendly via a proxy fallback;
//  fully local matching, no API key, nothing sent anywhere.
// ============================================================
import { bus } from "@/lib/events";
import { storage } from "./storage";

export interface FactCheck { claim: string; link: string; ruling?: string; published: number; }

const FEEDS = [
  "https://www.politifact.com/rss/factchecks/",
  "https://www.politifact.com/rss/all/",
];
const PROXIES = ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?url="];
const STOP = new Set(
  "this that with from have has had will would about into over after their they your you our are was were been being not but and the for there here what when where which while also more most some such than then them then says said report new news".split(" "),
);
const RULINGS = ["pants on fire", "mostly true", "mostly false", "half true", "barely true", "true", "false"];

function tokens(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((t) => !STOP.has(t)));
}
function detectRuling(s: string): string | undefined {
  const l = s.toLowerCase();
  // longest match first ("mostly true" before "true")
  return RULINGS.find((r) => l.includes(r));
}
async function fetchText(url: string): Promise<string | null> {
  try { const r = await fetch(url, { cache: "no-store" }); if (r.ok) return await r.text(); } catch {}
  for (const p of PROXIES) { try { const r = await fetch(p + encodeURIComponent(url), { cache: "no-store" }); if (r.ok) return await r.text(); } catch {} }
  return null;
}

let index: FactCheck[] = [];
let loaded = false;

class FactCheckService {
  /** Load the PolitiFact index (network, then cache fallback). Best-effort. */
  async refresh(): Promise<void> {
    const cached = await storage.kvGet<FactCheck[]>("factchecks");
    if (cached?.length) { index = cached; loaded = true; bus.emit("factcheck:ready", undefined); }
    for (const feed of FEEDS) {
      const xml = await fetchText(feed);
      if (!xml) continue;
      try {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        const items = [...doc.querySelectorAll("item")];
        if (!items.length) continue;
        const next = items.map((it): FactCheck => {
          const title = it.querySelector("title")?.textContent?.trim() ?? "";
          const link = it.querySelector("link")?.textContent?.trim() ?? "";
          const desc = it.querySelector("description")?.textContent ?? "";
          const published = Date.parse(it.querySelector("pubDate")?.textContent ?? "") || Date.now();
          return { claim: title, link, ruling: detectRuling(`${title} ${desc}`), published };
        }).filter((f) => f.claim && f.link);
        if (next.length) {
          index = next; loaded = true;
          await storage.kvSet("factchecks", index.slice(0, 200));
          bus.emit("factcheck:ready", undefined);
          return;
        }
      } catch { /* try next feed */ }
    }
    loaded = true;
  }

  get ready() { return loaded && index.length > 0; }

  /** Best matching recent fact-check for `text`, or null. Conservative: needs at
   *  least 3 shared meaningful keywords so we don't show spurious cards. */
  match(text: string): FactCheck | null {
    if (!index.length || !text) return null;
    const t = tokens(text);
    if (t.size < 3) return null;
    let best: FactCheck | null = null, bestScore = 0;
    for (const fc of index) {
      let shared = 0;
      for (const w of tokens(fc.claim)) if (t.has(w)) shared++;
      if (shared > bestScore) { bestScore = shared; best = fc; }
    }
    return bestScore >= 3 ? best : null;
  }
}

export const factCheckService = new FactCheckService();
