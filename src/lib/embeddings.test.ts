// Embeddings core — exercises the pure-TS path (in Node the WASM module isn't
// loaded, so embed/cosine/topTerms/embedMany run their reference implementations).
// The embedMany cases lock its contract (one vector per input, in order, each equal
// to embed() of that input) — the gap that hid the batch-separator bug.
import { describe, it, expect } from "vitest";
import { embed, embedMany, cosine, topTerms, EMBED_DIM } from "./embeddings";

describe("embed", () => {
  it("returns an L2-normalized vector of EMBED_DIM length", () => {
    const v = embed("hello world rust wasm");
    expect(v).toHaveLength(EMBED_DIM);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 9);
  });
  it("is deterministic", () => {
    expect(embed("same text here")).toEqual(embed("same text here"));
  });
  it("empty text → all zeros (no NaN)", () => {
    const v = embed("");
    expect(v).toHaveLength(EMBED_DIM);
    expect(v.every((x) => x === 0)).toBe(true);
  });
});

describe("cosine", () => {
  it("self-similarity is 1", () => {
    const v = embed("the quick brown fox jumps");
    expect(cosine(v, v)).toBeCloseTo(1, 9);
  });
  it("returns 0 on length mismatch or empty", () => {
    expect(cosine([1, 2, 3], [1, 2])).toBe(0);
    expect(cosine([], [])).toBe(0);
  });
});

describe("embedMany", () => {
  it("returns one vector per input, in order, each equal to embed()", () => {
    const texts = ["alpha beta", "gamma delta epsilon", "", "single"];
    const batch = embedMany(texts);
    expect(batch).toHaveLength(texts.length);
    texts.forEach((t, i) => {
      expect(batch[i]).toHaveLength(EMBED_DIM);
      expect(batch[i]).toEqual(embed(t));   // batch == per-item, no zeroing/offset bug
    });
  });
  it("empty array → empty result", () => {
    expect(embedMany([])).toEqual([]);
  });
  it("distinct inputs produce distinct vectors (no collapse into one)", () => {
    const [a, b] = embedMany(["mathematics and physics", "cooking recipes"]);
    expect(a).not.toEqual(b);
    expect(cosine(a, b)).toBeLessThan(0.99);
  });
});

describe("topTerms", () => {
  it("orders by frequency", () => {
    expect(topTerms("apple apple banana cherry banana apple", 2)).toEqual(["apple", "banana"]);
  });
});
