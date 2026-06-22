# Ledger — Feature Atlas

> Everything this platform does, and the "wild architecture" that makes each
> thing possible **with no backend, no database, and no hosting bill.**

Ledger is a full social platform — feed, groups, DMs, chatrooms, watch
parties, an on‑device AI, a crypto wallet, moderation, fact‑checking — that ships
as **static files on GitHub Pages**. The repository *is* the server. There is no
API, no cloud function, no Postgres. Every capability below is achieved purely in
the browser, on the user's own device, talking peer‑to‑peer to others.

This document is the catalog. For each feature area it lists **what it does** and
**how the architecture pulls it off** without a server.

---

## The architectural toolbox

These are the building blocks every feature is assembled from. The "trick" of the
whole project is that each one is a browser‑native or peer‑to‑peer capability, so
nothing needs a company‑owned computer in the middle.

| Capability | Tech | What it unlocks |
|---|---|---|
| **Hosting = the repo** | GitHub Pages serving `dist/` | The product and the server are the same static files. $0/month, world‑wide. |
| **Identity you own** | Web Crypto **ECDSA P‑256** (`crypto.ts`) | Accounts are a keypair generated on‑device. No sign‑up server; every post is signed. |
| **Local‑first storage** | **IndexedDB** (`idb`) + `localStorage` | Posts, profiles, messages, settings, wallet key live on *your* device. Works offline. |
| **Durable cross‑user sync** | **Gun.js** over public relay peers | Posts/profiles/marketplace/trust reach people who were offline, with no DB we run. |
| **Live presence & realtime** | **PeerJS** hub‑relay mesh (`peerService.ts`) | Presence, live posts, reactions, DMs, watch‑party sync, room voice/video — browser‑to‑browser. |
| **On‑device LLM** | **WebLLM + WebGPU** | A real language model runs locally for the Companion, fact‑check keywords, drafts. Nothing sent to a cloud. |
| **On‑device feed ranking** | Hashed n‑gram **embeddings** (`embeddings.ts`) | "For You" ranking + "why recommended" compute locally, instantly, no model download. |
| **Self‑custody money** | **ethers.js** + public Polygon RPCs | A real on‑chain wallet (POL/USDC) with the key held only on the device. |
| **Decoupling** | A tiny typed **event bus** (`events.ts`) | Services emit, UI subscribes — no central store, no server round‑trips. |
| **Reaching the open web** | CORS proxies (allorigins / corsproxy) | RSS, PolitiFact, price feeds, YouTube/TikTok resolution — all from a static page. |
| **Persistent media** | Global singleton players mounted at app root | Audio/video keep playing across navigation because the iframe/`<audio>` is never unmounted. |

---

## 1. Identity & onboarding

- **What:** Generate a cryptographic identity in one tap (optional display name),
  or import one from a file. Your identity is portable — it's literally a file you
  can carry to another device. Every post and message is signed by it.
- **How:** Web Crypto generates an ECDSA P‑256 keypair stored in IndexedDB. There
  is no account server — "signing up" is a local key generation. A public‑key
  fingerprint is the user id across the network.

## 2. The feed

- **Algorithms:** *For You* (human activity + your subscribed topics), *Newest*,
  *Trending*, *Discovery*, *Circle* — chosen with a toggle.
- **Honest ranking:** "For You" and the relevance scoring run **on your device**
  using a lightweight hashed‑embedding model (`embed()` / `InterestProfile`) — a
  bag‑of‑words vector, instant and download‑free. It is explicitly *not* the chat
  LLM; the "How this feed works" card says so. Tap the insights icon on any post
  to see exactly why it surfaced.
- **Content‑type filter:** All / Text / Videos / Images & GIFs / Music / Links /
  Polls, computed by classifying each post (`postType.ts`).
- **Keyword search:** matches post text, author and `#tags`, client‑side over the
  ranked feed.
- **How:** All ranking/filtering is pure functions over the locally stored posts;
  no search backend. Posts arrive via Gun (durable) and PeerJS (live).

## 3. Posting

- **Composer:** text, `#tags`, image upload, **GIF search (Tenor)**, **mp3
  upload**, and a Companion "draft a post" helper.
- **Rich rendering in posts & replies:**
  - **Emoticon → emoji** translation at render time (`:)`→🙂, `<3`→❤️, `XD`→😆…)
    — cosmetic only, the signed text is preserved (`emoticons.ts`).
  - **Inline images** for direct image links (incl. Tenor GIFs).
  - **YouTube cards** with a "Watch with friends" (🍿) button.
  - **Spotify** click‑to‑activate embeds.
  - **Open‑Graph link previews** for any other link.
  - **mp3 cards** that play in the persistent bottom audio bar.
  - Polls and tag chips.
- **Durable images:** uploads are **downscaled to a compact JPEG** before saving
  (`compressPostImage`) so they fit IndexedDB quotas and the Gun relay size limits
  — otherwise large photos persisted locally but were dropped on sync. GIFs are
  left untouched to preserve animation.
- **How:** Media are stored as data URLs (kept small) inside the post record;
  posts sync via Gun and broadcast live via PeerJS.

## 4. Threaded replies

- **What:** Replies are first‑class — **nested sub‑replies** (reply to a reply,
  recursively), **like/react** any reply, and **attach images or GIFs** to replies.
- **How:** A reply is just a post with a `replyTo` parent id; the UI builds the
  tree client‑side and renders recursively.

## 5. Reactions & the web of trust

- **What:** A reaction palette (⭐🔥🚀💜😂👀) plus **👎 dislike** and **😠 angry**.
- **Positive reactions = a soft vouch:** liking someone's post adds a contextual
  **vouch** edge in the web of trust, so genuine positive interaction raises trust.
- **How:** Reactions are idempotent per (person, emoji) sets that CRDT‑merge across
  peers (so everyone converges); trust edges sync over Gun.

## 6. Decentralized moderation (see `MODERATION.md`)

- **What:** Not centralized ban/delete. A **layered local agent**
  (`moderationService.evaluate`) produces an explainable **verdict** — *allow /
  warn / reduce / review / flag / hide* — with the signals, confidence and
  reasoning behind it. Nothing is globally deleted; **you** decide what you see.
- **Contextual web of trust** (`trustService`): trust is per‑community and computed
  from *your* relationships + one hop ("do people I trust vouch for them?"), never
  a global score. Vouch / block / mute / report edges sync over Gun.
- **Community‑defined values:** each Group has a moderation philosophy
  (open / casual / professional / faith / custom) that tunes the agent.
- **Transparency UI:** a verdict chip + signal popover on each post; restricted
  posts collapse with a "Show anyway" reveal; an author Vouch/Report/Mute menu.
- **How:** The agent is a local function combining content lexicons, reputation,
  account history, similarity, community rules and your trust graph — all on device.

## 7. Algorithmic fact‑checking

- **What:** Per‑post **"Fact‑check this"** button, always available from a post's ⋯
  menu. It matches the post against **PolitiFact** and links a result only if one
  qualifies. Each PolitiFact box has an **"Is this in error?"** button that re‑runs
  the match — same article → keep, closer one → update, none → remove.
  **Deliberately no AI in this path:** the most an algorithm can honestly do is rank
  PolitiFact's own claims by lexical evidence, so that's all it does — it links you
  to PolitiFact's wording, it never invents a verdict.
- **How:** PolitiFact's public RSS is pulled through a CORS proxy and indexed
  locally (lazily on first use). Matching is a pure, unit‑tested function
  ([`src/lib/factMatch.ts`](src/lib/factMatch.ts)): extract the post's salient
  tokens, adjacent bigrams and multi‑word entities, then rank claims by
  **IDF‑weighted overlap** with phrase/entity bonuses, accepting a match only above
  a score threshold backed by ≥2 distinct hits (or a phrase hit). Links persist
  per‑post in IndexedDB. No fact‑check server, no model.

## 8. The Companion (on‑device AI)

- **What:** A real language model running **in your browser** via WebLLM/WebGPU —
  private, offline‑capable. It chats, summarizes the feed, explains trends,
  suggests communities, drafts posts, and powers fact‑check keywords.
- **Auto, hardware‑aware download:** on load it inspects RAM + the WebGPU adapter's
  buffer limits and **auto‑selects the best model the device can actually run**,
  then downloads it (cached after first time). A title‑bar indicator shows download
  progress, then "AI ready."
- **Floating dock:** chat inline without leaving the feed; minimize to a bubble and
  restore; it auto‑greets once when the model loads. The full Companion page is
  still there.
- **Resilience:** WebGPU "device lost" crashes are swallowed, a model that crashes
  the GPU is never re‑attempted, and everything falls back to a fast offline
  heuristic engine if there's no WebGPU.
- **How:** WebLLM is dynamically imported; the engine is a lazy, cached singleton.
  When unavailable, instant heuristic tools answer instead.

## 9. Alerts center

- **What:** A notification bell that collects **clickable** alerts — replies and
  reactions on your posts, DMs, watch‑party invites. Clicking one takes you to it:
  the feed **scrolls to and highlights** the post, DMs open Town Square, etc.
  Unread badge, mark‑all‑read, clear; persisted locally.
- **How:** Services raise `alert` events with a route + optional post id;
  `alertsService` stores them in IndexedDB and the bell deep‑links via the router +
  a `focus:post` event.

## 10. Groups (communities)

- **What:** Create, **search, filter** (All / Joined / Created by me), **edit,
  delete, join, leave** groups. Each group links to its own **chatroom**, a
  **filtered feed** (only that group's posts, and you can post straight to it), and
  its own **watch‑with‑friends room**.
- **How:** Groups are local records (synced‑ready); the per‑group feed is a
  client‑side filter on `post.community`; chat and watch rooms are just namespaced
  room ids (`group-<id>`).

## 11. Town Square, DMs & Chatrooms

- **What:** Town Square (the public Swarm Lounge), direct messages, and live
  **chatrooms** with presence, reactions, image sharing, and **peer‑to‑peer
  voice/video**. A floating Swarm Lounge dock lets you chat while scrolling.
- **How:** PeerJS hub‑relay mesh (`chatroomService`, `peerService`) carries
  messages and WebRTC media streams directly between browsers; private chats are
  deliberately kept off the public Gun graph.

## 12. Watch with friends (synced rooms)

- **What:** Watch parties are **rooms, like chatrooms** — one public **Lobby**,
  named public rooms, and **private rooms** (shared by name). Everyone in a room
  shares the same synced YouTube moment; people who join mid‑video jump to the
  current spot.
  - **Shared "Up next" queue:** anyone can queue links; **Play next**, remove, and
    **auto‑advance** when a video ends (the starter advances, to avoid double‑skips).
  - **Room chat** under the video, with optional **mic/camera**.
  - The feed's **"Watch with friends"** button opens a room for that video.
- **How:** Watch‑party state and the queue are scoped by room id and synced over
  PeerJS (`stagesByRoom` / `queuesByRoom`); a single global YouTube player
  (`GlobalWatchPlayer`) docks over the page or floats as a mini‑player and reflects
  only the room you're in.

## 13. Radio & the Jukebox

- **Radio:** browse ~58k live stations from the community-run
  [Radio Browser](https://www.radio-browser.info/) directory — **search by name**,
  filter by **genre** and **country**, and sort by **Popular** or **Trending**.
  Cards show the station logo, country flag, codec/bitrate and vote count. Each
  station has its own **listeners' chat** (keyed to the station's stable id) — tune
  in and listen together. Server mirrors are discovered live (no hardcoded hosts),
  and tuning in registers a click so the directory's popularity stats stay honest.
- **Jukebox room:** drop in mp3s to build an **up‑next queue** that plays through
  the persistent bottom audio bar, with a shared room chat.
- **How:** A single `<audio>` singleton (`audioPlayerService`) with a queue; the
  chat reuses the same room mesh. (Audio of *uploaded* files plays per‑device; the
  chat is the shared layer.)

## 14. Persistent media

- **What:** Play a feed YouTube video and scroll away → it **minimizes to a
  bottom‑right mini player** and keeps playing. Music (radio), the shared mp3
  player, Spotify embeds, and watch parties all persist across navigation, and only
  one audio source plays at a time.
- **How:** Global singleton players (`GlobalFeedVideo`, `GlobalSpotify`,
  `MiniPlayer`, `AudioMiniPlayer`, `GlobalWatchPlayer`) live at the app root; their
  iframe/element is only **repositioned**, never reparented, so playback is
  uninterrupted. A shared `media:play` event enforces one‑at‑a‑time exclusivity.

## 15. Marketplace & self‑custody wallet

- **What:** Buy/sell listings and send/receive **real money on Polygon** (POL +
  USDC) from a wallet whose key never leaves your device. Live **USD conversion
  rates** (CoinGecko) and the USD value of your balances. Prominent disclaimers
  that transactions are irreversible and the app holds no funds.
- **How:** ethers.js talks to keyless, CORS‑enabled public Polygon RPCs with
  failover; the wallet key is stored locally; listings sync over Gun.

## 16. Profiles

- **What:** Customizable **old‑school‑MySpace HTML** profiles (sandboxed), header
  photo, avatar, quote, website, email, phone, optional geolocation, joined
  communities, reputation/badges, and a "preview as visitor" mode.
- **How:** Profiles sync as records over Gun; custom HTML renders in a sandboxed
  shadow DOM; location is fetched on demand via geolocation + a reverse‑geocode API.

## 17. RSS Bot (the open‑web bridge)

- **What:** Topic subscriptions that keep the feed alive with curated feeds:
  news/tech/science/sports/gaming, **YouTube channels**, **TikTok creators**
  (via rss.app), podcasts (resolved by name), Reddit, GitHub releases, a daily
  Bible verse, 3D‑printing, local news, and app CVEs. A rich set is enabled by
  default and seeded into existing users.
- **Robust refresh:** every fetch has a timeout, feeds run with bounded concurrency
  (one slow feed can't hang it), it **dedupes** against what's already on the
  timeline, and shows live progress — "Populating your timeline with RSS feeds ·
  X/Y feeds · N new" — with a note that **you're contributing your device's compute**
  to refresh the network's feed.
- **How:** Feeds (and YouTube/TikTok channel resolution) are fetched through CORS
  proxies, parsed in‑browser with `DOMParser`, posted as "RSS Bot", and persisted
  via Gun so they reach everyone.

## 18. Design system

- **Bliss / Windows‑XP "Luna"** theme (`bliss.css` / `bliss.js`) over Material UI:
  the blue Luna chrome, the Bliss wallpaper, sticky nav and title bar, and a
  mobile‑responsive layout. The whole window is viewport‑height so content scrolls
  internally.

---

## Stability & performance engineering

Real bugs found and fixed — the kind a backend‑less, long‑lived single‑page app
runs into:

- **Scroll could freeze:** failed Polygon RPC providers were never destroyed, so
  their "retry every 1s" loops piled up until the main thread choked. Fix: destroy
  every failed provider and pin a static network so it never polls for detection.
- **Tall pages didn't scroll:** a flexbox `min-height:auto` issue let the content
  column grow past the clipped app window. Fix: `min-height:0` so the scroll
  container engages.
- **Uploaded images vanished:** multi‑MB data URLs blew past IndexedDB/relay
  limits and were dropped on round‑trip. Fix: downscale to a compact JPEG.
- **GPU "device lost":** auto‑picking a model too big crashed WebGPU. Fix:
  GPU‑buffer‑aware conservative selection, swallow the GPU rejections, and never
  re‑attempt a crashing model.
- **Spotify ⇄ mp3 didn't pause each other:** they shared one media id. Fix: distinct
  ids on the shared `media:play` exclusivity bus.
- **MUI crash on boot:** `background.default: "transparent"` is rejected by MUI's
  color parser. Fix: a real color.

---

## Deployment model

```
npm run build           # Vite → dist/ (static)
push source → main      # the source of truth
publish dist/ → gh-pages branch (force) → GitHub Pages serves the world
```

The same GitHub repository is **both the product and the host**. A complete social
network that fits in a folder and costs **$0/month** to keep alive.

---

## Honest limitations

- Public Gun relays and the PeerJS hub are best‑effort community infrastructure —
  delivery isn't guaranteed and there's no global ordering.
- Reaching non‑CORS web resources (RSS, PolitiFact, prices) depends on public CORS
  proxies, which can rate‑limit or go down.
- The on‑device LLM needs WebGPU; without it, the fast heuristic engine stands in.
- Uploaded‑file audio in the Jukebox plays per‑device (the chat is the shared part);
  true synchronized streaming of large uploaded blobs isn't practical P2P.
- Crypto features move real money on Polygon and are irreversible — by design the
  app never holds your keys or funds.
