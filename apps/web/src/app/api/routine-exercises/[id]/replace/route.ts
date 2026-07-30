import { eq } from "drizzle-orm";
import { db, replaceRoutineExercise, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routineExercises } = schema;

/** POST /api/routine-exercises/[id]/replace — swap an owned slot's library exercise. */
export const POST = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const [re] = await db.select().from(routineExercises).where(eq(routineExercises.id, id)).limit(1);
  if (!re) return Response.json({ error: "Not found" }, { status: 404 });
  if (re.ownerId !== ownerId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await replaceRoutineExercise(id, body.exerciseId);
  return Response.json({ ok: true });
});
