# FitNow self-hosted Triplit sync server.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./

ENV PORT=8787
ENV STORAGE=sqlite
EXPOSE 8787
VOLUME ["/data"]

CMD ["node", "server.mjs"]
