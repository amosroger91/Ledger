import { describe, it, expect } from "vitest";
import { extractFeatures, rankFactChecks } from "./factMatch";

// A small stand-in for PolitiFact's recent-claims index.
const INDEX = [
  { claim: "Joe Biden said the unemployment rate is the lowest in 50 years" },
  { claim: "Donald Trump claimed the 2020 election was rigged in Pennsylvania" },
  { claim: "Vaccines contain microchips that track your location" },
  { claim: "The Inflation Reduction Act will lower prescription drug prices" },
  { claim: "California banned gas-powered cars starting in 2035" },
];

describe("extractFeatures", () => {
  it("pulls content tokens, bigrams, and multi-word entities", () => {
    const f = extractFeatures("Did Joe Biden really lower drug prices?");
    expect(f.entities).toContain("joe biden");          // multi-word proper noun
    expect(f.tokens).toContain("prices");
    expect(f.tokens).not.toContain("did");              // <4 chars / stopword dropped
    expect(f.bigrams).toContain("drug prices");          // adjacent content pair
  });
});

describe("rankFactChecks", () => {
  it("matches a post to the right claim by distinctive token overlap", () => {
    const r = rankFactChecks("I heard California is going to ban gas cars by 2035 — is that real?", INDEX);
    expect(r?.item.claim).toMatch(/California banned gas-powered cars/);
    expect(r!.hits.length).toBeGreaterThanOrEqual(2);
  });

  it("uses a multi-word entity hit to land on the correct claim", () => {
    const r = rankFactChecks("Did Joe Biden really say unemployment is the lowest in years?", INDEX);
    expect(r?.item.claim).toMatch(/Joe Biden/);
  });

  it("distinguishes between two similar political claims", () => {
    const r = rankFactChecks("Trump said the 2020 election in Pennsylvania was rigged.", INDEX);
    expect(r?.item.claim).toMatch(/Donald Trump/);
  });

  it("returns null for unrelated text", () => {
    expect(rankFactChecks("I love my new puppy and we walked to the park.", INDEX)).toBeNull();
  });

  it("returns null on weak (single common-word) overlap", () => {
    // Only "prices" overlaps — one common token shouldn't qualify a match.
    expect(rankFactChecks("the prices at the store are high", INDEX)).toBeNull();
  });

  it("returns null on an empty index", () => {
    expect(rankFactChecks("California banned gas cars in 2035", [])).toBeNull();
  });
});
