import { desc, eq, and, isNotNull } from "drizzle-orm";
import { db, schema, startSession, startSessionFromRoutine } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions } = schema;

/** GET /api/sessions — the caller's finished sessions, newest first. */
export const GET = withUser(async (ownerId) => {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.ownerId, ownerId), isNotNull(sessions.endedAt)))
    .orderBy(desc(sessions.startedAt));
  return Response.json(rows);
});

/** POST /api/sessions — start a session (from a routine, or blank). */
export const POST = withUser(async (ownerId, req) => {
  const body = await req.json();
  const session = body.routineId
    ? await startSessionFromRoutine({ routineId: body.routineId, ownerId, now: Date.now() })
    : await startSession({ ownerId, name: body.name ?? "Workout", now: Date.now() });
  return Response.json(session, { status: 201 });
});
