import { eq } from "drizzle-orm";
import { db, schema, cloneSharedRoutine } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sharedRoutines } = schema;

/** POST /api/shared-routines/[id]/clone — clone a shared routine into the caller's routines. */
export const POST = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db.select().from(sharedRoutines).where(eq(sharedRoutines.id, id)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const newRoutineId = await cloneSharedRoutine({
    shared: {
      id: row.id,
      name: row.name,
      authorName: row.authorName,
      exercisesJson: row.exercisesJson,
      exerciseCount: row.exerciseCount,
    },
    ownerId,
  });
  return Response.json({ id: newRoutineId }, { status: 201 });
});
