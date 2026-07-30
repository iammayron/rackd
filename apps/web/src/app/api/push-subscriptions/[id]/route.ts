import { eq } from "drizzle-orm";
import { db, schema, deletePushSubscription } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { pushSubscriptions } = schema;

/** DELETE /api/push-subscriptions/[id] — remove a stored subscription the caller owns. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.id, id))
    .limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });
  await deletePushSubscription(id);
  return new Response(null, { status: 204 });
});
