import { createClient, type Client } from "@fitnow/db";

/**
 * Browser-only Triplit client (IndexedDB). Phase 1 = local-only, no serverUrl,
 * so everything works fully offline. Cloud sync (serverUrl + token) lands in
 * Phase 2 — wiring it here is the only change the rest of the app needs.
 */
let client: Client | null = null;

export function getClient(): Client {
  if (typeof window === "undefined") {
    throw new Error("Triplit client is browser-only");
  }
  if (!client) {
    // Cloud sync is opt-in via env: set both to connect, otherwise local-only.
    const serverUrl = process.env.NEXT_PUBLIC_TRIPLIT_URL;
    const token = process.env.NEXT_PUBLIC_TRIPLIT_TOKEN;
    client = createClient({
      storage: "indexeddb",
      dbName: "fitnow",
      serverUrl,
      token,
    });
  }
  return client;
}
