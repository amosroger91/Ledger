import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { HashRouter } from "react-router-dom";
import { theme } from "@/theme/theme";
import "@/bliss.css";   // the Bliss / XP "Luna" design system (tokens + components)
import "@/bliss.js";    // Bliss behavior layer (window.Bliss); harmless for our MUI tree
import App from "@/App";
import { identityService } from "@/services/identityService";
import { registerServiceWorker } from "@/lib/pwa";
import { DIAG, armHeartbeat } from "@/lib/diag";

// Swallow noisy, non-fatal WebGPU/WebLLM rejections (e.g. "device lost",
// "Instance dropped in popErrorScope") so a GPU hiccup while the on-device model
// loads can't spam the console or destabilize the page — we fall back to the
// fast engine automatically.
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e.reason && (e.reason.message || e.reason)) || "");
  if (/popErrorScope|Instance dropped|external Instance|GPUDevice|device lost|WebGPU/i.test(msg)) e.preventDefault();
});

async function start() {
  // Support/recovery escape hatch: /?reset wipes this device's local database and
  // service worker, then stops (no app boot). A local-first app can be bricked by
  // a corrupt or oversized IndexedDB — this is the clean-slate recovery path.
  // Query-gated, so it never runs for a normal visitor.
  if (new URLSearchParams(location.search).has("reset")) {
    await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("nebula"); r.onsuccess = r.onerror = (r as any).onblocked = () => res(); });
    try { localStorage.clear(); } catch { /* ignore */ }
    if ("serviceWorker" in navigator) {
      try { for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister(); } catch { /* ignore */ }
    }
    document.body.innerHTML = "<div style='font:15px system-ui;padding:40px;color:#bfe'>Local data cleared. <a href='./' style='color:#7bf;font-weight:700'>Open Ledgr →</a></div>";
    return;
  }
  // ?diag — arm the main-thread stall heartbeat before anything else runs, so a
  // freeze during boot is still captured (see lib/diag.ts).
  if (DIAG) armHeartbeat();

  // "Log in on another device": #/login?k=<token> imports the identity, then
  // drops to the feed (so the token never lingers in the address bar).
  const login = location.hash.match(/^#\/login\?k=([^&]+)/);
  if (login) {
    try { await identityService.importToken(decodeURIComponent(login[1])); } catch (e) { console.warn("[login] token import failed", e); }
    history.replaceState(null, "", `${location.pathname}${location.search}#/`);
  } else if (/^#\/link\?c=/.test(location.hash)) {
    // "#/link?c=…" — a P2P device-link handoff; leave it for the in-app
    // receiver (App → DeviceLinkReceiver) to consume.
  } else if (location.hash && location.hash !== "#/" && location.hash !== "#") {
    // Always open on the home feed — ignore a stale route hash from last session.
    history.replaceState(null, "", `${location.pathname}${location.search}#/`);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <HashRouter>
          <App />
        </HashRouter>
      </ThemeProvider>
    </React.StrictMode>,
  );

  // make the app installable + offline-capable (production builds only)
  registerServiceWorker();

  // dismiss the boot splash once React has painted
  requestAnimationFrame(() => {
    const boot = document.getElementById("boot");
    if (boot) { boot.style.opacity = "0"; setTimeout(() => boot.remove(), 500); }
  });
}
start();
