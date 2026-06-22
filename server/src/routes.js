// ============================================================
//  routes.js — the unified HTTP read surface. The same API serves
//  persisted Gun data and aggregated RSS; /api/timeline merges both.
//  Content writes are NOT here by design — they go peer-to-peer over
//  Gun. The only writes here manage which RSS feeds get aggregated.
// ============================================================
import { Router } from "express";
import { store } from "./store/index.js";
import { aggregator } from "./rss/aggregator.js";
import { youtubeFeed, rsshubFeed } from "./rss/feeds.js";
import { config } from "./config.js";
import { points } from "./contrib/points.js";
import { verifyRecord, fingerprint } from "./lib/crypto.js";
import { identity } from "./identity.js";
import { nodeStats } from "./node/contributor.js";
import { dashboardHtml, CONSENT_TEXT } from "./dashboard.js";

const intParam = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const listParam = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : null);

export function buildRouter() {
  const r = Router();

  // --- service info & health ---
  r.get("/", (_req, res) =>
    res.json({
      service: "ledger-server",
      description:
        "Hybrid Gun.js persistence relay + RSS aggregation. Reads merge persisted Gun posts and aggregated RSS into one timeline; content writes go peer-to-peer over Gun.",
      gunRelay: "/gun",
      root: config.root,
      endpoints: [
        "GET /health",
        "GET /api/timeline?limit&before&topics&kinds&source",
        "GET /api/posts?author&limit",
        "GET /api/profiles/:pk",
        "GET /api/nft  ·  GET /api/nft/:id",
        "GET /api/feeds  ·  GET /api/feeds/:id  ·  POST /api/feeds  ·  DELETE /api/feeds/:id",
        "GET /api/rss/youtube/:channelId",
        "POST /api/refresh",
        "GET /api/stats",
      ],
    }),
  );

  r.get("/health", (_req, res) =>
    res.json({ ok: true, uptime: Math.round(process.uptime()), ...store.stats(), lastRssRefresh: aggregator.lastRefresh() }),
  );
  r.get("/api/stats", (_req, res) =>
    res.json({ ...store.stats(), feeds: aggregator.feeds().length, lastRssRefresh: aggregator.lastRefresh() }),
  );

  // --- THE merged timeline (Gun posts + RSS, newest-first, paged) ---
  r.get("/api/timeline", (req, res) => {
    const limit = Math.min(200, Math.max(1, intParam(req.query.limit, 50)));
    const before = req.query.before ? intParam(req.query.before, Date.now()) : Infinity;
    const topics = listParam(req.query.topics);
    const kinds = listParam(req.query.kinds);
    const source = ["gun", "rss", "all"].includes(req.query.source) ? req.query.source : "all";
    res.json(store.timeline({ limit, before, topics, kinds, source }));
  });

  // --- Gun-only persisted posts (human + creator) ---
  r.get("/api/posts", (req, res) => {
    const limit = Math.min(500, Math.max(1, intParam(req.query.limit, 100)));
    let list = [...store.posts.values()];
    if (req.query.author) list = list.filter((p) => p.author === req.query.author);
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ posts: list.slice(0, limit), total: list.length });
  });

  // --- persisted creator metadata: profiles & (forward-looking) NFTs ---
  r.get("/api/profiles/:pk", (req, res) => {
    const p = store.profiles.get(req.params.pk);
    return p ? res.json(p) : res.status(404).json({ error: "not found" });
  });
  r.get("/api/nft", (_req, res) => res.json({ nfts: [...store.nfts.values()] }));
  r.get("/api/nft/:id", (req, res) => {
    const n = store.nfts.get(req.params.id);
    return n ? res.json(n) : res.status(404).json({ error: "not found" });
  });

  // --- RSS feed registry management ---
  r.get("/api/feeds", (_req, res) => res.json({ feeds: aggregator.feeds(), lastRefresh: aggregator.lastRefresh() }));

  r.get("/api/feeds/:id", (req, res) => {
    const feed = aggregator.feeds().find((f) => f.id === req.params.id);
    if (!feed) return res.status(404).json({ error: "unknown feed" });
    const items = [...store.rss.values()].filter((p) => p.feedId === feed.id).sort((a, b) => b.createdAt - a.createdAt);
    res.json({ feed, items });
  });

  // Add a feed by raw URL, YouTube channel/playlist, or an RSSHub route.
  r.post("/api/feeds", (req, res) => {
    try {
      const { url, title, topic, channelId, playlistId, rsshub } = req.body || {};
      let feed;
      if (channelId || playlistId) feed = youtubeFeed({ channelId, playlistId, title, topic });
      else if (rsshub) feed = rsshubFeed(rsshub, { title, topic });
      else if (url) feed = { url, title, topic };
      else return res.status(400).json({ error: "provide one of: url, channelId/playlistId, rsshub" });
      if (!feed) return res.status(400).json({ error: "could not build feed (is RSSHUB_BASE set?)" });
      const added = aggregator.addFeed(feed);
      aggregator.refresh().catch(() => {});
      res.status(201).json({ feed: added });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.delete("/api/feeds/:id", (req, res) => res.json({ removed: aggregator.removeFeed(req.params.id) }));

  // Convenience: subscribe a YouTube channel and return its items immediately.
  r.get("/api/rss/youtube/:channelId", async (req, res) => {
    const feed = aggregator.addFeed(youtubeFeed({ channelId: req.params.channelId, topic: req.query.topic || "youtube" }));
    await aggregator.refresh().catch(() => {});
    const items = [...store.rss.values()].filter((p) => p.feedId === feed.id).sort((a, b) => b.createdAt - a.createdAt);
    res.json({ feed, items });
  });

  // Manual refresh trigger — handy for an uptime cron ping (keeps the free
  // instance warm) or debugging.
  r.post("/api/refresh", async (_req, res) => res.json(await aggregator.refresh()));

  // ---- network points (contribution ledger) ----------------------------------
  // A contributor node POSTs a SIGNED heartbeat; the relay verifies + credits.
  r.post("/api/contrib", async (req, res) => {
    const env = req.body;
    if (!env?.data?.pk || !env.sig || env.pk !== env.data.pk) {
      return res.status(400).json({ error: "malformed heartbeat (need {data:{pk,...}, sig, pk})" });
    }
    if (!(await verifyRecord(env))) return res.status(401).json({ error: "bad signature" });
    const { pk, name, nodeId, items } = env.data;
    const t = points.credit({ pk, name, nodeId, items });
    res.json({ ok: true, ...t });
  });

  // A user's network points — read by the web profile.
  r.get("/api/points/:pk", (req, res) => res.json(points.get(req.params.pk)));
  // Top contributors.
  r.get("/api/leaderboard", (req, res) =>
    res.json({ leaders: points.leaderboard(Math.min(200, Math.max(1, intParam(req.query.limit, 50)))) }),
  );

  // ---- contributor-node self info + local dashboard ---------------------------
  r.get("/api/whoami", (_req, res) =>
    res.json({
      mode: config.mode,
      pk: identity.pk,
      fingerprint: identity.loaded ? fingerprint(identity.pk) : "",
      anonymous: !identity.loaded,
    }),
  );
  r.get("/api/node", (_req, res) => res.json({ ...nodeStats(), ...store.stats() }));
  r.get("/api/consent", (_req, res) => res.type("text").send(CONSENT_TEXT));
  r.get("/dashboard", (_req, res) => res.type("html").send(dashboardHtml()));

  return r;
}
