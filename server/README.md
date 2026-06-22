# Ledger — Server (Gun relay + RSS aggregator)

> The optional, **lightweight** backend for Ledger. The app itself still runs
> with **no server** (identity on-device, data in IndexedDB, P2P over Gun/WebRTC).
> This box solves the two things pure-P2P can't do alone:
>
> 1. **Persistence** — a read-only **Gun.js relay** that stays online 24/7, syncs
>    the global graph (feed, creator posts, NFT metadata), and persists it to disk
>    so data survives when every human peer is offline.
> 2. **Aggregation** — an **RSS scraper** that ingests *any* feed (YouTube, blogs,
>    podcasts, Reddit, GitHub releases, Twitch via RSSHub…) and exposes them on the
>    **same API**, merged into one timeline.
>
> No database. No blockchain. Just a relay and a poller. Runs on the Render free tier.

```
                        ┌─────────────────────────────────────────────┐
   creator nodes        │              Ledger server (this)            │
   (browsers) ──writes──┤                                              │
        ▲   P2P over Gun │   /gun  ──▶ Gun relay ──▶ radisk (disk)      │
        │                │                 │                            │
        │                │                 ▼  mirror                    │
   reads (HTTP)          │            in-memory store ◀── RSS aggregator│◀── RSS/Atom
        └────────────────┤                 │              (YouTube,     │    feeds on
   GET /api/timeline ◀────┤   merge Gun + RSS, newest-first             │    the open web
                         └─────────────────────────────────────────────┘
```

**Writes** stay peer-to-peer (browser → Gun graph). **Reads** pull persisted Gun
posts **and** aggregated RSS in a single request.

---

## API

| Method & path | What it returns |
|---|---|
| `GET /gun` | The Gun.js relay endpoint (add this URL to the frontend's peer list). |
| `GET /health` | Liveness + store counts (used by Render's health check). |
| `GET /api/timeline` | **The headline endpoint.** Merged Gun posts + RSS, newest-first, paged. |
| `GET /api/posts` | Gun-persisted posts only (`?author=<pk>`, `?limit=`). |
| `GET /api/profiles/:pk` | A persisted public profile. |
| `GET /api/nft` · `GET /api/nft/:id` | Persisted creator NFT metadata (forward-looking). |
| `GET /api/feeds` · `GET /api/feeds/:id` | The RSS feed registry / one feed's items. |
| `POST /api/feeds` | Add a feed: `{ url }` **or** `{ channelId }`/`{ playlistId }` **or** `{ rsshub: "/twitch/live/x" }`. |
| `DELETE /api/feeds/:id` | Unsubscribe a feed. |
| `GET /api/rss/youtube/:channelId` | Subscribe a YouTube channel and return its items now. |
| `POST /api/refresh` | Force an RSS refresh (handy as an uptime-ping target). |
| `GET /api/stats` | Counts + last refresh time. |

### `GET /api/timeline`

Query params: `limit` (≤200, default 50) · `before` (createdAt-ms cursor for
paging) · `topics` (CSV; filters RSS by tag, humans always pass) · `kinds` (CSV
of post kinds) · `source` (`all` | `gun` | `rss`).

```jsonc
{
  "posts": [ /* array of Ledger Post objects, newest first */ ],
  "nextBefore": 1718900000000,        // pass back as ?before= to page; null at end
  "counts": { "gun": 12, "rss": 480, "returned": 50 }
}
```

Every item — Gun post or RSS story — is normalized to the **frontend's `Post`
shape** (`src/types/index.ts`), so it renders with the existing `PostCard` with
zero client changes. RSS items use `author: "rss-bot"`, carry the headline +
summary + link in `text`, and tag `tags[0]` with their topic.

---

## Run locally

```bash
cd server
npm install
cp .env.example .env   # optional — defaults work out of the box
npm run dev            # http://localhost:8787  (node --watch)
```

Smoke test:

```bash
curl localhost:8787/health
curl "localhost:8787/api/timeline?limit=5"
curl -X POST localhost:8787/api/feeds -H 'content-type: application/json' \
  -d '{"channelId":"UCXuqSBlHAE6Xw-yeJA0Tunw","title":"LTT","topic":"tech"}'
```

## Deploy to Render (free)

**Blueprint (recommended):** push this repo to GitHub → Render ▸ **New ▸ Blueprint**
→ select the repo. Render reads [`render.yaml`](./render.yaml) and provisions a
free web service with `rootDir: server`.

**Manual:** New ▸ Web Service → repo → Root Directory `server`, Build `npm install`,
Start `npm start`, Health check `/health`, Instance `Free`.

You'll get a URL like `https://ledger-server.onrender.com`. The relay is at
`/gun`.

## Wire it to the frontend

Add the relay URL to the Gun peer list in `src/services/gunService.ts`:

```ts
const PEERS = [
  "https://gun-manhattan.herokuapp.com/gun",
  "https://peer.wallie.io/gun",
  "https://relay.peer.ooo/gun",
  "https://ledger-server.onrender.com/gun",   // ← your Render relay
];
```

That alone gives you durable persistence (the relay now stores everything the
swarm produces). To also pull the **merged timeline** for instant cold-start
backfill, have `rssService`/`feedService` fetch `…/api/timeline` and feed each
item through `feedService.ingest(post)` — they're already in `Post` shape.

## Config

All env vars are optional — see [`.env.example`](./.env.example). The one that
matters most is **`GUN_ROOT`**, which **must match** the frontend's `ROOT`
(currently `zuccbook-v1`).

## Honest limitations

- **Free tier isn't truly 24/7.** Render free services sleep after ~15 min idle
  and have an **ephemeral filesystem** (radisk wiped on redeploy/spin-down). The
  graph re-syncs from public peers on wake, but for real durability attach a
  **Render Disk** and point `GUN_DATA_DIR` at it (paid), and keep the box warm with
  an uptime pinger hitting `POST /api/refresh`.
- **The relay does not verify signatures** — it persists whatever flows through
  the graph, exactly like any public Gun peer. That's consistent with the current
  frontend (which signs records but doesn't yet verify them on ingest). Enforcing
  `verifyRecord` end-to-end is a frontend change; until then, treat relayed data
  as unauthenticated.
- **Non-RSS sources need RSSHub.** Twitch/Instagram/etc. have no native RSS — set
  `RSSHUB_BASE` (default `https://rsshub.app`) and add them via
  `POST /api/feeds {"rsshub":"/twitch/live/<user>"}`. Public RSSHub instances rate-limit;
  self-host for reliability.
- **In-memory read index.** The merged timeline is served from RAM and rebuilt by
  re-reading the Gun graph on boot; it's sized for a community swarm, not millions
  of posts.
