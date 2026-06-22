// ============================================================
//  node/contributor.js — what makes a desktop Ledger Node actually
//  CONTRIBUTE (mode === "node"). Two jobs on top of the shared engine:
//
//    1) Publish aggregated RSS stories into the GLOBAL feed (Gun `posts`)
//       — this is the "we may use your machine for network computation"
//       part: your PC pulls the open web in and seeds it for everyone.
//    2) Report a SIGNED contribution heartbeat to the relay every few
//       minutes so your identity earns network points (uptime + items).
//
//  No identity loaded → still publishes (anonymous contribution), just
//  no heartbeat and no points.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { getGun } from "../gun/relay.js";
import { store } from "../store/index.js";
import { identity } from "../identity.js";

const startedAt = Date.now();
const publishedIds = new Set();
let publishedCount = 0;
let lastReport = { points: 0, online: false };
let nodeId = "";

/** Stable per-install node id (so item-delta accounting survives restarts). */
function ensureNodeId() {
  try {
    fs.mkdirSync(config.gunDataDir, { recursive: true });
    const p = path.join(config.gunDataDir, "node-id.txt");
    if (fs.existsSync(p)) nodeId = fs.readFileSync(p, "utf8").trim();
    if (!nodeId) {
      nodeId = "node_" + randomUUID().slice(0, 12);
      fs.writeFileSync(p, nodeId);
    }
  } catch {
    nodeId = "node_" + randomUUID().slice(0, 12);
  }
  return nodeId;
}

/** Push any newly-aggregated RSS items into the shared Gun feed (idempotent
 *  by stable id, so many nodes seeding the same feeds converge to one copy). */
function publishNewItems() {
  const gun = getGun();
  if (!gun) return 0;
  const posts = gun.get(config.root).get("posts");
  let n = 0;
  for (const item of store.rss.values()) {
    if (publishedIds.has(item.id)) continue;
    publishedIds.add(item.id);
    // drop API-only provenance fields; publish the clean Post shape
    const { feedId, feedTitle, link, ...post } = item;
    try {
      posts.get(post.id).put({ json: JSON.stringify(post) });
      publishedCount++;
      n++;
    } catch {
      /* skip one bad record */
    }
  }
  if (n) console.log(`[node] published ${n} new item(s) to the global feed (total ${publishedCount})`);
  return n;
}

/** Sign and send a contribution heartbeat to the relay (earns points). */
async function heartbeat() {
  if (!identity.loaded) return; // anonymous: contribute, but nothing to credit
  try {
    const data = {
      pk: identity.pk,
      name: identity.name,
      nodeId,
      items: publishedCount, // cumulative; the relay credits the capped delta
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      at: Date.now(),
    };
    const env = await identity.sign(data);
    const r = await fetch(`${config.relayBase}/api/contrib`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(env),
    });
    if (r.ok) {
      const j = await r.json();
      lastReport = { points: j.points ?? lastReport.points, online: true };
      console.log(`[node] heartbeat ok · ${identity.fingerprint()} · ${lastReport.points} pts`);
    }
  } catch {
    /* relay unreachable — try again next interval */
  }
}

export function startContributor() {
  ensureNodeId();
  // publish shortly after boot (feeds need a moment to fill), then on a timer
  setTimeout(publishNewItems, 6000);
  setInterval(publishNewItems, 30000);
  // heartbeat: first one soon (so points show up fast), then every heartbeatMs
  setTimeout(heartbeat, Math.min(8000, config.heartbeatMs));
  setInterval(heartbeat, config.heartbeatMs);
  console.log(
    `[node] contributor mode · id=${nodeId} · identity=${identity.loaded ? identity.fingerprint() : "anonymous"} · relay=${config.relayBase}`,
  );
}

/** Live stats for the tray / local dashboard. */
export function nodeStats() {
  return {
    mode: config.mode,
    nodeId,
    identity: identity.loaded ? identity.fingerprint() : "anonymous",
    anonymous: !identity.loaded,
    published: publishedCount,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    points: lastReport.points,
    relay: config.relayBase,
  };
}
