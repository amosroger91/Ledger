// ============================================================
//  feedWorker — runs the feed read + rank OFF the main thread.
//
//  The full pipeline (IndexedDB read of the post window + dedup +
//  moderation + spam/NSFW filter + scoring + sort + source-balance)
//  used to block the UI for ~0.5–1.1s per refresh on a large corpus
//  (and re-ran every ~1.2s during a Nostr/RSS firehose). Here it runs
//  in a Web Worker: the worker opens its OWN IndexedDB connection to
//  read recentPosts (storage.ts is dependency-free) and ranks via the
//  pure lib/feedRank, so the main thread stays responsive.
//
//  The main thread hands in serializable snapshots of the in-memory
//  state the worker can't reach (interest vector, hidden ids, trust
//  edges, profile reputations, spam-junk ids). Maps in the result
//  survive postMessage via the structured-clone algorithm.
// ============================================================
import { storage } from "@/services/storage";
import { rankFeed, type RankOpts } from "@/lib/feedRank";
import { looksObviouslyJunk } from "@/services/spamService";
import type { FeedAlgorithm, TrustEdge } from "@/types";

interface RankRequest {
  id: number;
  algorithm: FeedAlgorithm;
  opts: RankOpts;
  meId: string;
  interestVector: number[];
  hidden: string[];
  trustEdges: TrustEdge[];
  profiles: Record<string, number>;
  junkIds: string[];
}

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = async (e: MessageEvent<RankRequest>) => {
  const m = e.data;
  try {
    const recent = await storage.recentPosts(m.opts.limit ?? 800, m.opts.community);
    const junk = new Set(m.junkIds);
    const result = rankFeed(recent, {
      algorithm: m.algorithm,
      opts: m.opts,
      meId: m.meId,
      interestVector: m.interestVector,
      hidden: new Set(m.hidden),
      trustEdges: m.trustEdges,
      profiles: m.profiles,
      isJunk: (id, text) => junk.has(id) || looksObviouslyJunk(text),
    });
    ctx.postMessage({ id: m.id, result });
  } catch (err) {
    ctx.postMessage({ id: m.id, error: String(err) });
  }
};
