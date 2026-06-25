# Rackd push sender. Runs worker.ts (tsx) which imports the workspace schema +
# repo fns (@rackd/db), so it builds from the REPO ROOT:
#   docker build -f apps/push/Dockerfile .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/sync/package.json apps/sync/package.json
COPY apps/push/package.json apps/push/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @rackd/push...

# Source (node_modules kept out by .dockerignore, so the install above survives)
COPY packages ./packages
COPY apps/push ./apps/push

ENV NODE_ENV=production
WORKDIR /app/apps/push
CMD ["pnpm", "start"]
