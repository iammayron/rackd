import { and, asc, eq } from "drizzle-orm";
import {
  db,
  deleteRoutine,
  renameRoutine,
  schema,
  setRoutineCategory,
  setRoutineSchedule,
} from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines, routineExercises, routineSets, exercises } = schema;

/** GET /api/routines/[id] — the routine with its nested exercises + sets. */
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

  const exercisesNested = [];
  for (const row of exRows) {
    const re = row.routine_exercises;
    const sets = await db
      .select()
      .from(routineSets)
      .where(eq(routineSets.routineExerciseId, re.id))
      .orderBy(asc(routineSets.order));
    exercisesNested.push({ ...re, exercise: row.exercises, sets });
  }

  return Response.json({ ...routine, exercises: exercisesNested });
});

/** PUT /api/routines/[id] — patch name/category/schedule of an owned routine. */
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
  if ("name" in body) await renameRoutine(id, body.name);
  if ("category" in body) await setRoutineCategory(id, body.category);
  if ("scheduledDays" in body) await setRoutineSchedule(id, body.scheduledDays);

  const [updated] = await db.select().from(routines).where(eq(routines.id, id)).limit(1);
  return Response.json(updated);
});

/** DELETE /api/routines/[id] — delete an owned routine and its tree. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, id))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });
  if (routine.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await deleteRoutine(id);
  return new Response(null, { status: 204 });
});
