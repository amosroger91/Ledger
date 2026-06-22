// ============================================================
//  hash.js — FNV-1a 32-bit → short base36. Used to derive STABLE ids
//  from a permalink so the same RSS story dedupes across feeds and
//  refreshes (mirrors the link-based dedup the frontend feed does).
// ============================================================
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const stableId = (prefix, seed) => `${prefix}_${fnv1a(seed)}`;
