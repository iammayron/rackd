import { eq } from "drizzle-orm";
import { db, schema, reorderSessionExercises } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions, sessionExercises } = schema;

/** PUT /api/sessions/[id]/exercises/reorder — persist a full exercise reorder. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const ids: string[] = Array.isArray(body.orderedIds) ? body.orderedIds : [];
  // Every id must belong to THIS session — block reordering another's exercises.
  const children = await db
    .select({ id: sessionExercises.id })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, id));
  const owned = new Set(children.map((c) => c.id));
  if (!ids.every((x) => owned.has(x))) return Response.json({ error: "Forbidden" }, { status: 403 });

  await reorderSessionExercises(ids);
  return Response.json({ ok: true });
});
