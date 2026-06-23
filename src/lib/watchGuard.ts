import { setUnloadGuard } from "@/lib/unloadGuard";

/** Live accessors for a video currently playing in one of the global players.
 *  The reload-guard dialog uses these to tell you *what* you're about to lose
 *  (title + timestamp) and to offer "open it on YouTube at this moment". They're
 *  functions, not values, so the dialog reads the true current time on demand. */
export type ActiveVideo = {
  getVideoId: () => string | null;
  getTime: () => number;
  getTitle: () => string;
};

const sources = new Map<string, ActiveVideo>();
let order: string[] = []; // registration order; last entry = most recently activated

/** Register (info) or clear (null) the active video for a source key. Also drives
 *  the shared beforeunload guard, so a refresh/close still warns even for the
 *  cases we can't intercept with our own dialog (reload button, tab close). */
export function setActiveVideo(key: string, info: ActiveVideo | null) {
  if (info) { sources.set(key, info); order = [...order.filter((k) => k !== key), key]; }
  else { sources.delete(key); order = order.filter((k) => k !== key); }
  setUnloadGuard(key, !!info);
}

/** The most-recently-activated still-playing video, if any. */
export function activeVideo(): ActiveVideo | null {
  for (let i = order.length - 1; i >= 0; i--) {
    const s = sources.get(order[i]);
    if (s) return s;
  }
  return null;
}
