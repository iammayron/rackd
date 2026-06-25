import { eq } from "drizzle-orm";
import { db, duplicateRoutine, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines } = schema;

/** POST /api/routines/[id]/duplicate — deep-clone an owned routine. */
export const POST = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, id))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });
  if (routine.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const newId = await duplicateRoutine({ routineId: id, ownerId });
  if (!newId) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ id: newId }, { status: 201 });
});
