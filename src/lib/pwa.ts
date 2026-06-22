// ============================================================
//  pwa.ts — Progressive Web App glue: service-worker registration
//  and "Add to Home Screen" install handling.
//
//  Android/desktop Chromium fire `beforeinstallprompt`, which we stash so the
//  UI can trigger a native install on demand. iOS Safari has no such API — the
//  user installs via Share → "Add to Home Screen" — so we detect iOS and the
//  UI shows instructions instead.
// ============================================================
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();        // keep the mini-infobar from popping up on its own
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** Running as an installed app (standalone window) rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    // iOS Safari exposes this non-standard flag when launched from the home screen
    (window.navigator as any).standalone === true
  );
}

/** iOS (incl. iPadOS, which masquerades as Mac but reports touch points). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** True once the browser has offered a native install prompt we can fire. */
export const canPromptInstall = () => deferred !== null;

/** Fire the native install prompt. Returns the user's choice, or null if none was pending. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!deferred) return null;
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome;
}

/** React hook exposing live install state for the UI. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  return {
    canPrompt: canPromptInstall(),
    standalone: isStandalone(),
    ios: isIOS(),
    promptInstall,
  };
}

/** Register the service worker (production builds only — avoids dev caching). */
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    // Resolve relative to the document so it works from any deploy subpath.
    const url = new URL("sw.js", document.baseURI).href;
    navigator.serviceWorker.register(url, { scope: "./" }).catch((e) => console.warn("[pwa] SW registration failed", e));
  });
}
