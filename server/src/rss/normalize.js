// ============================================================
//  rss/normalize.js — turn a parsed RSS/Atom item into the frontend's
//  `Post` shape (author "rss-bot"), so merged items render with the
//  existing PostCard with zero client changes. Extra fields (feedId,
//  link) are provenance for the API and ignored by the post renderer.
// ============================================================
import { stableId } from "../lib/hash.js";

const clean = (s) =>
  (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** One parsed feed item + its owning feed -> a Ledger Post. */
export function itemToPost(item, feed) {
  const link = (item.link || item.guid || item.id || "").trim();
  const title = clean(item.title) || "(untitled)";
  const summary = clean(item.contentSnippet || item.summary || item.content || "").slice(0, 400);
  const ts = Date.parse(item.isoDate || item.pubDate || item.published || "") || Date.now();
  const topic = (feed.topic || "news").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const text = [title, summary, link].filter(Boolean).join("\n\n");

  return {
    // STABLE id from the permalink → same story dedupes across feeds/refreshes
    id: stableId("rss", link || `${feed.id}:${title}`),
    author: "rss-bot",
    authorName: feed.botName || "RSS Bot",
    kind: "text", // the client turns YouTube/Spotify/OG links in `text` into cards
    text,
    tags: [topic, ...(feed.extraTags || [])],
    createdAt: ts,
    reactions: {},
    source: "relay",
    // --- API-only provenance (not part of the post the client signs) ---
    feedId: feed.id,
    feedTitle: feed.title,
    link,
  };
}
