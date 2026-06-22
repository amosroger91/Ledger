// ============================================================
//  store/index.js — in-memory read indexes. The Gun relay streams
//  persisted records into here and the RSS aggregator drops normalized
//  items here, so the HTTP API can answer a MERGED timeline query from
//  RAM in a single pass. The durable copy lives in Gun's radisk on this
//  box and in every peer's IndexedDB — this is just the fast read view.
// ============================================================
const posts = new Map(); // id  -> Post   (from Gun: human + creator posts)
const profiles = new Map(); // pk -> Profile
const listings = new Map(); // id -> Listing
const nfts = new Map(); // id   -> NFT metadata
const rss = new Map(); // id    -> Post   (normalized RSS items)

const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);

export const store = {
  posts,
  profiles,
  listings,
  nfts,
  rss,

  putPost(p) {
    if (p && p.id) posts.set(p.id, p);
  },
  putProfile(p) {
    if (p && p.pk) profiles.set(p.pk, p);
  },
  putListing(l) {
    if (l && l.id) listings.set(l.id, l);
  },
  putNft(n) {
    if (n && n.id) nfts.set(n.id, n);
  },
  putRss(item, max) {
    if (!item || !item.id) return;
    rss.set(item.id, item);
    // keep only the `max` newest RSS items (cheap ring-buffer eviction)
    if (max && rss.size > max) {
      const sorted = [...rss.values()].sort((a, b) => num(a.createdAt) - num(b.createdAt));
      const drop = rss.size - max;
      for (let i = 0; i < drop; i++) rss.delete(sorted[i].id);
    }
  },

  /** The headline read: Gun posts + RSS items, merged, newest-first, paged. */
  timeline({ limit = 50, before = Infinity, topics = null, kinds = null, source = "all" } = {}) {
    const topicSet = topics && topics.length ? new Set(topics.map((t) => String(t).toLowerCase())) : null;
    const gunPosts = source === "rss" ? [] : [...posts.values()].filter((p) => !p.replyTo);
    const rssPosts = source === "gun" ? [] : [...rss.values()];

    // A node publishes aggregated RSS into Gun, so the same story (same stable
    // id) can appear in both the Gun posts and the local RSS store — dedup by id.
    const byId = new Map();
    for (const p of [...gunPosts, ...rssPosts]) if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
    let merged = [...byId.values()];
    // topic filter only constrains bot/RSS posts; human posts always pass
    if (topicSet) {
      merged = merged.filter(
        (p) => p.author !== "rss-bot" || (p.tags || []).some((t) => topicSet.has(String(t).toLowerCase())),
      );
    }
    if (kinds && kinds.length) {
      const k = new Set(kinds);
      merged = merged.filter((p) => k.has(p.kind));
    }
    merged = merged.filter((p) => num(p.createdAt) < before);
    merged.sort((a, b) => num(b.createdAt) - num(a.createdAt));

    const page = merged.slice(0, limit);
    const nextBefore = merged.length > limit ? num(page[page.length - 1].createdAt) : null;
    return {
      posts: page,
      nextBefore,
      counts: { gun: gunPosts.length, rss: rssPosts.length, returned: page.length },
    };
  },

  stats() {
    return { posts: posts.size, profiles: profiles.size, listings: listings.size, nfts: nfts.size, rss: rss.size };
  },
};
