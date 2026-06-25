import { eq } from "drizzle-orm";
import { db, schema, logSet, addSet } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessionExercises } = schema;

/** POST /api/set-logs — add a set to a session exercise (completed → logSet, else empty). */
export const POST = withUser(async (ownerId, req) => {
  const body = await req.json();
  const [parent] = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.id, body.sessionExerciseId))
    .limit(1);
  if (!parent) return Response.json({ error: "Not found" }, { status: 404 });
  if (parent.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const row =
    body.completed === true
      ? await logSet({
          sessionExerciseId: body.sessionExerciseId,
          order: body.order,
          weight: body.weight,
          reps: body.reps,
          rpe: body.rpe,
          type: body.type,
        })
      : await addSet({
          sessionExerciseId: body.sessionExerciseId,
          order: body.order,
          type: body.type,
          weight: body.weight,
          reps: body.reps,
        });
  return Response.json(row, { status: 201 });
});
