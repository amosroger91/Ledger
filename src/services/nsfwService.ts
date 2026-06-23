// ============================================================
//  nsfwService — fully on-device adult-content detection.
//  Text: a wordlist matcher (obscenity) — instant, no model.
//  Images: nsfwjs (TensorFlow.js, MobileNetV2) — the picture is
//  classified locally in the browser and never leaves the device.
//  Everything here is best-effort and advisory; on any failure we
//  fail OPEN (treat content as clean) so the feed never breaks.
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
import type { NSFWJS } from "nsfwjs";

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

/* ---------- image classification (lazy: tfjs + model load on first use) ---------- */

// Sum of these classes' probabilities crossing the threshold = "adult".
const ADULT_CLASSES = new Set(["Porn", "Hentai", "Sexy"]);
const THRESHOLD = 0.6;

let modelP: Promise<NSFWJS> | null = null;
async function getModel(): Promise<NSFWJS> {
  if (!modelP) {
    modelP = (async () => {
      // Dynamic import keeps tfjs (~MBs) out of the initial bundle — it's only
      // pulled when adult-content filtering is on and the first image appears.
      await import("@tensorflow/tfjs");
      const nsfwjs = await import("nsfwjs");
      return nsfwjs.load(); // default MobileNetV2 model
    })();
  }
  return modelP;
}

// crossOrigin so the canvas tfjs reads from isn't tainted for CORS-enabled
// hosts (data: URLs — our uploaded/compressed images — are always fine).
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Cache verdicts by URL so scrolling / re-renders never re-run the model.
const verdicts = new Map<string, boolean>();
// A SINGLE-FLIGHT, idle-yielding queue. An image-heavy feed mounts dozens of images
// at once; classifying them all eagerly loaded tfjs (~MBs) AND ran MobileNetV2 inference
// on the MAIN THREAD back-to-back — which froze the whole app ("page unresponsive").
// So we process at most ONE image at a time and yield to the browser between each, and
// only START once the page is idle — the feed paints and stays interactive while
// verdicts trickle in (and any flagged image blurs a moment later).
const waiters = new Map<string, ((bad: boolean) => void)[]>();
const queue: string[] = [];
let pumping = false;
const onIdle: (fn: () => void) => void =
  typeof (globalThis as any).requestIdleCallback === "function"
    ? (fn) => (globalThis as any).requestIdleCallback(fn, { timeout: 2000 })
    : (fn) => setTimeout(fn, 60);

function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const src = queue.shift();
    if (!src) { pumping = false; return; }
    classify(src)
      .then((bad) => {
        verdicts.set(src, bad);
        const list = waiters.get(src); waiters.delete(src);
        list?.forEach((r) => { try { r(bad); } catch { /* ignore */ } });
      })
      .catch(() => {})
      .finally(() => onIdle(step)); // yield between images so the UI never blocks
  };
  onIdle(step);
}

/** Resolve true if the image is likely adult. Fails open (false) on any error.
 *  Never blocks the UI — the actual classification runs through the idle queue above. */
export function isAdultImage(src: string): Promise<boolean> {
  if (verdicts.has(src)) return Promise.resolve(verdicts.get(src)!);
  return new Promise<boolean>((resolve) => {
    const list = waiters.get(src);
    if (list) { list.push(resolve); return; } // already queued — piggyback
    waiters.set(src, [resolve]);
    queue.push(src);
    pump();
  });
}

async function classify(src: string): Promise<boolean> {
  try {
    const [model, img] = await Promise.all([getModel(), loadImage(src)]);
    const preds = await model.classify(img);
    const score = preds.reduce(
      (sum, p) => (ADULT_CLASSES.has(p.className) ? sum + p.probability : sum),
      0,
    );
    return score >= THRESHOLD;
  } catch {
    return false; // fail open — never block content just because a check failed
  }
}

export const nsfwService = { isAdultText, censorText, isAdultImage };
