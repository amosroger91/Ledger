// ============================================================
//  nsfwService — fully on-device adult-content detection.
//  Text: a wordlist matcher (obscenity) — instant, no model. Lives in
//        lib/textModeration so the feed worker can use it without pulling
//        in the image classifier; re-exported here for the UI.
//  Images: nsfwjs (TensorFlow.js, MobileNetV2), classified in a Web
//        Worker (workers/nsfwWorker) so the heavy first-inference warmup
//        never blocks the main thread / scrolling.
//  Everything here is best-effort and advisory; on any failure we fail
//  OPEN (treat content as clean) so the feed never breaks.
// ============================================================
import { isAdultText, censorText } from "@/lib/textModeration";
export { isAdultText, censorText } from "@/lib/textModeration";

/* ---------- image classification (off-main-thread: workers/nsfwWorker) ---------- */

// Cache verdicts by URL so scrolling / re-renders never re-classify.
const verdicts = new Map<string, boolean>();
// Per-src resolvers awaiting the worker's reply (multiple cards can share an URL).
const waiters = new Map<string, ((bad: boolean) => void)[]>();

let worker: Worker | null = null;
let workerBroken = false;

function failOpenAll() {
  for (const [src, list] of waiters) { verdicts.set(src, false); list.forEach((r) => { try { r(false); } catch { /* ignore */ } }); }
  waiters.clear();
}

function ensureWorker(): Worker | null {
  if (worker || workerBroken) return worker;
  // Only on the main thread (window). In the feed worker (self, no window) image
  // classification is never requested, and nested workers are avoided entirely.
  if (typeof window === "undefined" || typeof Worker === "undefined") { workerBroken = true; return null; }
  try {
    worker = new Worker(new URL("../workers/nsfwWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ src: string; bad: boolean }>) => {
      const { src, bad } = e.data;
      verdicts.set(src, bad);
      const list = waiters.get(src); waiters.delete(src);
      list?.forEach((r) => { try { r(bad); } catch { /* ignore */ } });
    };
    worker.onerror = () => { workerBroken = true; failOpenAll(); try { worker?.terminate(); } catch { /* ignore */ } worker = null; };
  } catch { workerBroken = true; worker = null; }
  return worker;
}

/** Resolve true if the image is likely adult. Fails open (false) on any error.
 *  Classification runs entirely in the Web Worker — never blocks the UI. */
export function isAdultImage(src: string): Promise<boolean> {
  if (verdicts.has(src)) return Promise.resolve(verdicts.get(src)!);
  const w = ensureWorker();
  if (!w) return Promise.resolve(false); // no worker available → fail open
  return new Promise<boolean>((resolve) => {
    const list = waiters.get(src);
    if (list) { list.push(resolve); return; } // already in flight — piggyback
    waiters.set(src, [resolve]);
    w.postMessage({ src });
  });
}

export const nsfwService = { isAdultText, censorText, isAdultImage };
