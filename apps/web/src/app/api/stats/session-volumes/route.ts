import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions, sessionExercises, setLogs } = schema;

/**
 * GET /api/stats/session-volumes — total training volume per finished session
 * (sum of weight*reps over completed sets), as `[{ sessionId, volume }]`. One
 * grouped query so the recent-sessions lists can show volume without N fetches.
 */
export const GET = withUser(async (ownerId) => {
  const rows = await db
    .select({
      sessionId: sessionExercises.sessionId,
      volume: sql<number>`coalesce(sum(${setLogs.weight} * ${setLogs.reps}), 0)::float8`,
    })
    .from(setLogs)
    .innerJoin(sessionExercises, eq(setLogs.sessionExerciseId, sessionExercises.id))
    .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.ownerId, ownerId),
        eq(setLogs.completed, true),
        isNotNull(sessions.endedAt),
      ),
    )
    .groupBy(sessionExercises.sessionId);

  return Response.json(rows.map((r) => ({ sessionId: r.sessionId, volume: Number(r.volume) })));
});
