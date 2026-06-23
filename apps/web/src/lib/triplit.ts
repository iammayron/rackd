import { createClient, type Client } from "@myfit/db";

/**
 * Browser-only Triplit client (IndexedDB). The auth token is NOT set here —
 * AuthProvider calls client.startSession(supabaseAccessToken) on login and
 * client.endSession() on logout. serverUrl enables cloud sync when configured;
 * unset = local-only (still requires a session token for permissions).
 */
let client: Client | null = null;

export function getClient(): Client {
  if (typeof window === "undefined") {
    throw new Error("Triplit client is browser-only");
  }
  if (!client) {
    client = createClient({
      storage: "indexeddb",
      dbName: "myfit",
      serverUrl: process.env.NEXT_PUBLIC_TRIPLIT_URL,
    });
  }
  return client;
}
