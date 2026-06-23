# FitNow Triplit sync server. Runs server.ts (tsx) which imports the workspace
# schema (@fitnow/db), so it builds from the REPO ROOT:
#   docker build -f apps/sync/Dockerfile .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/sync/package.json apps/sync/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @fitnow/sync...

# Source (node_modules kept out by .dockerignore, so the install above survives)
COPY packages ./packages
COPY apps/sync ./apps/sync

ENV NODE_ENV=production
ENV PORT=8787
ENV STORAGE=sqlite
EXPOSE 8787
VOLUME ["/data"]
WORKDIR /app/apps/sync
CMD ["pnpm", "start"]
