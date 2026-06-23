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
    client = createClient({ storage: "indexeddb", dbName: "fitnow" });
  }
  return client;
}
