import { eq } from "drizzle-orm";
import { db, publishRoutine, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines } = schema;

/** POST /api/routines/[id]/publish — snapshot an owned routine to the shared catalog. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, id))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });
  if (routine.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const shared = await publishRoutine({
    routineId: id,
    ownerId,
    authorName: body.authorName ?? "Someone",
    now: Date.now(),
  });
  if (!shared) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(shared, { status: 201 });
});
