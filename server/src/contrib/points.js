// ============================================================
//  contrib/points.js — the network-points ledger, kept by the relay
//  (the one always-on box that can actually MEASURE contribution).
//
//  A contributor node POSTs a *signed* heartbeat to /api/contrib; the
//  relay verifies the signature and credits points for:
//    • uptime  — at most `uptimePerBeat` per `heartbeatMs` of REAL wall
//                clock (you can't claim more uptime than time has passed)
//    • items   — capped delta of feed items the node has published
//                (`itemCapPerBeat`), so a node can't claim 1e9 at once.
//
//  Honest framing: this is a relay-ATTESTED, capped honor-system metric,
//  not a Byzantine-proof proof-of-work. Signatures stop impersonation;
//  caps bound inflation. Tallies mirror to Gun so they survive restarts
//  and converge across relays.
// ============================================================
import { config } from "../config.js";
import { getGun } from "../gun/relay.js";

const tallies = new Map(); // pk -> tally
const lastItemsByNode = new Map(); // nodeId -> last cumulative item count

function rec(pk) {
  let t = tallies.get(pk);
  if (!t) {
    t = { pk, name: "", uptimePoints: 0, itemPoints: 0, items: 0, firstSeen: Date.now(), lastSeen: 0, lastUptimeAt: 0, nodes: {} };
    tallies.set(pk, t);
  }
  return t;
}

function publicView(t) {
  const online = Date.now() - t.lastSeen < config.heartbeatMs * 2.5;
  const points = Math.round(t.uptimePoints + t.itemPoints);
  return {
    pk: t.pk,
    name: t.name,
    points,
    uptimePoints: Math.round(t.uptimePoints),
    itemPoints: Math.round(t.itemPoints),
    items: t.items,
    nodes: Object.keys(t.nodes).length,
    lastSeen: t.lastSeen,
    online,
  };
}

export const points = {
  /** Merge a tally arriving over Gun (durability / multi-relay convergence). */
  ingest(remote) {
    if (!remote?.pk) return;
    const t = rec(remote.pk);
    // take the max of each counter (monotonic) + the freshest lastSeen/name
    t.uptimePoints = Math.max(t.uptimePoints, remote.uptimePoints || 0);
    t.itemPoints = Math.max(t.itemPoints, remote.itemPoints || 0);
    t.items = Math.max(t.items, remote.items || 0);
    if ((remote.lastSeen || 0) > t.lastSeen) {
      t.lastSeen = remote.lastSeen;
      if (remote.name) t.name = remote.name;
    }
  },

  /** Apply a verified heartbeat. Returns the public view of the new tally. */
  credit({ pk, name, nodeId, items }) {
    const t = rec(pk);
    if (name) t.name = name;
    const now = Date.now();
    nodeId = nodeId || pk;

    // uptime — rate-limited to real wall clock
    if (now - t.lastUptimeAt >= config.heartbeatMs * 0.9) {
      t.uptimePoints += config.points.uptimePerBeat;
      t.lastUptimeAt = now;
    }
    // items — capped delta vs this node's last cumulative report
    const prev = lastItemsByNode.get(nodeId) || 0;
    const cumulative = Math.max(0, Number(items) || 0);
    const delta = Math.max(0, cumulative - prev);
    lastItemsByNode.set(nodeId, Math.max(prev, cumulative));
    t.itemPoints += Math.min(delta, config.points.itemCapPerBeat) * config.points.itemWeight;
    t.items = Math.max(t.items, cumulative);

    t.lastSeen = now;
    t.nodes[nodeId] = now;
    this.mirror(t);
    return publicView(t);
  },

  get(pk) {
    const t = tallies.get(pk);
    return t ? publicView(t) : { pk, name: "", points: 0, uptimePoints: 0, itemPoints: 0, items: 0, nodes: 0, lastSeen: 0, online: false };
  },

  leaderboard(limit = 50) {
    return [...tallies.values()]
      .map(publicView)
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  },

  /** Persist/broadcast a tally to the Gun graph (best-effort). */
  mirror(t) {
    try {
      getGun()?.get(config.root).get("points").get(t.pk).put({ json: JSON.stringify(publicView(t)) });
    } catch {
      /* best-effort */
    }
  },
};
