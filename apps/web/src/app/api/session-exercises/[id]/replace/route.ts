import { eq } from "drizzle-orm";
import { db, schema, replaceSessionExercise } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessionExercises } = schema;

/** POST /api/session-exercises/[id]/replace — swap the library exercise this slot points at. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.id, id))
    .limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await replaceSessionExercise(id, body.exerciseId);
  return Response.json({ ok: true });
});
