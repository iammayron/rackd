import { eq } from "drizzle-orm";
import { db, duplicateRoutine, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines } = schema;

/** POST /api/routines/[id]/duplicate — deep-clone an owned routine. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, id))
    .limit(1);
  if (!routine) return Response.json({ error: "Not found" }, { status: 404 });
  if (routine.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Optional explicit name (the save-back "this program" fork reuses the
  // original name so it doesn't show up as "(copy)").
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : undefined;

  const newId = await duplicateRoutine({ routineId: id, ownerId, name });
  if (!newId) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ id: newId }, { status: 201 });
});
