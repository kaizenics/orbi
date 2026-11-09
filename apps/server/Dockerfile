# ORBI server image. Build from the repository root:
#   docker build -f apps/server/Dockerfile -t orbi-server .
# Multi-arch base images: works on x86_64 and ARM (e.g. Oracle Cloud Ampere A1).
FROM node:26-slim

ENV HUSKY=0 \
    NODE_ENV=production \
    ORBI_HOST=0.0.0.0 \
    ORBI_PORT=3100 \
    ORBI_DATABASE_URL=file:/data/orbi.db

RUN npm install -g pnpm@11.25.0

WORKDIR /app
# Workspace sources are kept outside node_modules on purpose: Node only strips TypeScript types
# from files outside node_modules, and the server runs its .ts sources directly (no build step).
COPY . .
# --ignore-scripts: no runtime dependency needs one (better-sqlite3 ships prebuilt binaries),
# and the root "prepare" hook (husky) is a dev-only tool.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@orbi/server..." \
 && pnpm store prune

WORKDIR /app/apps/server
VOLUME ["/data"]
EXPOSE 3100
# Runs as the unprivileged "node" user that ships with the base image.
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "src/main.ts"]
