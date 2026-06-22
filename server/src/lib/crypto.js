// ============================================================
//  crypto.js — Node port of the frontend's src/lib/crypto.ts. Same
//  ECDSA P-256 + canonical-JSON signing, so a contribution heartbeat
//  signed by a desktop node verifies against the very same identity
//  the web app generated (public key = user id). Uses Node's built-in
//  Web Crypto (globalThis.crypto.subtle, Node 19+).
// ============================================================
const ALGO = { name: "ECDSA", namedCurve: "P-256" };
const SIGN = { name: "ECDSA", hash: "SHA-256" };
const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;

/* ---------- base64url ---------- */
export function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlToBuf(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Stable, key-sorted JSON so the same object always signs/verifies identically. */
export function canonical(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonical).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

const importPrivate = (jwk) => subtle.importKey("jwk", jwk, ALGO, false, ["sign"]);
const importPublic = (pk) => subtle.importKey("spki", b64urlToBuf(pk), ALGO, false, ["verify"]);

/** Wrap a payload in a verifiable signature envelope: { data, sig, pk, v }. */
export async function signRecord(data, pk, jwk) {
  const key = await importPrivate(jwk);
  const sig = await subtle.sign(SIGN, key, enc.encode(canonical(data)));
  return { data, sig: bufToB64url(sig), pk, v: 1 };
}

/** Verify an envelope against its embedded public key. */
export async function verifyRecord(rec) {
  try {
    if (!rec || !rec.pk || !rec.sig) return false;
    const key = await importPublic(rec.pk);
    return await subtle.verify(SIGN, key, b64urlToBuf(rec.sig), enc.encode(canonical(rec.data)));
  } catch {
    return false;
  }
}

/** Short, human-friendly fingerprint of a public key (matches the frontend). */
export function fingerprint(pk) {
  return pk.slice(0, 6).toUpperCase() + "·" + pk.slice(-4).toUpperCase();
}
