// ============================================================
//  listenTogetherService — synchronized media rooms (the flagship
//  "Spotify Jam + Discord Voice + Watch Party"). Powered by the free,
//  community-run Radio Browser directory (https://www.radio-browser.info/),
//  which indexes ~58k internet-radio stations with votes, tags, country
//  and codec metadata.
//
//  Two things matter for using Radio Browser correctly:
//    1. Don't hardcode a mirror. The public API is a pool of mirrors
//       behind `all.api.radio-browser.info`; individual servers come and
//       go. We resolve the live list once, pick one at random (their
//       recommended load-balancing), and fail over to the rest.
//    2. Be a good citizen: when a user actually tunes in, ping the
//       station's /url/{uuid} endpoint so the directory's click/popularity
//       stats stay meaningful. (We can't set a custom User-Agent from the
//       browser — it's a forbidden header — so we just identify via origin.)
//
//  Playback is a singleton <audio>; the host's position is the clock for
//  synced rooms (Phase 2). Local playback works standalone today.
// ============================================================
import { bus } from "@/lib/events";

// Discovery endpoint — round-robin DNS over every live mirror.
const DISCOVERY = "https://all.api.radio-browser.info/json/servers";
// Seed used only if discovery itself is unreachable.
const SEED = ["https://de1.api.radio-browser.info"];

/** A playable station, normalized from a Radio Browser search row. */
export interface Station {
  uuid: string;        // stationuuid — stable id, used for chat rooms & click pings
  name: string;
  url: string;         // resolved https stream
  genre: string;       // primary tag, for compact display
  tags: string[];
  country: string;
  countryCode: string; // ISO-3166 alpha-2, uppercase
  language: string;
  codec: string;       // MP3 / AAC / OGG …
  bitrate: number;     // kbps (0 = unknown)
  votes: number;
  clickcount: number;
  favicon: string;     // station logo (may 404 — callers fall back)
  homepage: string;
}

/** Curated genre chips — a US-leaning radio dial. All are real, well-populated
 *  Radio Browser tags (verified station counts), ordered roughly by appeal.
 *  Free-text search covers anything outside this set. */
export const GENRES = [
  "country", "rock", "classic rock", "hip hop", "rap", "metal", "pop",
  "christian", "gospel", "top 40", "80s", "90s", "oldies", "alternative",
  "punk", "blues", "soul", "dance", "sports", "talk", "news",
];

/** A short, friendly country picker (codes are ISO-3166 alpha-2). */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "", name: "Worldwide" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "JP", name: "Japan" },
];

/** ISO country code → flag emoji (regional indicator pair). */
export function flagOf(cc?: string): string {
  if (!cc || cc.length !== 2) return "🌐";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

export interface BrowseOpts {
  q?: string;                          // name search (overrides sort/tag)
  tag?: string;                        // exact tag filter
  country?: string;                    // ISO-3166 alpha-2 filter
  sort?: "popular" | "trending";       // votes vs. recent click trend
  limit?: number;
}

// ---- mirror pool ----
let servers: string[] | null = null;   // resolved, shuffled https mirrors
let base: string | null = null;        // last mirror that answered

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

async function ensureServers(): Promise<string[]> {
  if (servers && servers.length) return servers;
  try {
    const r = await fetch(DISCOVERY, { cache: "no-store", headers: { Accept: "application/json" } });
    if (r.ok) {
      const list = (await r.json()) as { name?: string }[];
      const names = Array.from(new Set(list.map((s) => s.name).filter(Boolean) as string[]));
      if (names.length) return (servers = shuffle(names.map((n) => `https://${n}`)));
    }
  } catch {}
  return (servers = [...SEED]);
}

/** GET a directory path, preferring the last good mirror and failing over. */
async function apiGet(path: string): Promise<any> {
  const list = await ensureServers();
  const order = base ? [base, ...list.filter((m) => m !== base)] : list;
  for (const m of order) {
    try {
      const r = await fetch(m + path, { cache: "no-store", headers: { Accept: "application/json" } });
      if (r.ok) { base = m; return r.json(); }
    } catch {}
  }
  servers = null; base = null;          // force re-discovery next time
  throw new Error("Radio directory unreachable");
}

/** Tell the directory a station was actually played (popularity signal). */
function registerClick(uuid: string) {
  if (uuid) apiGet(`/json/url/${uuid}`).catch(() => {});
}

/** Normalize + filter a raw search response down to playable stations. */
function mapStations(rows: any[], preferTag?: string): Station[] {
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const s of rows || []) {
    const url: string = s.url_resolved || s.url || "";
    if (!/^https:\/\//i.test(url)) continue;     // we're served over https — no mixed content
    if (s.lastcheckok === 0) continue;           // skip stations the directory knows are down
    if (s.hls === 1) continue;                   // a plain <audio> can't play HLS playlists
    const uuid: string = s.stationuuid || "";
    if (!uuid || seen.has(uuid)) continue;
    seen.add(uuid);
    const tags = String(s.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
    out.push({
      uuid,
      name: (s.name || "Unknown").replace(/\s+/g, " ").trim().slice(0, 60),
      url,
      genre: preferTag || tags[0] || "radio",
      tags,
      country: s.country || "",
      countryCode: String(s.countrycode || "").toUpperCase(),
      language: String(s.language || "").split(",")[0].trim(),
      codec: String(s.codec || "").toUpperCase(),
      bitrate: s.bitrate || 0,
      votes: s.votes || 0,
      clickcount: s.clickcount || 0,
      favicon: s.favicon || "",
      homepage: s.homepage || "",
    });
  }
  return out;
}

let audio: HTMLAudioElement | null = null;
let volume = 0.6;
let current: Station | null = null;
let paused = false;

function announce() {
  bus.emit("listen:now", {
    station: current
      ? { name: current.name, genre: current.genre, url: current.url, favicon: current.favicon, flag: flagOf(current.countryCode) }
      : null,
    playing: !!audio && !paused,
  });
}

class ListenTogetherService {
  /** Run a station query. Name search wins; otherwise filter by tag/country
   *  and order by popularity (votes) or trend (recent clicks). */
  async browse(opts: BrowseOpts = {}): Promise<Station[]> {
    const p = new URLSearchParams();
    p.set("hidebroken", "true");
    // Over-fetch: the https-only / non-HLS filter below trims the raw rows
    // (many top stations are http or HLS), so ask for more to fill the grid.
    p.set("limit", String(opts.limit ?? 100));
    p.set("reverse", "true");
    const q = opts.q?.trim();
    if (q) {
      p.set("name", q);
      p.set("order", "votes");
    } else {
      p.set("order", opts.sort === "trending" ? "clicktrend" : "votes");
      if (opts.tag) p.set("tag", opts.tag);
      if (opts.country) p.set("countrycode", opts.country);
    }
    const rows = await apiGet(`/json/stations/search?${p.toString()}`);
    return mapStations(rows, opts.tag);
  }

  async play(station: Station): Promise<boolean> {
    this.stop(true);
    current = station; paused = false;
    audio = new Audio(station.url); audio.volume = volume;
    audio.onended = () => announce();
    try {
      await audio.play();
      announce();
      bus.emit("media:play", { id: "radio" });
      registerClick(station.uuid);
      return true;
    } catch {
      // Blocked or unplayable — tear down so we don't leave a phantom "live"
      // station in the mini-player when nothing is actually playing.
      if (audio) { try { audio.pause(); } catch {} audio.src = ""; audio = null; }
      current = null; paused = false;
      announce();
      return false;
    }
  }
  pause() { if (audio) { try { audio.pause(); } catch {} paused = true; announce(); } }
  async resume(): Promise<boolean> {
    if (!audio && current) return this.play(current);
    if (audio) { try { await audio.play(); paused = false; announce(); bus.emit("media:play", { id: "radio" }); return true; } catch { return false; } }
    return false;
  }
  toggle() { if (!audio || paused) return this.resume(); this.pause(); return Promise.resolve(true); }
  stop(silent = false) {
    if (audio) { try { audio.pause(); } catch {} audio.src = ""; audio = null; }
    paused = false;
    if (!silent) { current = null; announce(); }
  }
  setVolume(v: number) { volume = Math.max(0, Math.min(1, v)); if (audio) audio.volume = volume; }
  get volume() { return volume; }
  get current() { return current; }
  get playing() { return !!audio && !paused; }
}

export const listenTogetherService = new ListenTogetherService();

// One-media-at-a-time: pause the radio when another video/sound starts.
bus.on("media:play", ({ id }) => { if (id !== "radio") listenTogetherService.pause(); });
