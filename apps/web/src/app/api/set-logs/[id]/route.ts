import { eq } from "drizzle-orm";
import { db, schema, updateSet, deleteSet } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { setLogs } = schema;

/** PUT /api/set-logs/[id] — patch a logged set (weight/reps/rpe/completed). */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db.select().from(setLogs).where(eq(setLogs.id, id)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const patch: { weight?: number; reps?: number; rpe?: number; completed?: boolean } = {};
  if ("weight" in body) patch.weight = body.weight;
  if ("reps" in body) patch.reps = body.reps;
  // rpe uses presence semantics — pass it whenever the key is present (incl. clear).
  if ("rpe" in body) patch.rpe = body.rpe;
  if ("completed" in body) patch.completed = body.completed;
  await updateSet(id, patch);
  return Response.json({ ok: true });
});

/** DELETE /api/set-logs/[id] — remove a logged set. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db.select().from(setLogs).where(eq(setLogs.id, id)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await deleteSet(id);
  return new Response(null, { status: 204 });
});
