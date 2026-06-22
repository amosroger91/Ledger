// ============================================================
//  rss/feeds.js — the default curated feed set + resolvers for sources
//  whose RSS URL isn't obvious (YouTube channels, and anything-via-RSSHub
//  like Twitch). Add your own at runtime with POST /api/feeds.
// ============================================================
import { config } from "../config.js";
import { stableId } from "../lib/hash.js";

/** Ensure a feed has a stable id derived from its URL. */
export function withId(f) {
  return { id: f.id || stableId("feed", f.url), ...f };
}

// A small, broad default set so the timeline is alive on first boot.
export const DEFAULT_FEEDS = [
  { title: "Hacker News", url: "https://hnrss.org/frontpage", topic: "tech" },
  { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", topic: "tech" },
  { title: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", topic: "tech" },
  { title: "NASA Breaking News", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", topic: "science" },
  { title: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", topic: "news" },
  { title: "Reddit r/technology", url: "https://www.reddit.com/r/technology/.rss", topic: "tech" },
].map(withId);

/** YouTube channel or playlist → official RSS feed. */
export function youtubeFeed({ channelId, playlistId, title, topic = "youtube" }) {
  if (!channelId && !playlistId) throw new Error("channelId or playlistId required");
  const url = channelId
    ? `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
    : `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  return withId({ title: title || `YouTube ${channelId || playlistId}`, url, topic });
}

/** Anything-with-no-native-RSS via RSSHub (e.g. Twitch: "/twitch/live/:user").
 *  Returns null if RSSHUB_BASE is disabled. This is the "ingest any source"
 *  escape hatch — RSSHub turns Twitch/Instagram/etc. into RSS, we ingest it. */
export function rsshubFeed(route, { title, topic = "live" } = {}) {
  if (!config.rsshubBase) return null;
  const path = route.startsWith("/") ? route : "/" + route;
  return withId({ title: title || `RSSHub ${route}`, url: config.rsshubBase + path, topic });
}
