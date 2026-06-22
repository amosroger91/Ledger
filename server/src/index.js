// ============================================================
//  index.js — Ledger server entry point. One process, two jobs:
//    1) PERSISTENCE: a Gun.js relay that syncs + persists the global
//       graph (feed, creator posts, NFT metadata) so data survives
//       when peers go offline.
//    2) AGGREGATION: an RSS scraper that ingests any feed and exposes
//       it on the same API, merged into the timeline.
//  Lightweight, no database, no blockchain — just a relay + a poller.
// ============================================================
import http from "node:http";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { startGunRelay } from "./gun/relay.js";
import { aggregator } from "./rss/aggregator.js";
import { buildRouter } from "./routes.js";
import { loadIdentity } from "./identity.js";
import { startContributor } from "./node/contributor.js";

const app = express();
app.use(
  cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim()) }),
);
app.use(express.json({ limit: "1mb" }));
app.use(buildRouter());

// Gun attaches to the raw http server (it serves /gun + WebSocket upgrades);
// Express handles every other route on the same server/port.
const server = http.createServer(app);

startGunRelay(server); // 1) persistence (both modes are Gun peers)
aggregator.start(); // 2) aggregation

// In "node" mode this box is a CONTRIBUTOR: load the operator's identity (if any)
// and start publishing to the global feed + reporting signed point heartbeats.
if (config.mode === "node") {
  loadIdentity();
  startContributor();
}

server.listen(config.port, () => {
  console.log(
    `[ledger-${config.mode}] listening on :${config.port}  ·  gun relay /gun  ·  timeline /api/timeline  ·  root="${config.root}"`,
  );
});

// Never let one rejected promise (a flaky feed, a Gun hiccup) crash the box.
process.on("unhandledRejection", (e) => console.warn("[unhandledRejection]", e?.message || e));
