import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (service-role) used ONLY to validate a caller's
 * access token. Never expose the service key to the browser. Constructed lazily
 * on first use — building the app (`next build` collects route data by importing
 * route modules) must not require the key to be present at import time.
 */
let supabase: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return supabase;
}

/** Resolve the Supabase user from a `Authorization: Bearer <token>` header, or null. */
export async function getAuthUser(request: Request): Promise<User | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
  } = await getServiceClient().auth.getUser(token);
  return user ?? null;
}

/** 401 helper for routes whose caller isn't authenticated. */
export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Wrap a handler that needs an authenticated user. Resolves the user once and
 * passes `ownerId`; returns 401 when absent. Keeps every route's auth identical.
 */
/**
 * Route context. Typed loosely (`params: Promise<any>`) so one `withUser` wrapper
 * satisfies Next's generated route validator for BOTH static routes (no params)
 * and dynamic `[id]` routes — a fixed `{ id: string }` fails the static ones via
 * parameter contravariance. Dynamic handlers still read `const { id } = await
 * ctx.params`.
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
