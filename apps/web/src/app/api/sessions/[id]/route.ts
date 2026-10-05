import { asc, eq } from "drizzle-orm";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions, sessionExercises, setLogs, exercises } = schema;

/** GET /api/sessions/[id] — the full session tree (exercises → sets). */
export const GET = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const ses = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, id))
    .orderBy(asc(sessionExercises.order));

  const exercisesOut = [];
  for (const se of ses) {
    const [exercise] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, se.exerciseId))
      .limit(1);
    const sets = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionExerciseId, se.id))
      .orderBy(asc(setLogs.order));
    exercisesOut.push({ ...se, exercise: exercise ?? null, sets });
  }

  return Response.json({ ...session, exercises: exercisesOut });
});
