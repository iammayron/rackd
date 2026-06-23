import { createServer, createTriplitStorageProvider } from "@triplit/server";
import { schema } from "@fitnow/db";

/**
 * FitNow self-hosted Triplit sync server.
 * Run in Docker on a home box, expose over Tailscale. The web PWA connects via
 * NEXT_PUBLIC_TRIPLIT_URL + a token signed with the same JWT_SECRET.
 *
 * The server is started WITH the app schema so relational queries
 * (.Include("exercise")) resolve server-side, not just locally.
 *
 * Env:
 *   JWT_SECRET   (required) HS256 secret; tokens must be signed with this
 *   PORT         (default 8787)
 *   STORAGE      "sqlite" (durable, default) | "memory"
 *   PROJECT_ID   (optional) logical project id
 */
const port = Number(process.env.PORT ?? 8787);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error("JWT_SECRET is required");
  process.exit(1);
}

const storageKind = process.env.STORAGE ?? "sqlite";
const storage =
  storageKind === "memory" ? undefined : await createTriplitStorageProvider("sqlite");

const startServer = await createServer({
  jwtSecret,
  projectId: process.env.PROJECT_ID,
  storage,
  dbOptions: { schema: { collections: schema } as never },
});

startServer(port, () => {
  console.log(`FitNow sync server listening on :${port} (storage: ${storageKind})`);
});
