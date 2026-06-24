// ============================================================
//  spamService — fully on-device spam / scam / bot detection.
//  Two layers, both local:
//   1. A fast synchronous keyword pre-filter that drops blatant
//      scams instantly (so they never render).
//   2. A Transformers.js zero-shot classifier (ONNX, runs in the
//      browser — nothing leaves the device) that catches the
//      subtler spam / scam / bot posts in a background idle queue.
//  Opt-in (Settings → "Hide spam, scams & bots"); fails OPEN on any
//  error so the feed never breaks.
// ============================================================
import { bus } from "@/lib/events";
import type { Post } from "@/types";

/* ---------- layer 1: fast synchronous keyword heuristic ---------- */
// STRONG = an unambiguous scam/spam/bot signal (one is enough). WEAK = a
// promotional phrase that's only damning in company (needs >= 2). Kept tight so
// we never instantly drop a clearly-legit post; the ML layer handles the rest.
const STRONG = [
  /\bseed\s*phrase\b|\bprivate\s*key\b/i,
  /\bfree\s+(money|crypto|bitcoin|btc|eth|usdt|gift\s?cards?)\b/i,
  /\b(double|triple|x?10x|100x)\s+your\s+(money|crypto|investment|deposit|bitcoin)\b/i,
  /\b(crypto|bitcoin|eth|nft)\s+(giveaway|airdrop)\b|\bairdrop\s+claim\b/i,
  /\b(guaranteed|100\s?%)\s+(profit|returns?|win)\b/i,
  /\bDM\s+me\s+to\s+(earn|win|claim|invest|make\s+money)\b/i,
  /\bclaim\s+your\s+(free\s+)?(prize|reward|gift|bonus|airdrop)\b/i,
  /\b\d{2,4}\s?%\s+(gains?|returns?|profit|roi)\b/i,
  /\$\s?\d[\d,]*\s+(in)?to\s+\$\s?\d/i,
  /\b(follow\s+for\s+follow|like\s+and\s+subscribe|follow\s+back)\b/i,
  /\bbusiness\s+proposal\b/i,
];
const WEAK = [
  /\bbest\s+deals?\b/i, /\border\s+now\b/i, /\blimited\s+(stock|time|offer|spots?)\b/i,
  /\bfree\s+(shipping|worldwide)\b/i, /\blink\s+in\s+bio\b/i, /\bpromo\s*code\b/i,
  /\bsubscribe\s+to\s+my\b/i, /\bmessage\s+me\b/i, /\bsecret\s+(strategy|method|formula)\b/i,
  /\bwork\s+from\s+home\b/i, /\bclick\s+here\b/i, /\b(telegram|whats?app)\b/i,
  /\bdon'?t\s+miss\s+out\b/i, /\bspots?\s+(are\s+)?limited\b/i, /\bsignals?\s+group\b/i,
];
function looksObviouslyJunk(text: string): boolean {
  if (!text) return false;
  if (STRONG.some((re) => re.test(text))) return true;
  let w = 0;
  for (const re of WEAK) if (re.test(text)) w++;
  return w >= 2;
}

/* ---------- layer 2: Transformers.js zero-shot classifier ---------- */
// Intent-framed labels (no "genuine" runaway-winner) + single-label softmax: a
// post is junk if the top label isn't the "personal post" one and clears the bar.
const MODEL = "Xenova/nli-deberta-v3-small";
const LABELS = [
  "selling or advertising a product, service, or channel",
  "a get-rich-quick, crypto, or money scam",
  "a bot posting promotional links",
  "a person sharing a thought, question, or update",
];
const GENUINE = "a person sharing a thought, question, or update";
const THRESHOLD = 0.6; // top label's score must clear this for a junk verdict

let pipePromise: Promise<any> | null = null;
let pipeFailed = false;
async function getPipe(): Promise<any> {
  if (pipeFailed) throw new Error("classifier unavailable");
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false; // fetch the model from the HF hub/CDN
      return pipeline("zero-shot-classification", MODEL);
    })().catch((e) => { pipeFailed = true; throw e; });
  }
  return pipePromise;
}

const verdicts = new Map<string, boolean>(); // post.id -> isJunk (ML verdict)
const queued = new Set<string>();
const queue: string[] = [];
const textOf = new Map<string, string>();
let pumping = false;
let dirty = false; // a junk verdict landed → re-filter the feed
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Yield to the browser between inferences so a feed-full of posts never blocks the
// main thread (mirrors nsfwService). One model run at a time.
const onIdle: (fn: () => void) => void =
  typeof (globalThis as any).requestIdleCallback === "function"
    ? (fn) => (globalThis as any).requestIdleCallback(fn, { timeout: 2000 })
    : (fn) => setTimeout(fn, 80);

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; if (dirty) { dirty = false; bus.emit("feed:updated", undefined); } }, 1200);
}

async function step() {
  const id = queue.shift();
  if (id === undefined) { pumping = false; return; }
  try {
    const pipe = await getPipe();
    const out = await pipe((textOf.get(id) ?? "").slice(0, 400), LABELS, { multi_label: false });
    const bad = out.labels[0] !== GENUINE && out.scores[0] >= THRESHOLD; // top label is a junk class
    verdicts.set(id, bad);
    if (bad) { dirty = true; scheduleFlush(); }
  } catch {
    verdicts.set(id, false); // fail open — never hide a post because a check failed
  } finally {
    queued.delete(id); textOf.delete(id);
    onIdle(step);
  }
}
function pump() { if (pumping) return; pumping = true; onIdle(step); }

/** Synchronous junk check: blatant heuristic OR a cached ML "junk" verdict.
 *  Unknown/not-yet-classified → false (the post shows until the model rules,
 *  then it's removed for good and cached). */
export function isJunk(id: string, text: string): boolean {
  if (looksObviouslyJunk(text)) return true;
  return verdicts.get(id) === true;
}

/** Queue any not-yet-decided posts for background ML classification. */
export function classify(posts: Post[]): void {
  let added = false;
  for (const p of posts) {
    const text = p.text ?? "";
    if (text.length < 8) continue;                 // too short to judge
    if (verdicts.has(p.id) || queued.has(p.id)) continue;
    if (looksObviouslyJunk(text)) { verdicts.set(p.id, true); continue; } // already caught synchronously
    queued.add(p.id); textOf.set(p.id, text); queue.push(p.id); added = true;
  }
  if (added) pump();
}

export const spamService = { isJunk, classify };
