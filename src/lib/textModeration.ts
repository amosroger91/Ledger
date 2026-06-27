// ============================================================
//  textModeration — PURE, synchronous text moderation (profanity /
//  explicit-language detection + masking) via the `obscenity` wordlist.
//  No model, no DOM, no workers — so it's safe to import from the feed
//  Web Worker (lib/feedRank) AND the main thread. Split out of
//  nsfwService so the worker's import graph never pulls in the image
//  classifier (tfjs/nsfwjs) or the image Web Worker.
// ============================================================
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  TextCensor,
  keepStartCensorStrategy,
  keepEndCensorStrategy,
  asteriskCensorStrategy,
} from "obscenity";

// One shared matcher over the recommended English dataset (covers sexual terms,
// slurs and strong profanity) with the obfuscation transformers (catches
// leetspeak / spacing like "f u c k" or "pr0n").
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Censor strategy: keep the first and last character, asterisk the middle —
// "fuck" -> "f**k", "shit" -> "s**t".
const censor = new TextCensor().setStrategy(
  keepStartCensorStrategy(keepEndCensorStrategy(asteriskCensorStrategy())),
);

/** True if the text contains profanity / explicit language. Synchronous & cheap. */
export function isAdultText(text?: string | null): boolean {
  if (!text) return false;
  return matcher.hasMatch(text);
}

/** Mask any cuss words in the text (f**k) without otherwise changing it. */
export function censorText(text?: string | null): string {
  if (!text) return text ?? "";
  const matches = matcher.getAllMatches(text);
  return matches.length ? censor.applyTo(text, matches) : text;
}
