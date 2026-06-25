import { eq } from "drizzle-orm";
import { db, deleteRoutineSet, schema, updateRoutineSet } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routineSets } = schema;

/** PUT /api/routine-sets/[id] — patch target reps/weight of an owned set. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [set] = await db
    .select()
    .from(routineSets)
    .where(eq(routineSets.id, id))
    .limit(1);
  if (!set) return Response.json({ error: "Not found" }, { status: 404 });
  if (set.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const patch: { targetReps?: number; targetWeight?: number } = {};
  if ("targetReps" in body) patch.targetReps = body.targetReps;
  if ("targetWeight" in body) patch.targetWeight = body.targetWeight;
  await updateRoutineSet(id, patch);
  return Response.json({ ok: true });
});

/** DELETE /api/routine-sets/[id] — delete an owned set. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [set] = await db
    .select()
    .from(routineSets)
    .where(eq(routineSets.id, id))
    .limit(1);
  if (!set) return Response.json({ error: "Not found" }, { status: 404 });
  if (set.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await deleteRoutineSet(id);
  return new Response(null, { status: 204 });
});
