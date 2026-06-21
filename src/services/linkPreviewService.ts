// ============================================================
//  linkPreviewService — social-media style link unfurling. Fetches a
//  URL's HTML (via public CORS proxies), scrapes Open Graph / Twitter
//  meta tags, and returns a {title, description, image, site} preview.
//  Cached in memory + IndexedDB so each link is only fetched once.
// ============================================================
import { storage } from "./storage";

const PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

export interface Preview { url: string; title?: string; description?: string; image?: string; site?: string; }

const mem = new Map<string, Preview>();
const decode = (s: string) => s
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function meta(html: string, prop: string): string | undefined {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
  const m = a || b;
  return m ? decode(m[1]) : undefined;
}

class LinkPreviewService {
  async preview(url: string): Promise<Preview> {
    if (mem.has(url)) return mem.get(url)!;
    const cached = await storage.kvGet<Preview>("lp:" + url);
    if (cached) { mem.set(url, cached); return cached; }

    let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    let html = "";
    for (const p of PROXIES) {
      try { const r = await fetch(p(url), { cache: "no-store" }); if (r.ok) { html = await r.text(); if (html) break; } } catch {}
    }
    const title = meta(html, "og:title") || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] && decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)![1]));
    let image = meta(html, "og:image") || meta(html, "twitter:image");
    if (image && image.startsWith("//")) image = "https:" + image;
    const preview: Preview = { url, title: title || undefined, description: meta(html, "og:description") || meta(html, "description"), image: image && /^https?:\/\//.test(image) ? image : undefined, site: meta(html, "og:site_name") || host };
    mem.set(url, preview);
    storage.kvSet("lp:" + url, preview);
    return preview;
  }
}

export const linkPreviewService = new LinkPreviewService();
