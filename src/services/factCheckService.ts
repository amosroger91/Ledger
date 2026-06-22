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
import { rankFactChecks } from "@/lib/factMatch";

export interface FactCheck { claim: string; link: string; ruling?: string; published: number; }

const FEEDS = [
  "https://www.politifact.com/rss/factchecks/",
  "https://www.politifact.com/rss/all/",
];
const PROXIES = ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?url="];
const RULINGS = ["pants on fire", "mostly true", "mostly false", "half true", "barely true", "true", "false"];

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
let byPost = new Map<string, FactCheck>();   // user-linked fact-checks, keyed by post id

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

  /** Make sure the PolitiFact index is loaded (lazily, once) before a check, so
   *  "Fact-check this" works even if it wasn't pre-loaded at boot. */
  private loading: Promise<void> | null = null;
  async ensureIndex(): Promise<boolean> {
    if (this.ready) return true;
    if (!this.loading) this.loading = this.refresh().finally(() => { this.loading = null; });
    await this.loading;
    return this.ready;
  }

  /** Algorithmically match a post against PolitiFact — no AI. Loads the index on
   *  demand, then ranks claims by IDF-weighted lexical overlap. Returns the best
   *  qualifying fact-check or null. */
  async checkPost(text: string): Promise<FactCheck | null> {
    if (!text?.trim()) return null;
    await this.ensureIndex();
    return rankFactChecks(text.slice(0, 1200), index)?.item ?? null;
  }

  // ---- user-triggered, per-post fact-check links (the LLM-driven flow) ----
  async loadLinks() {
    const saved = await storage.kvGet<Record<string, FactCheck>>("factcheck:byPost");
    if (saved) byPost = new Map(Object.entries(saved));
  }
  private async persistLinks() { await storage.kvSet("factcheck:byPost", Object.fromEntries(byPost)); }
  getFor(postId: string): FactCheck | null { return byPost.get(postId) ?? null; }
  async setFor(postId: string, fc: FactCheck) { byPost.set(postId, fc); await this.persistLinks(); }
  async removeFor(postId: string) { byPost.delete(postId); await this.persistLinks(); }
  /** Cleanse: drop every linked fact-check (used once to clear the old auto-matched data). */
  async clearLinks() { byPost.clear(); await this.persistLinks(); }
}

export const factCheckService = new FactCheckService();
