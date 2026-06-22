// ============================================================
//  factMatch — pure, dependency-free matching between a post and a
//  set of fact-check claims. No AI, no network, no browser APIs: just
//  tokenization + IDF-weighted overlap with phrase/entity bonuses, so
//  the result is deterministic, inspectable, and unit-testable.
//
//  The companion LLM is deliberately NOT in this path. The most an
//  algorithm can do here is rank claims by lexical evidence; that's
//  exactly what this does, and it keeps the "fact-check" honest —
//  it links you to PolitiFact's own wording, it doesn't invent a verdict.
// ============================================================

// Common words that carry no matching signal. Kept broad on purpose so a
// shared "people"/"report" never alone links two unrelated claims.
const STOP = new Set(
  ("this that with from have here hasnt havent will would about into over after their they your you our are was were been being not but and the for there what when where which while also more most some such than then them says said report reports new news today have just like over into your they them then there here will would could should because been being into than over your about after most more they them this that with what when".split(/\s+/)),
);

/** Lowercased content tokens (≥4 chars, not stopwords), URLs stripped, in order. */
export function contentTokens(text: string): string[] {
  return (text.replace(/https?:\/\/\S+/g, " ").toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
    .filter((t) => !STOP.has(t));
}

export interface Features {
  tokens: string[];    // unique content tokens
  bigrams: string[];   // adjacent content-token pairs ("social security")
  entities: string[];  // multi-word Capitalized spans, lowercased ("joe biden")
}

// Capitalized function words that commonly start a sentence and get wrongly
// glued onto an entity ("Did Joe Biden" → "Joe Biden", "The Inflation Act" → …).
const ENTITY_TRIM = new Set(
  "the a an is are was were do does did has have had will would should could can may might must why how who what when where which while this that these those and but so then it its he she they we you i".split(/\s+/),
);

/** Salient features of a post: unique tokens, adjacent bigrams, and multi-word
 *  proper-noun entities (names/places/orgs) lifted from the original casing. */
export function extractFeatures(text: string): Features {
  const seq = contentTokens(text);
  const bigrams: string[] = [];
  for (let i = 0; i < seq.length - 1; i++) bigrams.push(`${seq[i]} ${seq[i + 1]}`);
  const entities = [
    ...new Set(
      (text.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+\b/g) ?? [])
        .map((m) => {
          let words = m.split(/\s+/);
          while (words.length && ENTITY_TRIM.has(words[0].toLowerCase())) words = words.slice(1);
          while (words.length && ENTITY_TRIM.has(words[words.length - 1].toLowerCase())) words = words.slice(0, -1);
          return words.join(" ").toLowerCase();
        })
        .filter((e) => e.includes(" ")),   // keep only genuine multi-word entities
    ),
  ];
  return { tokens: [...new Set(seq)], bigrams: [...new Set(bigrams)], entities };
}

/** Inverse document frequency over the claim set — rare tokens (specific names,
 *  places) outweigh common ones, so matches hinge on distinctive words. */
export function buildIdf(claims: string[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const c of claims) {
    for (const t of new Set(contentTokens(c))) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = claims.length || 1;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((n + 1) / (d + 1)) + 1); // smoothed, ≥~1
  return idf;
}

// Tuning. A match must clear THRESHOLD *and* rest on real evidence (≥2 distinct
// token hits, or a phrase/entity hit plus at least one token) to qualify.
export const BIGRAM_BONUS = 3;
export const ENTITY_WORD_BONUS = 2.5;
export const MIN_TOKEN_HITS = 2;
export const SCORE_THRESHOLD = 4.5;

export interface Ranked<T> { item: T; score: number; hits: string[]; }

/** Rank claims against a post by lexical evidence; return the best qualifying
 *  match, or null. Generic over anything carrying a `claim` string. Pure. */
export function rankFactChecks<T extends { claim: string }>(
  text: string,
  index: T[],
  idf?: Map<string, number>,
): Ranked<T> | null {
  if (!index.length) return null;
  const f = extractFeatures(text);
  if (!f.tokens.length) return null;
  const weights = idf ?? buildIdf(index.map((i) => i.claim));

  let best: Ranked<T> | null = null;
  for (const item of index) {
    const hay = item.claim.toLowerCase();
    const claimTokens = new Set(contentTokens(item.claim));
    let score = 0;
    const hits: string[] = [];
    for (const t of f.tokens) if (claimTokens.has(t)) { score += weights.get(t) ?? 1; hits.push(t); }

    let phrase = false;
    for (const b of f.bigrams) if (hay.includes(b)) { score += BIGRAM_BONUS; phrase = true; }
    for (const e of f.entities) if (hay.includes(e)) { score += ENTITY_WORD_BONUS * e.split(/\s+/).length; phrase = true; }

    const qualifies = hits.length >= MIN_TOKEN_HITS || (phrase && hits.length >= 1);
    if (qualifies && score > (best?.score ?? 0)) best = { item, score, hits };
  }
  return best && best.score >= SCORE_THRESHOLD ? best : null;
}
