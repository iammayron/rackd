import { asc, eq } from "drizzle-orm";
import { createRoutine, db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { routines } = schema;

/** GET /api/routines — list the caller's routines, ordered. */
export const GET = withUser(async (ownerId) => {
  const rows = await db
    .select()
    .from(routines)
    .where(eq(routines.ownerId, ownerId))
    .orderBy(asc(routines.order));
  return Response.json(rows);
});

/** POST /api/routines — create a routine owned by the caller. */
export const POST = withUser(async (ownerId, req) => {
  const body = await req.json();
  const row = await createRoutine({
    ownerId,
    name: body.name,
    order: body.order,
    category: body.category,
  });
  return Response.json(row, { status: 201 });
});
