import { vi } from "vitest";

/**
 * Stub Supabase at the network seam for the WHOLE suite. Both server and client
 * code construct a client via `@supabase/supabase-js` createClient:
 *  - API routes: `getAuthUser` calls `getUser(token)` → here a non-empty token
 *    maps to user `{ id: token }`, empty/absent → null (401). So a request with
 *    `Authorization: Bearer owner-a` is "called by owner-a".
 *  - Client lib: `getSupabase().auth.getSession()` → a fixed test session token.
 * No real Supabase network calls; the DB below the auth seam stays real.
 */
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token?: string) => ({
        data: { user: token ? { id: token } : null },
        error: null,
      }),
      getSession: async () => ({
        data: { session: { access_token: "test-session-token" } },
        error: null,
      }),
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  }),
}));
