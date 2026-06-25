import { eq } from "drizzle-orm";
import { addRoutineSet, db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routineExercises } = schema;

/** POST /api/routine-sets — add a set to an owned routine exercise. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const body = await req.json();
  const [re] = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.id, body.routineExerciseId))
    .limit(1);
  if (!re) return Response.json({ error: "Not found" }, { status: 404 });
  if (re.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const row = await addRoutineSet({
    routineExerciseId: body.routineExerciseId,
    order: body.order,
    targetReps: body.targetReps,
    targetWeight: body.targetWeight,
    type: body.type,
  });
  return Response.json(row, { status: 201 });
});
