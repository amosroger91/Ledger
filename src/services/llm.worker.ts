// ============================================================
//  llm.worker.ts — hosts WebLLM OFF the main thread.
//
//  Loading + compiling a multi-hundred-MB model and its WebGPU
//  pipelines is heavy and MUST NOT run on the UI thread: doing so
//  freezes the whole app (the "page unresponsive" hang). Here it runs
//  in a Web Worker, so the main thread stays responsive while the
//  model loads and during inference.
//
//  WebLLM is a bundled dependency (lazy worker chunk), loaded dynamically
//  here. Messages that arrive before that import resolves are buffered and
//  replayed in order, so the engine handshake is never lost.
// ============================================================
const ctx: any = self;
const pending: any[] = [];
let handler: any = null;

ctx.onmessage = (e: any) => {
  if (handler) handler.onmessage(e);
  else pending.push(e);
};

(async () => {
  try {
    const webllm: any = await import("@mlc-ai/web-llm");   // bundled (same-origin worker chunk), not a runtime CDN import
    handler = new webllm.WebWorkerMLCEngineHandler();
    for (const e of pending) handler.onmessage(e);
    pending.length = 0;
  } catch (err) {
    // If WebLLM can't load in here, the main thread's CreateWebWorkerMLCEngine
    // rejects and the companion falls back to heuristics — never a UI freeze.
    ctx.postMessage({ kind: "led-worker-fatal", error: String(err) });
  }
})();
