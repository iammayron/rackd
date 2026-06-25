import { eq } from "drizzle-orm";
import { db, schema, reorderProgramDays } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { programs } = schema;

/** PUT /api/programs/[id]/days/reorder — persist a full reorder of the program's days. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [program] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  if (!program) return Response.json({ error: "Not found" }, { status: 404 });
  if (program.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await reorderProgramDays(body.orderedIds);
  return Response.json({ ok: true });
});
