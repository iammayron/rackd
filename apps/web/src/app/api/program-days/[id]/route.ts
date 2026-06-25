import { eq } from "drizzle-orm";
import { db, schema, updateProgramDay, removeProgramDay } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { programDays } = schema;

/** PUT /api/program-days/[id] — patch a program day the caller owns. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [day] = await db.select().from(programDays).where(eq(programDays.id, id)).limit(1);
  if (!day) return Response.json({ error: "Not found" }, { status: 404 });
  if (day.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const patch: { name?: string; routineId?: string; weekday?: number } = {};
  if ("name" in body) patch.name = body.name;
  // routineId uses presence semantics — passing null clears the assignment (Rest slot).
  if ("routineId" in body) patch.routineId = body.routineId;
  if ("weekday" in body) patch.weekday = body.weekday;
  await updateProgramDay(id, patch);
  return Response.json({ ok: true });
});

/** DELETE /api/program-days/[id] — remove a program day the caller owns. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [day] = await db.select().from(programDays).where(eq(programDays.id, id)).limit(1);
  if (!day) return Response.json({ error: "Not found" }, { status: 404 });
  if (day.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });
  await removeProgramDay(id);
  return new Response(null, { status: 204 });
});
