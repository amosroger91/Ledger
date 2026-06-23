// A tiny, soft "new message" chime synthesized with the Web Audio API — no asset
// to ship, no network. Debounced so a burst of messages doesn't machine-gun. The
// AudioContext is created lazily and resumed on use (browsers require a prior user
// gesture; opening a chat counts), and every call is wrapped so audio never throws
// into the UI.
let ctx: AudioContext | null = null;
let last = 0;

export function playPing(): void {
  try {
    const now = Date.now();
    if (now - last < 1500) return; // debounce bursts
    last = now;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    // two quick rising notes — a friendly little "blip-bloop"
    osc.frequency.setValueAtTime(740, t);
    osc.frequency.setValueAtTime(988, t + 0.08);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.32);
  } catch { /* never let a chime break the UI */ }
}
