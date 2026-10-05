import { eq } from "drizzle-orm";
import {
  db,
  schema,
  updateSessionExercise,
  setSessionExerciseOrder,
  removeSessionExercise,
} from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessionExercises } = schema;

/** PUT /api/session-exercises/[id] — patch a live session exercise (rest or order). */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.id, id))
    .limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if ("restSec" in body) await updateSessionExercise(id, { restSec: body.restSec });
  if ("order" in body) await setSessionExerciseOrder(id, body.order);
  return Response.json({ ok: true });
});

/** DELETE /api/session-exercises/[id] — remove an exercise card (sets cascade). */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.id, id))
    .limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await removeSessionExercise(id);
  return new Response(null, { status: 204 });
});
