import { eq } from "drizzle-orm";
import {
  db,
  removeRoutineExercise,
  schema,
  setRoutineExerciseOrder,
  setRoutineExerciseSuperset,
  updateRoutineExercise,
} from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routineExercises } = schema;

/** PUT /api/routine-exercises/[id] — patch rest/superset/order of an owned slot. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [re] = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.id, id))
    .limit(1);
  if (!re) return Response.json({ error: "Not found" }, { status: 404 });
  if (re.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if ("restSec" in body) await updateRoutineExercise(id, { restSec: body.restSec });
  if ("supersetGroup" in body) await setRoutineExerciseSuperset(id, body.supersetGroup);
  if ("order" in body) await setRoutineExerciseOrder(id, body.order);
  return Response.json({ ok: true });
});

/** DELETE /api/routine-exercises/[id] — remove an owned slot and its sets. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [re] = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.id, id))
    .limit(1);
  if (!re) return Response.json({ error: "Not found" }, { status: 404 });
  if (re.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await removeRoutineExercise(id);
  return new Response(null, { status: 204 });
});
