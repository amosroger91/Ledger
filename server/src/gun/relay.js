// ============================================================
//  gun/relay.js — the persistence half of Ledger. A READ-ONLY Gun.js
//  relay: it joins the same graph as the app (root must match the
//  frontend), lets radisk persist every record to disk, and mirrors the
//  graph into the in-memory store for the HTTP read API.
//
//  "Read-only" = this relay never ORIGINATES content. Writes happen
//  peer-to-peer from creator nodes; the relay just persists + rebroadcasts
//  what flows through, so data survives when peers go offline.
// ============================================================
import Gun from "gun";
import { config } from "../config.js";
import { store } from "../store/index.js";
import { points } from "../contrib/points.js";

let gun = null;
export const getGun = () => gun;

const safe = (fn) => {
  try {
    fn();
  } catch {
    /* ignore one bad record */
  }
};

/** Attach a persistent Gun relay to an existing http server and mirror the
 *  Ledger graph into the in-memory read store. Best-effort: if Gun fails to
 *  start, the RSS aggregation API still works. */
export function startGunRelay(server) {
  try {
    gun = Gun({
      web: server, // serve the relay (and gun.js) at /gun on this same server
      peers: config.gunPeers, // also sync FROM public relays so we bootstrap warm
      radisk: true, // persist the graph to disk...
      file: config.gunDataDir, // ...here (point at a Render Disk for durability)
      localStorage: false,
    });

    const root = gun.get(config.root);
    // The frontend stores each record as { json: JSON.stringify(record) } keyed
    // by id (Gun graphs dislike arrays), so we parse `.json` back out.
    root.get("posts").map().on((d) => d?.json && safe(() => store.putPost(JSON.parse(d.json))));
    root.get("profiles").map().on((d) => d?.json && safe(() => store.putProfile(JSON.parse(d.json))));
    root.get("market").map().on((d) => d?.json && safe(() => store.putListing(JSON.parse(d.json))));
    // Forward-looking: creator NFT metadata persists alongside posts.
    root.get("nft").map().on((d) => d?.json && safe(() => store.putNft(JSON.parse(d.json))));
    // Network-points tallies (mirrored here for durability + multi-relay convergence).
    root.get("points").map().on((d) => d?.json && safe(() => points.ingest(JSON.parse(d.json))));

    console.log(
      `[gun] relay live at /gun · root="${config.root}" · data="${config.gunDataDir}" · bootstrap peers=${config.gunPeers.length}`,
    );
    return gun;
  } catch (e) {
    console.warn("[gun] relay disabled (init failed):", e?.message || e);
    gun = null;
    return null;
  }
}
