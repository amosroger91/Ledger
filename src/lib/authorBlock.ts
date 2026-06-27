// ============================================================
//  authorBlock — a tiny, pure blocklist for spam-brand usernames that
//  flood the network under many throwaway identities. Matching is case-
//  and accent-insensitive (NFD + strip combining marks), so "aéPiot",
//  "aepiot", "AÉPIOT" and "aePiot" all hit the same entry. Dependency-
//  free and worker-safe — feedRank calls it on both the main-thread
//  fallback and inside the feed worker.
// ============================================================

// Author-name substrings to drop. Normalized (lowercase, no diacritics).
const BLOCKED_AUTHOR_SUBSTRINGS = ["aepiot"];

/** lowercase + strip diacritics so accented spellings can't dodge the filter. */
function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** True if a display name contains any blocked substring (e.g. "aéPiot"). */
export function isBlockedAuthorName(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = normalize(name);
  return BLOCKED_AUTHOR_SUBSTRINGS.some((b) => n.includes(b));
}
