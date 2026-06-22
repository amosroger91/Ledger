// ============================================================
//  rss/aggregator.js — the aggregation half of Ledger. Keeps a registry
//  of feeds, refreshes them on a timer with bounded concurrency + per-feed
//  timeout, normalizes every item into the Post shape, and drops them in
//  the shared store (dedup-safe by stable id). One slow/broken feed can
//  never stall the rest.
// ============================================================
import Parser from "rss-parser";
import { config } from "../config.js";
import { store } from "../store/index.js";
import { fetchText, mapLimit } from "../lib/http.js";
import { itemToPost } from "./normalize.js";
import { DEFAULT_FEEDS, withId } from "./feeds.js";

const parser = new Parser({ timeout: config.rss.fetchTimeoutMs });
const feeds = new Map(); // id -> feed
let lastRefresh = 0;
let refreshing = false;

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

  /** Fetch every registered feed, normalize items into the store. Best-effort. */
  async refresh() {
    if (refreshing) return { skipped: true };
    refreshing = true;
    let ok = 0,
      failed = 0,
      added = 0;
    try {
      const all = [...feeds.values()];
      await mapLimit(all, config.rss.concurrency, async (feed) => {
        const xml = await fetchText(feed.url, { timeoutMs: config.rss.fetchTimeoutMs });
        if (!xml) {
          failed++;
          return;
        }
        try {
          const parsed = await parser.parseString(xml);
          for (const item of parsed.items || []) {
            const post = itemToPost(item, feed);
            if (!store.rss.has(post.id)) added++;
            store.putRss(post, config.rss.maxItems);
          }
          ok++;
        } catch {
          failed++;
        }
      });
      lastRefresh = Date.now();
    } finally {
      refreshing = false;
    }
    return { feeds: feeds.size, ok, failed, added, items: store.rss.size };
  },

  /** Seed defaults, do an immediate refresh, then refresh on the configured timer. */
  start() {
    this.seedDefaults();
    this.refresh()
      .then((r) => console.log(`[rss] first refresh:`, r))
      .catch(() => {});
    setInterval(() => this.refresh().catch(() => {}), config.rss.refreshMs);
    console.log(`[rss] ${feeds.size} feeds · refresh every ${Math.round(config.rss.refreshMs / 1000)}s`);
  },
};
