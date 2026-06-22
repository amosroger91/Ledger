// ============================================================
//  identity.js — a contributor node optionally loads the operator's
//  identity file (the JSON the web app exports: { publicKey,
//  privateKeyJwk, username, ... }). With it, the node signs
//  contribution heartbeats so the relay can credit network points to
//  that public key. WITHOUT it, the node still contributes to the feed
//  and persistence — it just runs anonymously and earns no points.
// ============================================================
import fs from "node:fs";
import { signRecord, fingerprint } from "./lib/crypto.js";
import { config } from "./config.js";

let me = null;

export function loadIdentity() {
  if (!config.identityPath) {
    console.log("[identity] no identity file — running anonymously (contributes, earns no points)");
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(config.identityPath, "utf8"));
    if (!parsed.publicKey || !parsed.privateKeyJwk) throw new Error("missing keys");
    me = parsed;
    console.log(`[identity] loaded ${fingerprint(me.publicKey)} (${me.username || "unnamed"})`);
  } catch (e) {
    console.warn(`[identity] could not load "${config.identityPath}": ${e.message} — running anonymously`);
    me = null;
  }
  return me;
}

export const identity = {
  get loaded() {
    return !!me;
  },
  get pk() {
    return me?.publicKey ?? "";
  },
  get name() {
    return me?.username ?? "";
  },
  fingerprint() {
    return me ? fingerprint(me.publicKey) : "";
  },
  async sign(data) {
    if (!me) throw new Error("no identity loaded");
    return signRecord(data, me.publicKey, me.privateKeyJwk);
  },
};
