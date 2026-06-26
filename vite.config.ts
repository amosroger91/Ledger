import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// base: "./" keeps asset URLs relative so the static build works from any path
// (GitHub Pages project sites, IPFS, a USB stick — anywhere). Routing uses
// HashRouter so deep links survive a refresh with no server config.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // ES-module workers: the feed worker now code-splits (it dynamically imports
  // the WASM embeddings core), which Vite can't emit as a single IIFE. Our
  // workers are already created with { type: "module" }, so ESM output matches.
  worker: { format: "es" },
  build: { target: "es2021", sourcemap: false },
});
