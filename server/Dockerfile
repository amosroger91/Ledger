# ============================================================
#  Ledger server — container image for a VPS / self-hosting.
#  (render.yaml still works for Render; this is the self-host path.)
#
#  Build:  docker build -t ledger-server ./server
#  Run (relay, additive — bind to localhost, reverse-proxy with your web server):
#    docker run -d --name ledger-server --restart unless-stopped \
#      -p 127.0.0.1:8787:8787 \
#      -e GUN_DATA_DIR=/data -v ledger-data:/data \
#      ledger-server
# ============================================================
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install deps first so this layer caches unless the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source.
COPY src ./src

# Durable Gun (radisk) persistence — mount a volume at /data to keep it.
ENV GUN_DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8787
CMD ["node", "src/index.js"]
