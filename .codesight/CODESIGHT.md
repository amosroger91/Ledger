# ledger — AI Context Map

> **Stack:** express | none | react | typescript

> 21 routes | 0 models | 51 components | 48 lib files | 12 env vars | 1 middleware | 48 events | 0% test coverage
> **Token savings:** this file is ~5,800 tokens. Without it, AI exploration would cost ~60,300 tokens. **Saves ~54,500 tokens per conversation.**
> **Last scanned:** 2026-06-26 22:55 — re-run after significant changes

---

# Routes

## CRUD Resources

- **`/api/feeds`** GET | POST | GET/:id | DELETE/:id → Feed

## Other Routes

- `GET` `/` params() [auth, db]
- `GET` `/health` params() [auth, db]
- `GET` `/api/stats` params() [auth, db]
- `GET` `/api/timeline` params() [auth, db]
- `GET` `/api/posts` params() [auth, db]
- `GET` `/api/profiles/:pk` params(pk) [auth, db]
- `GET` `/api/nft` params() [auth, db]
- `GET` `/api/nft/:id` params(id) [auth, db]
- `GET` `/api/rss/youtube/:channelId` params(channelId) [auth, db]
- `POST` `/api/refresh` params() [auth, db]
- `POST` `/api/contrib` params() [auth, db]
- `GET` `/api/points/:pk` params(pk) [auth, db]
- `GET` `/api/leaderboard` params() [auth, db]
- `GET` `/api/whoami` params() [auth, db]
- `GET` `/api/node` params() [auth, db]
- `GET` `/api/consent` params() [auth, db]
- `GET` `/dashboard` params() [auth, db]

---

# Components

- **App** — `src\App.tsx`
- **AboutView** — `src\components\about\AboutView.tsx`
- **ChatroomView** — props: fullWidth — `src\components\chatroom\ChatroomView.tsx`
- **Background** — `src\components\common\Background.tsx`
- **GifPicker** — props: open, onClose, onPick — `src\components\common\GifPicker.tsx`
- **GlassCard** — props: sx — `src\components\common\GlassCard.tsx`
- **MessageBody** — props: text, media — `src\components\common\MessageBody.tsx`
- **RoomChat** — props: roomId, title, media, height — `src\components\common\RoomChat.tsx`
- **StationLogo** — props: src, size, radius, fallback — `src\components\common\StationLogo.tsx`
- **UserAvatar** — props: pk, name, avatar, size, sx — `src\components\common\UserAvatar.tsx`
- **CommunitiesView** — `src\components\communities\CommunitiesView.tsx`
- **CompanionView** — `src\components\companion\CompanionView.tsx`
- **Composer** — props: community — `src\components\feed\Composer.tsx`
- **FeedView** — `src\components\feed\FeedView.tsx`
- **HtmlComposer** — props: open, onClose, onPost — `src\components\feed\HtmlComposer.tsx`
- **LinkCard** — props: url — `src\components\feed\PostCard.tsx`
- **SafeImage** — props: src, alt, sx, expand — `src\components\feed\PostCard.tsx`
- **PostCard** — props: post, reason, replies, replyMap, verdict, expanded — `src\components\feed\PostCard.tsx`
- **PostView** — `src\components\feed\PostView.tsx`
- **WhyRecommended** — props: reason, post, verdict, onBlock — `src\components\feed\WhyRecommended.tsx`
- **AiSplash** — `src\components\layout\AiSplash.tsx`
- **AppShell** — `src\components\layout\AppShell.tsx`
- **AudioMiniPlayer** — `src\components\layout\AudioMiniPlayer.tsx`
- **FloatingDocks** — `src\components\layout\FloatingDocks.tsx`
- **GeoConsent** — `src\components\layout\GeoConsent.tsx`
- **GlobalFeedVideo** — `src\components\layout\GlobalFeedVideo.tsx`
- **GlobalSearch** — props: compact — `src\components\layout\GlobalSearch.tsx`
- **GlobalSpotify** — `src\components\layout\GlobalSpotify.tsx`
- **GlobalWatchPlayer** — `src\components\layout\GlobalWatchPlayer.tsx`
- **ImageLightbox** — `src\components\layout\ImageLightbox.tsx`
- **InstallButton** — props: compact — `src\components\layout\InstallButton.tsx`
- **InstallHelpDialog** — props: open, onClose — `src\components\layout\InstallHelpDialog.tsx`
- **MiniPlayer** — `src\components\layout\MiniPlayer.tsx`
- **PresenceList** — `src\components\layout\PresenceList.tsx`
- **ReloadGuardDialog** — `src\components\layout\ReloadGuardDialog.tsx`
- **ListenView** — `src\components\listen\ListenView.tsx`
- **WatchParty** — `src\components\listen\WatchParty.tsx`
- **MarketView** — `src\components\market\MarketView.tsx`
- **GlobalChatView** — `src\components\messages\GlobalChatView.tsx`
- **MessagesView** — props: fullWidth — `src\components\messages\MessagesView.tsx`
- **TownSquareView** — `src\components\messages\TownSquareView.tsx`
- **NetworkView** — `src\components\network\NetworkView.tsx`
- **Onboarding** — `src\components\onboarding\Onboarding.tsx`
- **DeviceLinkReceiver** — props: code, secret — `src\components\profile\DeviceLinkReceiver.tsx`
- **DeviceLoginDialog** — props: open, onClose — `src\components\profile\DeviceLoginDialog.tsx`
- **ProfileView** — `src\components\profile\ProfileView.tsx`
- **QrScanDialog** — props: open, onClose, onFound — `src\components\profile\QrScanDialog.tsx`
- **SettingsView** — `src\components\settings\SettingsView.tsx`
- **RelayFeeds** — `src\components\topics\RelayFeeds.tsx`
- **TopicsView** — `src\components\topics\TopicsView.tsx`
- **WalletView** — `src\components\wallet\WalletView.tsx`

---

# Libraries

- `server\src\dashboard.js` — function dashboardHtml: () => void, const CONSENT_TEXT
- `server\src\gun\relay.js` — function startGunRelay: (server) => void, function getGun
- `server\src\identity.js` — function loadIdentity: () => void, const identity
- `server\src\lib\crypto.js`
  - function bufToB64url: (buf) => void
  - function b64urlToBuf: (s) => void
  - function canonical: (obj) => void
  - function signRecord: (data, pk, jwk) => void
  - function verifyRecord: (rec) => void
  - function fingerprint: (pk) => void
- `server\src\lib\hash.js` — function fnv1a: (str) => void, function stableId
- `server\src\lib\http.js` — function fetchText: (url, {...}, headers, proxy) => void, function mapLimit: (items, limit, worker) => void
- `server\src\node\contributor.js` — function startContributor: () => void, function nodeStats: () => void
- `server\src\publisher.js`
  - function publishedCount: () => void
  - function publishNewRssToGun: () => void
  - function startPublisher: () => void
- `server\src\routes.js` — function buildRouter: () => void
- `server\src\rss\feeds.js`
  - function withId: (f) => void
  - function youtubeFeed: ({...}, playlistId, title, topic) => void
  - function rsshubFeed: (route, {...}, topic) => void
  - const DEFAULT_FEEDS
- `server\src\rss\normalize.js` — function itemToPost: (item, feed) => void
- `server\src\rss\resolvers.js`
  - function resolveYouTube: (ref) => void
  - function resolvePodcast: (term) => void
  - function fetchCVE: (app) => void
- `src\lib\crypto.ts`
  - function bufToB64url: (buf) => string
  - function b64urlToBuf: (s) => ArrayBuffer
  - function canonical: (obj) => string
  - function generateKeyMaterial: () => Promise<KeyMaterial>
  - function signRecord: (data, pk, jwk) => Promise<Signed<T>>
  - function verifyRecord: (rec) => Promise<boolean>
  - _...2 more_
- `src\lib\diag.ts`
  - function diag: (label, extra?) => void
  - function diagTime: (label, fn) => void
  - function armHeartbeat: (thresholdMs) => void
  - const DIAG
- `src\lib\embeddings.ts`
  - function embed: (text) => number[]
  - function cosine: (a, b) => number
  - function topTerms: (text, n) => string[]
  - class InterestProfile
  - const EMBED_DIM
- `src\lib\emoticons.ts` — function emojify: (text) => string
- `src\lib\events.ts`
  - function toast
  - interface LedgerEvents
  - const bus
- `src\lib\factMatch.ts`
  - function contentTokens: (text) => string[]
  - function extractFeatures: (text) => Features
  - function buildIdf: (claims) => Map<string, number>
  - function rankFactChecks: (text, index, idf?, number>) => Ranked<T> | null
  - interface Features
  - interface Ranked
  - _...4 more_
- `src\lib\feedRank.ts`
  - function rankFeed: (recent, ctx) => RankResult
  - interface RankOpts
  - interface RankContext
  - interface RankResult
- `src\lib\flags.ts` — function isOff: (name) => boolean, const ANY_OFF
- `src\lib\htmlEntities.ts` — function decodeEntities: (input) => string
- `src\lib\id.ts` — function newId
- `src\lib\image.ts`
  - function readDataUrl: (file) => Promise<string>
  - function loadImg: (src) => Promise<HTMLImageElement>
  - function compressBanner: (file, maxW) => Promise<string>
  - function compressAvatar: (file, size) => Promise<string>
  - function compressPostImage: (file, maxDim, quality) => Promise<string>
- `src\lib\moderationCore.ts`
  - function evaluateModeration: (text, ctx, tw) => ModerationVerdict
  - interface EvalContext
  - interface TrustInput
- `src\lib\ping.ts` — function playPing: () => void
- `src\lib\postType.ts`
  - function postSignals: (p) => PostSignals
  - function matchesFilter: (p, f) => boolean
  - function matchesQuery: (p, query) => boolean
  - interface PostSignals
  - type ContentFilter
- `src\lib\pwa.ts`
  - function isStandalone: () => boolean
  - function isIOS: () => boolean
  - function promptInstall: () => Promise<"accepted" | "dismissed" | null>
  - function useInstall: () => void
  - function registerServiceWorker: () => void
  - function canPromptInstall
- `src\lib\records.ts`
  - function isBotAuthor: (pk) => boolean
  - function signPost: (p, jwk) => Promise<void>
  - function postIsAuthentic: (p) => Promise<boolean>
  - function signProfile: (p, jwk) => Promise<void>
  - function profileIsAuthentic: (p) => Promise<boolean>
  - function signTrust: (e, jwk) => Promise<void>
  - _...3 more_
- `src\lib\time.ts` — function relativeTime: (ts) => string, function clockTime: (ts) => string
- `src\lib\trustMath.ts`
  - function myRelation: (edges, me, to) => TrustKind | null
  - function isMuted: (edges, me, to) => boolean
  - function isBlocked: (edges, me, to) => boolean
  - function vouchCount: (edges, to) => number
  - function score: (edges, me, to, community?) => number
- `src\lib\unloadGuard.ts` — function bypassUnloadGuard: () => void, function setUnloadGuard: (key, active) => void
- `src\lib\useChatScroll.ts` — function useChatScroll: (count) => void
- `src\lib\watchGuard.ts`
  - function setActiveVideo: (key, info) => void
  - function activeVideo: () => ActiveVideo | null
  - type ActiveVideo
- `src\lib\youtube.ts` — function openOnYouTube: (videoId, seconds) => void
- `src\services\chatMedia.ts`
  - function getState: () => void
  - function getLocalStream: () => void
  - function hasMedia: () => void
  - function setMedia: (want) => Promise<MediaStream | null>
  - function stopLocal: () => void
- `src\services\chatroomService.ts`
  - function roomPeerId: (roomId) => string
  - function joinChatroom: (opts) => void
  - interface RoomMember
  - interface RoomIdentity
  - interface RoomHandlers
- `src\services\companionService.ts`
  - function isWebGPU: () => boolean
  - function bestModelForHardware: () => Promise<
  - function modelReady: (id) => boolean
  - interface LlmModel
  - const MODELS: LlmModel[]
  - const companionService
- `src\services\deviceTransferService.ts`
  - function buildLink: (code, secret) => string
  - function parseLink: (hash) => void
  - interface HostHandle
  - type HostStatus
  - const deviceTransferService
- `src\services\gifService.ts` — function searchGifs: (query, limit) => Promise<Gif[]>, interface Gif
- `src\services\globalChatService.ts`
  - function joinGlobalChat: (handlers) => GlobalChatController
  - function myGlobalAuthor: () => Promise<string>
  - interface GlobalChatHandlers
  - interface GlobalChatController
  - const GLOBAL_CHANNEL_ID
- `src\services\index.ts`
  - function boot: () => Promise<BootResult>
  - function onOnboarded: () => void
  - interface BootResult
- `src\services\listenTogetherService.ts`
  - function flagOf: (cc?) => string
  - interface Station
  - interface BrowseOpts
  - const GENRES
  - const COUNTRIES: { code: string; name: string }[]
  - const listenTogetherService
- `src\services\nsfwService.ts`
  - function isAdultText: (text?) => boolean
  - function censorText: (text?) => string
  - function isAdultImage: (src) => Promise<boolean>
  - const nsfwService
- `src\services\rssService.ts`
  - function topicSlug
  - interface Feed
  - interface RssConfig
  - interface RssItem
  - type FeedKind
  - const TOPIC_FEEDS: Record<string, Feed[]>
  - _...2 more_
- `src\services\spamService.ts`
  - function looksObviouslyJunk: (text) => boolean
  - function isJunk: (id, text) => boolean
  - function classify: (posts) => void
  - function junkSnapshot: () => string[]
  - const spamService
- `src\services\storage.ts`
  - function requestPersistentStorage: () => Promise<boolean>
  - function readSettingsSync: () => AppSettings | undefined
  - const storage
  - const DEFAULT_SETTINGS: AppSettings
- `src\services\translateService.ts`
  - function langName: (code) => string
  - function probablyNotEnglish: (text) => boolean
  - const translateService
- `src\services\watchRoomService.ts`
  - function isPrivate
  - function roomLabel
  - const LOBBY
  - const watchRoomService

---

# Config

## Environment Variables

- `BASE_URL` **required** — src\components\about\AboutView.tsx
- `CORS_ORIGIN` (has default) — server\.env.example
- `GUN_DATA_DIR` (has default) — server\.env.example
- `GUN_PEERS` (has default) — server\.env.example
- `GUN_ROOT` (has default) — server\.env.example
- `PORT` (has default) — server\.env.example
- `PROD` **required** — src\lib\pwa.ts
- `RSS_CONCURRENCY` (has default) — server\.env.example
- `RSS_FETCH_TIMEOUT_MS` (has default) — server\.env.example
- `RSS_MAX_ITEMS` (has default) — server\.env.example
- `RSS_REFRESH_MS` (has default) — server\.env.example
- `RSSHUB_BASE` (has default) — server\.env.example

## Config Files

- `server\.env.example`
- `tsconfig.json`
- `vite.config.ts`

## Key Dependencies

- react: ^18.3.1

---

# Middleware

## cors
- cors — `server\src\index.js`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src\services\storage.ts` — imported by **19** files
- `server\src\config.js` — imported by **10** files
- `src\services\identityService.ts` — imported by **10** files
- `src\services\feedService.ts` — imported by **6** files
- `src\services\nostrService.ts` — imported by **5** files
- `server\src\store\index.js` — imported by **4** files
- `src\services\trustService.ts` — imported by **4** files
- `server\src\gun\relay.js` — imported by **3** files
- `server\src\identity.js` — imported by **3** files
- `src\services\profileService.ts` — imported by **3** files
- `src\services\presenceService.ts` — imported by **3** files
- `server\src\contrib\points.js` — imported by **2** files
- `server\src\lib\crypto.js` — imported by **2** files
- `server\src\rss\aggregator.js` — imported by **2** files
- `server\src\node\contributor.js` — imported by **2** files
- `server\src\publisher.js` — imported by **2** files
- `server\src\rss\feeds.js` — imported by **2** files
- `server\src\lib\http.js` — imported by **2** files
- `server\src\lib\hash.js` — imported by **2** files
- `src\components\feed\PostCard.tsx` — imported by **2** files

## Import Map (who imports what)

- `src\services\storage.ts` ← `src\services\alertsService.ts`, `src\services\changelogService.ts`, `src\services\chatroomService.ts`, `src\services\communityService.ts`, `src\services\companionService.ts` +14 more
- `server\src\config.js` ← `server\src\contrib\points.js`, `server\src\gun\relay.js`, `server\src\identity.js`, `server\src\index.js`, `server\src\node\contributor.js` +5 more
- `src\services\identityService.ts` ← `src\services\communityService.ts`, `src\services\deviceTransferService.ts`, `src\services\feedService.ts`, `src\services\gunService.ts`, `src\services\index.ts` +5 more
- `src\services\feedService.ts` ← `src\services\changelogService.ts`, `src\services\gunService.ts`, `src\services\index.ts`, `src\services\nostrService.ts`, `src\services\peerService.ts` +1 more
- `src\services\nostrService.ts` ← `src\services\feedService.ts`, `src\services\feedService.ts`, `src\services\globalChatService.ts`, `src\services\index.ts`, `src\services\index.ts`
- `server\src\store\index.js` ← `server\src\gun\relay.js`, `server\src\publisher.js`, `server\src\routes.js`, `server\src\rss\aggregator.js`
- `src\services\trustService.ts` ← `src\services\feedService.ts`, `src\services\gunService.ts`, `src\services\index.ts`, `src\services\moderationService.ts`
- `server\src\gun\relay.js` ← `server\src\contrib\points.js`, `server\src\index.js`, `server\src\publisher.js`
- `server\src\identity.js` ← `server\src\index.js`, `server\src\node\contributor.js`, `server\src\routes.js`
- `src\services\profileService.ts` ← `src\services\feedService.ts`, `src\services\gunService.ts`, `src\services\index.ts`

---

# Events & Queues

- `feed:updated` [event] — `src/components/feed/FeedView.tsx`
- `feed:post` [event] — `src/components/feed/FeedView.tsx`
- `focus:post` [event] — `src/components/feed/FeedView.tsx`
- `rss:refreshing` [event] — `src/components/feed/FeedView.tsx`
- `rss:progress` [event] — `src/components/feed/FeedView.tsx`
- `feed:refresh` [event] — `src/components/feed/FeedView.tsx`
- `companion:open` [event] — `src/components/feed/FeedView.tsx`
- `spotify:play` [event] — `src/components/feed/PostCard.tsx`
- `media:play` [event] — `src/components/feed/PostCard.tsx`
- `audio:now` [event] — `src/components/feed/PostCard.tsx`
- `feedvideo:play` [event] — `src/components/feed/PostCard.tsx`
- `watch:start` [event] — `src/components/feed/PostCard.tsx`
- `lightbox:open` [event] — `src/components/feed/PostCard.tsx`
- `companion:prompt` [event] — `src/components/feed/PostCard.tsx`
- `alerts:updated` [event] — `src/components/layout/AppShell.tsx`
- `companion:model` [event] — `src/components/layout/AppShell.tsx`
- `dock:state` [event] — `src/components/layout/AppShell.tsx`
- `dock:toggle` [event] — `src/components/layout/AppShell.tsx`
- `companion:thinking` [event] — `src/components/layout/FloatingDocks.tsx`
- `notify` [event] — `src/components/layout/GlobalWatchPlayer.tsx`
- `stage:out` [event] — `src/components/layout/GlobalWatchPlayer.tsx`
- `watch:queue-out` [event] — `src/components/layout/GlobalWatchPlayer.tsx`
- `alert` [event] — `src/components/layout/GlobalWatchPlayer.tsx`
- `stage:in` [event] — `src/components/layout/GlobalWatchPlayer.tsx`
- `watchroom:change` [event] — `src/components/layout/GlobalWatchPlayer.tsx`
- `watch:queue` [event] — `src/components/listen/WatchParty.tsx`
- `chat:message` [event] — `src/components/messages/MessagesView.tsx`
- `swarm:publish` [event] — `src/components/messages/MessagesView.tsx`
- `trust:update` [event] — `src/components/settings/SettingsView.tsx`
- `toast` [event] — `src/lib/events.ts`
- `audio:queue` [event] — `src/services/audioPlayerService.ts`
- `audio:time` [event] — `src/services/audioPlayerService.ts`
- `post:publish` [event] — `src/services/changelogService.ts`
- `factcheck:ready` [event] — `src/services/factCheckService.ts`
- `feed:react-out` [event] — `src/services/feedService.ts`
- `profile:publish` [event] — `src/services/gunService.ts`
- `profile:request` [event] — `src/services/gunService.ts`
- `market:publish` [event] — `src/services/gunService.ts`
- `trust:publish` [event] — `src/services/gunService.ts`
- `identity:ready` [event] — `src/services/identityService.ts`
- `listen:now` [event] — `src/services/listenTogetherService.ts`
- `market:update` [event] — `src/services/marketplaceService.ts`
- `profile:update` [event] — `src/services/nostrService.ts`
- `open` [event] — `src/services/peerService.ts`
- `peer:open` [event] — `src/services/peerService.ts`
- `peer:connected` [event] — `src/services/peerService.ts`
- `peer:disconnected` [event] — `src/services/peerService.ts`
- `presence:update` [event] — `src/services/presenceService.ts`

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 2 test files found

---

# CI/CD Pipelines

## GitHub Actions (1 workflow)

| Workflow | Triggers | Jobs | Deploy | Environments |
|---|---|---|---|---|
| Deploy to GitHub Pages | push, workflow_dispatch | 2 | — | github-pages |

### Deploy to GitHub Pages

> `.github/workflows/deploy.yml`

> Concurrency: `pages`

- **build** on `ubuntu-latest` — 6 steps
  - `actions/checkout@v4`
  - `actions/setup-node@v4`
  - `actions/configure-pages@v5`
  - `actions/upload-pages-artifact@v3`
- **deploy** on `ubuntu-latest` — 1 steps (needs: build)
  - `actions/deploy-pages@v4`

---
_Source: .github/workflows/deploy.yml_
_Generated by codesight-cicd-plugin_

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_