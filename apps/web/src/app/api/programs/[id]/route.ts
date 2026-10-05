import { and, asc, eq } from "drizzle-orm";
import {
  db,
  schema,
  renameProgram,
  setProgramActive,
  setProgramSchedule,
  deleteProgram,
} from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { programs, programDays, routines } = schema;

/** GET /api/programs/[id] — a program with its days (each with its routine or null). */
export const GET = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [program] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  if (!program) return Response.json({ error: "Not found" }, { status: 404 });
  if (program.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({ day: programDays, routine: routines })
    .from(programDays)
    .leftJoin(routines, eq(programDays.routineId, routines.id))
    .where(eq(programDays.programId, id))
    .orderBy(asc(programDays.order));
  const days = rows.map((r) => ({ ...r.day, routine: r.routine ?? null }));
  return Response.json({ ...program, days });
});

/** PUT /api/programs/[id] — patch the program by present body keys. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [program] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  if (!program) return Response.json({ error: "Not found" }, { status: 404 });
  if (program.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if ("name" in body) await renameProgram(id, body.name);
  if ("active" in body && body.active === true) await setProgramActive({ programId: id, ownerId });
  if ("scheduleMode" in body || "rotationCursor" in body || "blockWeeks" in body) {
    const patch: {
      scheduleMode?: "rotation" | "weekly";
      rotationCursor?: number;
      blockWeeks?: number;
      rotationTouchedAt?: number;
    } = {};
    if ("scheduleMode" in body) patch.scheduleMode = body.scheduleMode;
    // Moving the cursor by hand ("Skip") is the nudge the layoff clock measures
    // from. Stamped server-side, never read from the body: a skewed client clock
    // sending a future ms would clamp the gap to 0 and disable the layoff
    // restart for good, with no way to clear the column.
    if ("rotationCursor" in body) {
      patch.rotationCursor = body.rotationCursor;
      patch.rotationTouchedAt = Date.now();
    }
    if ("blockWeeks" in body) patch.blockWeeks = body.blockWeeks;
    await setProgramSchedule(id, patch);
  }

  const [row] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  return Response.json(row);
});

/** DELETE /api/programs/[id] — delete a program the caller owns. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const [program] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  if (!program) return Response.json({ error: "Not found" }, { status: 404 });
  if (program.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });
  await deleteProgram(id);
  return new Response(null, { status: 204 });
});
