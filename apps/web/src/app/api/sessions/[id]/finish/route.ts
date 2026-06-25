import { eq } from "drizzle-orm";
import { db, schema, finishSession } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions } = schema;

/** POST /api/sessions/[id]/finish — end the session and record PRs. */
export const POST = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const prs = await finishSession(id, Date.now());
  return Response.json({ prs });
});
