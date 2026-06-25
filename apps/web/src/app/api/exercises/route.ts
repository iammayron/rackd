import { eq, isNull, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

// Drizzle/pg is Node-only.
export const runtime = "nodejs";

const { exercises } = schema;

/** GET /api/exercises — the shared library (no owner) plus the caller's custom ones. */
export const GET = withUser(async (ownerId) => {
  const rows = await db
    .select()
    .from(exercises)
    .where(or(isNull(exercises.ownerId), eq(exercises.ownerId, ownerId)));
  return Response.json(rows);
});

/** POST /api/exercises — create a custom exercise owned by the caller. */
export const POST = withUser(async (ownerId, req) => {
  const body = await req.json();
  const [row] = await db
    .insert(exercises)
    .values({
      id: uuidv7(),
      name: String(body.name ?? "").trim() || "Exercise",
      primaryMuscle: body.primaryMuscle ?? "other",
      secondaryMuscles: Array.isArray(body.secondaryMuscles) ? body.secondaryMuscles : [],
      equipment: body.equipment ?? "other",
      category: body.category ?? "other",
      instructions: body.instructions ?? "",
      thumbnailUrl: body.thumbnailUrl ?? null,
      clipUrl: body.clipUrl ?? null,
      clipUrlWebm: body.clipUrlWebm ?? null,
      mediaSource: body.mediaSource ?? "custom",
      isCustom: true,
      ownerId,
    })
    .returning();
  return Response.json(row, { status: 201 });
});
