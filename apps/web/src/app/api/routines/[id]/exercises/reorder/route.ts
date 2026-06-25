import { eq } from "drizzle-orm";
import { db, reorderRoutineExercises, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines, routineExercises } = schema;

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
  const ids: string[] = Array.isArray(body.orderedIds) ? body.orderedIds : [];
  // Every id must belong to THIS routine — otherwise a crafted orderedIds could
  // rewrite another routine's `order` (the repo updates blindly by id).
  const children = await db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, id));
  const owned = new Set(children.map((c) => c.id));
  if (!ids.every((x) => owned.has(x))) return Response.json({ error: "Forbidden" }, { status: 403 });

  await reorderRoutineExercises(ids);
  return Response.json({ ok: true });
});
