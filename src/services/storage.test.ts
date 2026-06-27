// Verifies the feed's two bounded reads — recentPosts (the per-re-rank working set)
// and pruneEphemeralPosts (the rolling cache cap) — against a real IndexedDB
// implementation. The key invariant: the rss-bot + nostr "firehose" is capped/pruned,
// but human/self/peer posts are always kept. Runs in Node via fake-indexeddb.
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { storage } from "./storage";
import type { Post } from "@/types";

function mkPost(id: string, createdAt: number, opts: Partial<Post> = {}): Post {
  return {
    id,
    author: opts.author ?? "human_self",
    authorName: opts.authorName ?? "Someone",
    kind: "text",
    text: opts.text ?? id,
    tags: opts.tags ?? [],
    createdAt,
    reactions: {},
    source: opts.source ?? "self",
    ...(opts.community ? { community: opts.community } : {}),
  };
}
const rss = (id: string, t: number) => mkPost(id, t, { author: "rss-bot", source: "relay" });
const nostr = (id: string, t: number) => mkPost(id, t, { author: "nostr:abc", source: "nostr" });

async function clearPosts() {
  for (const p of await storage.allPosts()) await storage.deletePost(p.id);
}

describe("storage.recentPosts", () => {
  beforeEach(clearPosts);

  it("returns newest-first and caps the rss-bot firehose at the limit", async () => {
    for (let i = 1; i <= 10; i++) await storage.putPost(rss(`rss_${i}`, i));
    const r = await storage.recentPosts(3);
    expect(r.map((p) => p.id)).toEqual(["rss_10", "rss_9", "rss_8"]);
  });

  it("keeps EVERY human/self post even past the firehose limit", async () => {
    for (let i = 1; i <= 10; i++) await storage.putPost(rss(`rss_${i}`, 100 + i)); // newest
    await storage.putPost(mkPost("human_old", 1, { author: "alice", source: "self" })); // oldest
    const r = await storage.recentPosts(3);
    expect(r.filter((p) => p.author === "rss-bot")).toHaveLength(3); // firehose capped
    expect(r.map((p) => p.id)).toContain("human_old");              // human always kept
  });

  it("treats nostr posts as firehose too, but keeps relay-relayed humans", async () => {
    for (let i = 1; i <= 5; i++) await storage.putPost(nostr(`n_${i}`, i));
    await storage.putPost(mkPost("bob_relay", 99, { author: "bob", source: "relay" })); // human via relay
    const r = await storage.recentPosts(2);
    expect(r.filter((p) => p.source === "nostr")).toHaveLength(2); // nostr capped
    expect(r.map((p) => p.id)).toContain("bob_relay");             // relay human kept (not firehose)
  });

  it("scopes to a community (newest-first) via the byCommunity index", async () => {
    await storage.putPost(mkPost("a", 5, { community: "c1" }));
    await storage.putPost(mkPost("b", 6, { community: "c1" }));
    await storage.putPost(mkPost("c", 7, { community: "c2" }));
    const r = await storage.recentPosts(50, "c1");
    expect(r.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("storage reply index (byReplyTo)", () => {
  beforeEach(clearPosts);

  it("repliesTo returns only the replies to a given post; allReplies returns every reply", async () => {
    await storage.putPost(mkPost("root1", 1));
    await storage.putPost(mkPost("root2", 2));
    await storage.putPost({ ...mkPost("r1a", 3), replyTo: "root1" } as Post);
    await storage.putPost({ ...mkPost("r1b", 4), replyTo: "root1" } as Post);
    await storage.putPost({ ...mkPost("r2a", 5), replyTo: "root2" } as Post);

    const toRoot1 = await storage.repliesTo("root1");
    expect(toRoot1.map((p) => p.id).sort()).toEqual(["r1a", "r1b"]);

    const all = await storage.allReplies();
    expect(all.map((p) => p.id).sort()).toEqual(["r1a", "r1b", "r2a"]); // top-level roots excluded
  });

  it("allPostIds returns just the keys", async () => {
    await storage.putPost(mkPost("x", 1));
    await storage.putPost(mkPost("y", 2));
    expect((await storage.allPostIds()).sort()).toEqual(["x", "y"]);
  });
});

describe("storage.pruneEphemeralPosts", () => {
  beforeEach(clearPosts);

  it("deletes the oldest rss-bot/nostr beyond `keep`, never humans/self/peer", async () => {
    for (let i = 1; i <= 10; i++) await storage.putPost(rss(`rss_${i}`, i));
    await storage.putPost(nostr("nostr_new", 11));
    await storage.putPost(mkPost("self_1", 0, { author: "me", source: "self" }));
    await storage.putPost(mkPost("peer_1", 0, { author: "bob", source: "relay" }));
    const deleted = await storage.pruneEphemeralPosts(4); // keep 4 newest of the 11 ephemeral
    expect(deleted).toBe(7);
    const ids = (await storage.allPosts()).map((p) => p.id);
    expect(ids).toContain("self_1");     // human kept
    expect(ids).toContain("peer_1");     // relay human kept
    expect(ids).toContain("nostr_new");  // newest ephemeral kept
    expect(ids).toContain("rss_10");
    expect(ids).not.toContain("rss_1");  // oldest ephemeral pruned
  });

  it("is a no-op when under the cap", async () => {
    for (let i = 1; i <= 3; i++) await storage.putPost(rss(`rss_${i}`, i));
    expect(await storage.pruneEphemeralPosts(10)).toBe(0);
    expect(await storage.allPosts()).toHaveLength(3);
  });
});
