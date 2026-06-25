import { eq } from "drizzle-orm";
import { db, reorderRoutineExercises, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines } = schema;

/** PUT /api/routines/[id]/exercises/reorder — persist a full exercise reorder. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, id))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });
  if (routine.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await reorderRoutineExercises(body.orderedIds);
  return Response.json({ ok: true });
});
