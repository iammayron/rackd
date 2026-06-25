import { eq } from "drizzle-orm";
import { db, schema, reschedulePush, cancelScheduledPush } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { scheduledPushes } = schema;

/** PUT /api/scheduled-pushes/[id] — move a pending scheduled push to a new fire time. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db.select().from(scheduledPushes).where(eq(scheduledPushes.id, id)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await reschedulePush(id, body.fireAt);
  return Response.json({ ok: true });
});

/** DELETE /api/scheduled-pushes/[id] — cancel a scheduled push the caller owns. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db.select().from(scheduledPushes).where(eq(scheduledPushes.id, id)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });
  await cancelScheduledPush(id);
  return new Response(null, { status: 204 });
});
