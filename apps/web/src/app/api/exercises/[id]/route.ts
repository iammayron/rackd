import { and, eq } from "drizzle-orm";
import { db, schema, getExerciseDetail } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { exercises } = schema;

/**
 * GET /api/exercises/[id] — a single exercise (library or the caller's custom),
 * with its fine-grained muscle involvement (+ activation) and ordered media.
 */
export const GET = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const row = await getExerciseDetail(id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId && row.ownerId !== ownerId)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(row);
});

/** PUT /api/exercises/[id] — update a custom exercise the caller owns. */
export const PUT = withUser(async (ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const k of [
    "name",
    "primaryMuscle",
    "secondaryMuscles",
    "equipment",
    "category",
    "instructions",
    "formCues",
    "thumbnailUrl",
    "clipUrl",
    "clipUrlWebm",
  ]) {
    if (k in body) patch[k] = body[k];
  }
  const [row] = await db
    .update(exercises)
    .set(patch)
    .where(and(eq(exercises.id, id), eq(exercises.ownerId, ownerId)))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
});

/** DELETE /api/exercises/[id] — delete a custom exercise the caller owns. */
export const DELETE = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const rows = await db
    .delete(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.ownerId, ownerId)))
    .returning({ id: exercises.id });
  if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
});
