import { eq } from "drizzle-orm";
import { db, schema, discardSession } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions } = schema;

/** POST /api/sessions/[id]/discard — delete the session entirely. */
export const POST = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await discardSession(id);
  return new Response(null, { status: 204 });
});
