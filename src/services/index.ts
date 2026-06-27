// ============================================================
//  services/index.ts — composition root. Boots every service in
//  the right order and brings the P2P layer online. The feed is
//  intentionally empty until real posts arrive from you or peers —
//  no sample/AI-generated content is injected.
// ============================================================
import { storage, DEFAULT_SETTINGS, requestPersistentStorage } from "./storage";
import { identityService } from "./identityService";
import { feedService } from "./feedService";
import { companionService } from "./companionService";
import { communityService } from "./communityService";
import { presenceService } from "./presenceService";
import { geoService } from "./geoService";
import { peerService } from "./peerService";
import { rssService } from "./rssService";
import { gunService } from "./gunService";
import { profileService } from "./profileService";
import { trustService } from "./trustService";
import { bestModelForHardware, isWebGPU } from "./companionService";
import { audioPlayerService } from "./audioPlayerService";
import { factCheckService } from "./factCheckService";
import { changelogService } from "./changelogService";
import { alertsService } from "./alertsService";
import { isOff } from "@/lib/flags";
import { initEmbeddings } from "@/lib/embeddings";
import type { AppSettings } from "@/types";

export interface BootResult { onboarded: boolean; settings: AppSettings }

export async function boot(): Promise<BootResult> {
  // Make storage durable so an installed PWA keeps you signed in across launches
  // (prevents the browser from evicting the IndexedDB that holds your identity).
  void requestPersistentStorage();
  const loaded = await storage.loadSettings();
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...loaded };
  // One-time: migrate the old two-state nsfw/profanity toggles → three-state modes,
  // preserving each install's effective filtering. Runs only for pre-migration saves.
  const old = loaded as any;
  if (old && old.nsfwMode === undefined && (old.filterNsfw !== undefined || old.censorProfanity !== undefined)) {
    settings.nsfwMode = old.filterNsfw === false ? "show" : "screen";
    settings.profanityMode = (old.filterNsfw || old.censorProfanity) ? "screen" : "show";
  }
  // One-time: auto-translate to English is now ON by default (it shipped briefly as
  // off). Flip existing installs once, then respect whatever the user sets after.
  if (!settings.autoTranslateInit) { settings.autoTranslate = true; settings.autoTranslateInit = true; }
  // Auto-enable the on-device LLM on WebGPU-capable devices (unless the user
  // explicitly opted out in Settings) — the model downloads automatically.
  if (typeof navigator !== "undefined" && (navigator as any).gpu && !settings.llmOptOut) {
    settings.useWebLLM = true;
  }
  // Hardware-aware auto-selection: until the user explicitly picks a model,
  // choose the best one this device can run, then download it on load.
  if (isWebGPU() && !settings.llmOptOut && settings.llmAuto !== false) {
    try {
      const best = await bestModelForHardware();
      if (best.id !== settings.llmModel) settings.llmModel = best.id;
    } catch { /* keep current model */ }
  }
  await storage.saveSettings(settings);
  // Point the companion at the resolved model + LLM preference NOW — otherwise it
  // keeps its built-in default (the tiny model) and the UI ends up promising a
  // bigger model than the one that actually loads (worse, more error-prone answers).
  companionService.configure(settings.useWebLLM, settings.llmModel);

  // Load the Rust/WASM embeddings core before the feed starts embedding posts,
  // so create/RSS/Nostr embedding + feed ranking take the fast path. Non-fatal:
  // on failure it silently falls back to the pure-TS implementation.
  await initEmbeddings();

  await feedService.init();
  audioPlayerService.init();           // shared mp3 player joins media exclusivity
  await alertsService.load();          // notification center (clickable alerts)
  await factCheckService.loadLinks();  // restore user-linked PolitiFact fact-checks
  await trustService.load();           // load my web-of-trust edges
  await profileService.loadCache();    // warm cached peer profiles (viewable offline)
  await purgeSeededPosts();            // remove demo posts left by earlier builds
  // Prune the RSS/Nostr cache for storage hygiene — but OFF the boot critical path.
  // recentPosts() now bounds its own read, so an oversized cache no longer slows the
  // feed; running prune's full-store scan during first paint + the relay flood only
  // stole main-thread time from the initial load. Defer it past the opening burst.
  if (!isOff("prune")) setTimeout(() => storage.pruneEphemeralPosts().catch(() => {}), 15000);
  const me = await identityService.load();
  companionService.configure(settings.useWebLLM, settings.llmModel);
  // "Just download it" — start fetching the model immediately (best-effort,
  // cached by WebLLM after the first time). Progress shows in the UI.
  // WebLLM is NOT preloaded on boot — importing + compiling it on the main thread is
  // what froze the UI ("page unresponsive"). It now loads ON DEMAND the first time you
  // use the companion (ask / comment / pick-model) and runs in a Web Worker
  // (llm.worker.ts), so neither boot nor the feed ever blocks on the model.

  if (me) {
    presenceService.setStatus(settings.presenceStatus);
    if (!isOff("geo")) geoService.init().catch(() => {}); // coarse location for the network map (cache → IP fallback)
    if (!isOff("communities")) await communityService.seedDefaults();
    if (!isOff("gun")) gunService.start();   // durable cross-user persistence + sync (posts, swarm, profiles)
    if (!isOff("peer")) peerService.start();
    if (!isOff("publish")) profileService.publishSelf().catch(() => {}); // share my public profile
    // The feed loads from the MESH: the always-on relay fetches RSS and seeds it into
    // the Gun graph, and we receive it via gunService — so a fresh node loads what the
    // network already has (instantly, if anyone fetched in the last hour) instead of
    // re-fetching ~85 feeds itself, which is what froze "building a new feed". We only
    // seed the default topic SUBSCRIPTIONS here (for the Topics UI + the "For You"
    // filter); the sole client-side fetch is the manual "Refresh" button in Topics.
    if (!isOff("rss")) rssService.seedDefaults().catch(() => {});
    if (!isOff("changelog")) changelogService.refresh().catch(() => {}); // repo commits → timeline activity
    if (settings.showFactChecks && !isOff("factcheck")) factCheckService.refresh().catch(() => {}); // PolitiFact index
    if (settings.nostrEnabled !== false && !isOff("nostr")) {
      import("./nostrService").then(({ nostrService }) => {
        nostrService.start().catch(() => {});
      }).catch(() => {});
    }
    if (!isOff("prune")) setInterval(() => storage.pruneEphemeralPosts().catch(() => {}), 10 * 60 * 1000); // keep the RSS/Nostr cache bounded during long sessions
  }
  return { onboarded: !!me, settings };
}

/** Called right after onboarding finishes (identity just created). */
export async function onOnboarded() {
  if (!isOff("communities")) await communityService.seedDefaults();
  if (!isOff("gun")) gunService.start();
  if (!isOff("peer")) peerService.start();
  if (!isOff("rss")) rssService.seedDefaults().catch(() => {}); // feed loads from the mesh (relay-seeded Gun), not a client refetch
  if (!isOff("changelog")) changelogService.refresh().catch(() => {});
  if (!isOff("nostr")) {
    import("./nostrService").then(({ nostrService }) => {
      nostrService.start().catch(() => {});
    }).catch(() => {});
  }
}

// Earlier builds seeded sample posts; strip them so the feed only ever shows
// real content from you and other people on the network.
async function purgeSeededPosts() {
  // ONE-TIME: demo/cache posts only existed in old builds. Scanning EVERY post on
  // every boot froze startup once the corpus grew — do it once, then never again.
  if (await storage.kvGet("purgedSeeds")) return;
  for (const p of await storage.allPosts()) {
    if (p.author.startsWith("demo_") || p.source === "cache") await storage.deletePost(p.id);
  }
  await storage.kvSet("purgedSeeds", true);
}
