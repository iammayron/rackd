import { eq } from "drizzle-orm";
import { db, schema, getSaveBackContext } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions } = schema;

/** GET /api/sessions/[id]/save-back-context — what the finish flow needs to offer save-back. */
export const GET = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const context = await getSaveBackContext(id);
  return Response.json(context);
});
