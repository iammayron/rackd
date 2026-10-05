import { eq } from "drizzle-orm";
import { db, schema, applySessionToRoutine } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions, routines } = schema;
const MODES = new Set(["numbers", "exercises", "everything"]);

/** POST /api/sessions/[id]/save-back — write the finished session back into a routine. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!MODES.has(body.mode)) return Response.json({ error: "Invalid mode" }, { status: 400 });

  // The caller must own the TARGET routine too — otherwise a crafted routineId
  // would let one user overwrite another user's plan (applySessionToRoutine
  // derives ownerId from the routine itself, so it can't self-guard).
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, body.routineId))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });
  if (routine.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await applySessionToRoutine({
    sessionId: id,
    routineId: body.routineId,
    mode: body.mode,
  });

  // A "this program" save-back forks the routine and repoints the program day
  // at the copy; repoint the just-finished session at it too so it stays linked
  // to the routine that now represents that slot (otherwise the home screen
  // can't tell today's scheduled workout was already done). No-op for
  // "everywhere", where the target is the session's existing routine.
  if (session.routineId !== body.routineId) {
    await db.update(sessions).set({ routineId: body.routineId }).where(eq(sessions.id, id));
  }

  return Response.json({ ok: true });
});
