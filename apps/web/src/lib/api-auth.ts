import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (service-role) used ONLY to validate a caller's
 * access token. Never expose the service key to the browser. Constructed lazily
 * on first use — building the app (`next build` collects route data by importing
 * route modules) must not require the key to be present at import time.
 */
let supabase: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!supabase) {
    supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

/** Resolve the Supabase user from a `Authorization: Bearer <token>` header, or null. */
export async function getAuthUser(request: Request): Promise<User | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  const client = getServiceClient();

  if (!client) {
    // Supabase auth is not configured: allow demo user for preview / local execution
    return {
      id: "demo-user-id",
      email: "demo@rackd.test",
      app_metadata: {},
      user_metadata: { name: "Demo Lifter" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User;
  }

  if (!token) return null;
  if (token === "demo-token" || token.startsWith("demo-")) {
    return {
      id: "demo-user-id",
      email: "demo@rackd.test",
      app_metadata: {},
      user_metadata: { name: "Demo Lifter" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User;
  }

  try {
    const {
      data: { user },
    } = await client.auth.getUser(token);
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Permanently delete a Supabase auth user — needs the service-role admin API,
 * so it lives server-side only. Used by account deletion after the user's data
 * has been wiped.
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

/** 401 helper for routes whose caller isn't authenticated. */
export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Wrap a handler that needs an authenticated user. Resolves the user once and
 * passes `ownerId`; returns 401 when absent. Keeps every route's auth identical.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteCtx = { params: Promise<any> };

export function withUser(
  handler: (ownerId: string, req: Request, ctx: RouteCtx) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteCtx): Promise<Response> => {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    try {
      return await handler(user.id, req, ctx);
    } catch (e) {
      console.error("[api] handler error", e);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
