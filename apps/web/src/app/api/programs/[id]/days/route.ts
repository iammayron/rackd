import { eq } from "drizzle-orm";
import { db, schema, addProgramDay } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { programs } = schema;

/** POST /api/programs/[id]/days — add a day to a program the caller owns. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [program] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  if (!program) return Response.json({ error: "Not found" }, { status: 404 });
  if (program.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const row = await addProgramDay({
    programId: id,
    order: body.order,
    name: body.name,
    routineId: body.routineId,
    weekday: body.weekday,
  });
  return Response.json(row, { status: 201 });
});
