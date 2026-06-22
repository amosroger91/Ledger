// ============================================================
//  rss/aggregator.js — the aggregation worker. Keeps the full topic
//  catalog, refreshes EVERY feed on a timer (bounded concurrency +
//  per-feed timeout + proxy fallback), resolves soft refs (YouTube
//  handles, podcast names, CVE keywords), normalizes items into the
//  Post shape, and drops them in the shared store (dedup by stable id).
//  Because this runs 24/7 for everyone, clients never have to fetch RSS
//  themselves — they just receive the results over Gun.
// ============================================================
import Parser from "rss-parser";
import { config } from "../config.js";
import { store } from "../store/index.js";
import { fetchText, mapLimit } from "../lib/http.js";
import { itemToPost } from "./normalize.js";
import { DEFAULT_FEEDS, withId } from "./feeds.js";
import { resolveYouTube, resolvePodcast, fetchCVE } from "./resolvers.js";

const parser = new Parser({ timeout: config.rss.fetchTimeoutMs });
const feeds = new Map(); // id -> feed
let lastRefresh = 0;
let refreshing = false;

/** Resolve a feed's kind to a list of rss-parser-style items. */
async function fetchFeedItems(feed) {
  try {
    if (feed.kind === "cve") return await fetchCVE(feed.url);
    let url = feed.url;
    if (feed.kind === "youtube") url = await resolveYouTube(feed.url);
    else if (feed.kind === "podcast") url = await resolvePodcast(feed.url);
    const xml = await fetchText(url, { timeoutMs: config.rss.fetchTimeoutMs });
    if (!xml) return [];
    const parsed = await parser.parseString(xml);
    return parsed.items || [];
  } catch {
    return [];
  }
}

export const aggregator = {
  feeds: () => [...feeds.values()],
  lastRefresh: () => lastRefresh,

  addFeed(feed) {
    if (!feed?.url) throw new Error("feed.url required");
    const f = withId(feed);
    feeds.set(f.id, f);
    return f;
  },
  removeFeed(id) {
    return feeds.delete(id);
  },
  seedDefaults() {
    for (const f of DEFAULT_FEEDS) if (!feeds.has(f.id)) feeds.set(f.id, f);
  },

  /** Fetch EVERY registered feed, normalize items into the store. Best-effort. */
  async refresh() {
    if (refreshing) return { skipped: true };
    refreshing = true;
    let ok = 0,
      failed = 0,
      added = 0;
    try {
      const all = [...feeds.values()];
      await mapLimit(all, config.rss.concurrency, async (feed) => {
        const items = await fetchFeedItems(feed);
        if (!items.length) {
          failed++;
          return;
        }
        for (const item of items) {
          const post = itemToPost(item, feed);
          if (!store.rss.has(post.id)) added++;
          store.putRss(post, config.rss.maxItems);
        }
        ok++;
      });
      lastRefresh = Date.now();
    } finally {
      refreshing = false;
    }
    console.log(`[rss] refresh: ${ok} ok / ${failed} empty · +${added} new · ${store.rss.size} items`);
    return { feeds: feeds.size, ok, failed, added, items: store.rss.size };
  },

  /** Seed the full catalog, refresh now, then refresh on the configured timer. */
  start() {
    this.seedDefaults();
    this.refresh().catch(() => {});
    setInterval(() => this.refresh().catch(() => {}), config.rss.refreshMs);
    console.log(`[rss] ${feeds.size} feeds across the full catalog · refresh every ${Math.round(config.rss.refreshMs / 1000)}s`);
  },
};
