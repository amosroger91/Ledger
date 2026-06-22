// ============================================================
//  dashboard.js — the tiny local status page a Ledger Node serves at
//  /dashboard (opened from the tray). No framework, no build: one
//  self-contained HTML string that polls the node's own JSON endpoints.
//  It also restates, in plain language, how the node uses the machine.
// ============================================================

// The plain-language disclosure shown to every operator (also used by the
// installer's consent screen — keep them in sync).
export const CONSENT_TEXT = `Ledger Node runs quietly in the background and uses a small amount of your computer's resources to help run the Ledger network. Specifically, while it is running it will:

• Act as a relay that stores and forwards the public Ledger feed, so other people's posts stay available even when their devices are offline.
• Pull public content from the open web (RSS feeds — news, YouTube, blogs, podcasts, etc.) and publish it into the shared global feed for everyone.
• Use your network connection and modest CPU to do the above. It does NOT mine cryptocurrency, sell your data, or read your private messages.

Only public content passes through your node. If you link your identity file, you earn network points for the contribution; you can also run it anonymously. You can pause or quit any time from the tray icon.`;

export function dashboardHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ledger Node</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, Segoe UI, sans-serif; margin: 0; background: #0b1622; color: #e8f0fb; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 28px 20px 60px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #8aa0bb; margin: 0 0 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 12px; }
  .card { background: #13243a; border: 1px solid #1e3a5c; border-radius: 12px; padding: 16px; }
  .k { color: #8aa0bb; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .v { font-size: 26px; font-weight: 700; margin-top: 4px; }
  .points .v { color: #5ad1a0; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; background:#5ad1a0; margin-right:6px; vertical-align:middle; }
  .dot.off { background:#e0683f; }
  .notice { background:#102033; border:1px solid #1e3a5c; border-radius:12px; padding:16px 18px; margin-top:24px; white-space:pre-wrap; color:#c4d4e8; }
  .anon { background:#2a2410; border-color:#5c4a1e; color:#f0e2b8; padding:12px 16px; border-radius:10px; margin-top:16px; }
  a { color:#6db3ff; }
</style></head>
<body><div class="wrap">
  <h1>🌐 Ledger Node</h1>
  <p class="sub"><span id="status"><span class="dot off"></span>connecting…</span> · <span id="who">—</span></p>

  <div class="grid">
    <div class="card points"><div class="k">Network points</div><div class="v" id="points">—</div></div>
    <div class="card"><div class="k">Items published</div><div class="v" id="published">—</div></div>
    <div class="card"><div class="k">Uptime</div><div class="v" id="uptime">—</div></div>
    <div class="card"><div class="k">Posts persisted</div><div class="v" id="posts">—</div></div>
  </div>

  <div id="anon" class="anon" style="display:none">
    Running <b>anonymously</b> — you're contributing, but not earning points. To earn points, quit the node, set your
    identity file (the one you exported from the Ledger web app) in settings, and restart.
  </div>

  <div class="notice" id="consent">loading…</div>
</div>
<script>
  const fmtDur = (s) => { s=Math.max(0,s|0); const h=(s/3600)|0,m=((s%3600)/60)|0; return h?h+"h "+m+"m":m+"m "+(s%60)+"s"; };
  async function tick() {
    try {
      const n = await (await fetch("/api/node")).json();
      const who = await (await fetch("/api/whoami")).json();
      document.getElementById("points").textContent = (n.points ?? 0).toLocaleString();
      document.getElementById("published").textContent = (n.published ?? 0).toLocaleString();
      document.getElementById("uptime").textContent = fmtDur(n.uptimeSec);
      document.getElementById("posts").textContent = (n.posts ?? 0).toLocaleString();
      document.getElementById("who").textContent = who.anonymous ? "Anonymous node" : ("Identity " + who.fingerprint);
      document.getElementById("status").innerHTML = '<span class="dot"></span>Contributing · relay ' + (n.relay||"");
      document.getElementById("anon").style.display = who.anonymous ? "block" : "none";
    } catch {
      document.getElementById("status").innerHTML = '<span class="dot off"></span>node offline';
    }
  }
  fetch("/api/consent").then(r=>r.text()).then(t=>document.getElementById("consent").textContent=t).catch(()=>{});
  tick(); setInterval(tick, 4000);
</script>
</body></html>`;
}
