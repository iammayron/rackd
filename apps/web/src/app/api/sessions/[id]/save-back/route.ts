import { eq } from "drizzle-orm";
import { db, schema, applySessionToRoutine } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions } = schema;

/** POST /api/sessions/[id]/save-back — write the finished session back into a routine. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await applySessionToRoutine({ sessionId: id, routineId: body.routineId, mode: body.mode });
  return Response.json({ ok: true });
});
