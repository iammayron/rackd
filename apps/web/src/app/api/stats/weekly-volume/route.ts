import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions, sessionExercises, setLogs } = schema;

/** Epoch ms of the Monday 00:00 UTC for the ISO week containing `ms`. */
function weekStartUTC(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0 … Sun=6
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday);
}

/**
 * GET /api/stats/weekly-volume — the caller's weekly training volume.
 * Sums weight*reps over completed set logs in finished sessions, bucketed by the
 * ISO week (Monday 00:00 UTC) of each session's start. Sorted ascending.
 */
export const GET = withUser(async (ownerId) => {
  const finished = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.ownerId, ownerId), isNotNull(sessions.endedAt)));

  const byWeek = new Map<number, number>();
  for (const session of finished) {
    const sets = await db
      .select({ weight: setLogs.weight, reps: setLogs.reps })
      .from(setLogs)
      .innerJoin(sessionExercises, eq(setLogs.sessionExerciseId, sessionExercises.id))
      .where(and(eq(sessionExercises.sessionId, session.id), eq(setLogs.completed, true)));

    let volume = 0;
    for (const s of sets) volume += s.weight * s.reps;
    if (volume === 0) continue;

    const week = weekStartUTC(session.startedAt);
    byWeek.set(week, (byWeek.get(week) ?? 0) + volume);
  }

  const result = [...byWeek.entries()]
    .map(([weekStart, volume]) => ({ weekStart, volume }))
    .sort((a, b) => a.weekStart - b.weekStart);
  return Response.json(result);
});
