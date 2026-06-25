import { and, asc, eq } from "drizzle-orm";
import { addRoutineExerciseWithDefaults, db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines, routineExercises, routineSets, exercises } = schema;

/** GET /api/routines/[id]/exercises — the routine's exercises with their sets. */
export const GET = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, id), eq(routines.ownerId, ownerId)))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });

  const exRows = await db
    .select()
    .from(routineExercises)
    .leftJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(eq(routineExercises.routineId, id))
    .orderBy(asc(routineExercises.order));

  const result = [];
  for (const row of exRows) {
    const re = row.routine_exercises;
    const sets = await db
      .select()
      .from(routineSets)
      .where(eq(routineSets.routineExerciseId, re.id))
      .orderBy(asc(routineSets.order));
    result.push({ ...re, exercise: row.exercises, sets });
  }

  return Response.json(result);
});

/** POST /api/routines/[id]/exercises — add an exercise (pre-filled from defaults). */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, id))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });
  if (routine.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const re = await addRoutineExerciseWithDefaults({
    routineId: id,
    exerciseId: body.exerciseId,
    order: body.order,
    ownerId,
  });
  return Response.json(re, { status: 201 });
});
