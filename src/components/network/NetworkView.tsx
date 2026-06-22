import { useEffect, useRef, useState } from "react";
import { Box, Typography, Stack, Chip } from "@mui/material";
import { storage } from "@/services/storage";
import { presenceService } from "@/services/presenceService";
import { identityService } from "@/services/identityService";
import { bus } from "@/lib/events";

// ============================================================
//  NetworkView — "just to flex": an anonymous, live data-viz of
//  the whole slice of the network this device can see. Every known
//  identity is a glowing node in a slowly-rotating galaxy; real
//  interactions (replies, reactions) are the threads between them.
//  No names, no handles — just the shape of the swarm.
//
//  Built on a <canvas> with typed-array node fields and a single
//  O(nodes)+O(edges) render pass, so it stays smooth even if the
//  graph grows to ~20k nodes. Positions are hashed from the public
//  key (stable across refreshes); the only motion is rotation +
//  breathing, so there's no per-frame physics to blow up at scale.
// ============================================================

const isReal = (pk?: string) => !!pk && pk !== "rss-bot" && pk !== "system" && !pk.startsWith("demo_");

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface RealNodes {
  ang: Float32Array; rn: Float32Array; size: Float32Array; online: Uint8Array; color: string[];
  n: number; selfIndex: number;
}
interface Ambient { ang: Float32Array; rn: Float32Array; n: number }
interface Graph { real: RealNodes; ambient: Ambient; edges: Int32Array; stats: { nodes: number; online: number; edges: number; posts: number } }

const EDGE_CAP = 4000;

function buildAmbient(n: number): Ambient {
  const rnd = mulberry32(0xc0ffee);
  const ang = new Float32Array(n), rn = new Float32Array(n);
  for (let i = 0; i < n; i++) { ang[i] = rnd() * Math.PI * 2; rn[i] = Math.sqrt(rnd()); }
  return { ang, rn, n };
}

async function buildGraph(ambientN: number): Promise<Graph> {
  const posts = await storage.allPosts();
  const byId = new Map(posts.map((p) => [p.id, p]));
  const act = new Map<string, number>();
  const onlineSet = new Set(presenceService.list().map((p) => p.pk).filter(isReal));
  const bump = (pk?: string) => { if (isReal(pk)) act.set(pk!, (act.get(pk!) ?? 0) + 1); };

  const edgeKeys = new Set<string>();
  const edgePairs: [string, string][] = [];
  const addEdge = (a?: string, b?: string) => {
    if (!isReal(a) || !isReal(b) || a === b || edgePairs.length >= EDGE_CAP) return;
    const k = a! < b! ? `${a}|${b}` : `${b}|${a}`;
    if (edgeKeys.has(k)) return; edgeKeys.add(k); edgePairs.push([a!, b!]);
  };

  for (const p of posts) {
    bump(p.author);
    for (const voters of Object.values(p.reactions ?? {})) for (const v of voters) { bump(v); addEdge(v, p.author); }
    if (p.replyTo) { const par = byId.get(p.replyTo); if (par) { bump(par.author); addEdge(p.author, par.author); } }
  }
  for (const pk of onlineSet) if (!act.has(pk)) act.set(pk, 1);
  const me = identityService.pk;
  if (isReal(me)) act.set(me, (act.get(me) ?? 0) + 3);

  const pks = [...act.keys()];
  const idx = new Map(pks.map((pk, i) => [pk, i]));
  const n = pks.length;
  const ang = new Float32Array(n), rn = new Float32Array(n), size = new Float32Array(n);
  const online = new Uint8Array(n), color: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const pk = pks[i], h = hash32(pk);
    ang[i] = ((h % 62831) / 10000);
    rn[i] = 0.08 + Math.sqrt(((h >>> 11) % 10000) / 10000) * 0.6;   // real nodes cluster in the core
    const a = act.get(pk)!;
    size[i] = 1.3 + Math.min(4.5, Math.sqrt(a) * 0.7);
    online[i] = onlineSet.has(pk) ? 1 : 0;
    color[i] = `hsl(${190 + ((h >>> 5) % 85)}, 90%, 64%)`;            // brand blues→violets
  }
  const selfIndex = isReal(me) ? (idx.get(me) ?? -1) : -1;

  const edges = new Int32Array(edgePairs.length * 2);
  for (let i = 0; i < edgePairs.length; i++) { edges[i * 2] = idx.get(edgePairs[i][0])!; edges[i * 2 + 1] = idx.get(edgePairs[i][1])!; }

  return { real: { ang, rn, size, online, color, n, selfIndex }, ambient: buildAmbient(ambientN), edges, stats: { nodes: n, online: onlineSet.size, edges: edgePairs.length, posts: posts.length } };
}

export default function NetworkView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [stats, setStats] = useState({ nodes: 0, online: 0, edges: 0, posts: 0 });

  // (re)build the graph from local data; debounced on feed/presence changes.
  useEffect(() => {
    let alive = true;
    const ambientN = Math.max(500, Math.min(1400, Math.floor((window.innerWidth * window.innerHeight) / 1700)));
    const rebuild = () => buildGraph(ambientN).then((g) => { if (alive) { graphRef.current = g; setStats(g.stats); } });
    rebuild();
    let t: any;
    const debounced = () => { clearTimeout(t); t = setTimeout(rebuild, 600); };
    const offFeed = bus.on("feed:updated", debounced);
    const offPres = bus.on("presence:update", debounced);
    const offConn = bus.on("peer:connected", debounced);
    return () => { alive = false; clearTimeout(t); offFeed(); offPres(); offConn(); };
  }, []);

  // canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let raf = 0, W = 0, H = 0, dpr = 1;
    let sx = new Float32Array(0), sy = new Float32Array(0);

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05081a"; ctx.fillRect(0, 0, W, H);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const onMove = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouse.current.tx = (e.clientX - r.left - W / 2) / W; mouse.current.ty = (e.clientY - r.top - H / 2) / H; };
    canvas.addEventListener("mousemove", onMove);

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const g = graphRef.current;
      // motion-trail fade (gives nodes glowing comet tails as the galaxy turns)
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(5,8,26,0.26)";
      ctx.fillRect(0, 0, W, H);
      if (!g) return;

      mouse.current.x += (mouse.current.tx - mouse.current.x) * 0.04;
      mouse.current.y += (mouse.current.ty - mouse.current.y) * 0.04;
      const cx = W / 2 + mouse.current.x * 60;
      const cy = H / 2 + mouse.current.y * 60;
      const maxR = Math.min(W, H) * 0.46;
      const theta = now * 0.00004;
      const spiral = 2.2;
      const squash = 0.86;

      // soft galactic core glow
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.9);
      core.addColorStop(0, "rgba(60,120,255,0.10)"); core.addColorStop(1, "rgba(5,8,26,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.9, 0, 7); ctx.fill();

      // ambient field (decorative depth — not counted as real nodes)
      const am = g.ambient;
      ctx.fillStyle = "hsla(212,55%,62%,0.16)";
      for (let i = 0; i < am.n; i++) {
        const a = am.ang[i] + theta * 0.55 + am.rn[i] * spiral;
        const r = am.rn[i] * maxR * 1.04;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * squash;
        ctx.fillRect(x, y, 1.1, 1.1);
      }

      // compute real node screen positions once per frame
      const real = g.real;
      if (sx.length < real.n) { sx = new Float32Array(real.n); sy = new Float32Array(real.n); }
      for (let i = 0; i < real.n; i++) {
        const a = real.ang[i] + theta + real.rn[i] * spiral;
        const r = real.rn[i] * maxR * (1 + 0.02 * Math.sin(now * 0.0006 + real.ang[i] * 7));
        sx[i] = cx + Math.cos(a) * r; sy[i] = cy + Math.sin(a) * r * squash;
      }

      // edges — real interactions, one batched translucent path
      const e = g.edges;
      if (e.length) {
        ctx.strokeStyle = "rgba(96,165,255,0.07)"; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i < e.length; i += 2) { const a = e[i], b = e[i + 1]; ctx.moveTo(sx[a], sy[a]); ctx.lineTo(sx[b], sy[b]); }
        ctx.stroke();
      }

      // real nodes
      const rich = real.n < 6000;
      for (let i = 0; i < real.n; i++) {
        const on = real.online[i];
        ctx.globalAlpha = on ? 1 : 0.55;
        ctx.fillStyle = real.color[i];
        const s = real.size[i] * (on ? 1.25 : 1);
        if (rich && on) { ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(sx[i], sy[i], s * 3.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.beginPath(); ctx.arc(sx[i], sy[i], s, 0, 7); ctx.fill();
      }

      // you
      const si = real.selfIndex;
      if (si >= 0) {
        ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(sx[si], sy[si], 3.4, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx[si], sy[si], 8 + Math.sin(now * 0.004) * 1.5, 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("mousemove", onMove); };
  }, []);

  return (
    <Box sx={{ position: "relative", mt: { xs: -1.5, md: -3 }, mx: { xs: -1.5, md: -3 }, mb: -12, height: { xs: "calc(100vh - 66px)", md: "calc(100vh - 98px)" }, overflow: "hidden", bgcolor: "#05081a" }}>
      <Box component="canvas" ref={canvasRef} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

      {/* HUD overlay */}
      <Box sx={{ position: "absolute", top: 18, left: 18, right: 18, pointerEvents: "none", color: "#dce9ff" }}>
        <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, letterSpacing: 0.5, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>The Network</Typography>
        <Typography variant="body2" sx={{ opacity: 0.75, maxWidth: 460, textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
          Every node this device can see — anonymous. No names, just the shape of the swarm and the threads between people.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
          {[
            ["Nodes", stats.nodes],
            ["Online now", stats.online],
            ["Connections", stats.edges],
            ["Posts seen", stats.posts],
          ].map(([label, val]) => (
            <Chip key={label as string} size="small" label={`${val} · ${label}`}
              sx={{ bgcolor: "rgba(20,40,90,0.55)", color: "#dce9ff", border: "1px solid rgba(120,170,255,0.3)", fontWeight: 700, backdropFilter: "blur(4px)" }} />
          ))}
        </Stack>
      </Box>

      {/* legend */}
      <Stack direction="row" spacing={2} sx={{ position: "absolute", bottom: 88, left: 18, pointerEvents: "none", color: "#aebfdc" }}>
        <Legend color="#ffffff" label="you" />
        <Legend color="#5fe0ff" label="online" />
        <Legend color="rgba(120,160,255,0.6)" label="seen" />
      </Stack>
    </Box>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, boxShadow: `0 0 8px ${color}` }} />
      <Typography variant="caption" sx={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>{label}</Typography>
    </Stack>
  );
}
