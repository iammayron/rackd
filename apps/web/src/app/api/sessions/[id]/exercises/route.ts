import { eq } from "drizzle-orm";
import { db, schema, addSessionExercise } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions } = schema;

/** POST /api/sessions/[id]/exercises — add an exercise card to a live session. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const row = await addSessionExercise({
    sessionId: id,
    exerciseId: body.exerciseId,
    order: body.order,
    restSec: body.restSec,
  });
  return Response.json(row, { status: 201 });
});
