import { asc, eq } from "drizzle-orm";
import { db, schema, createProgram } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { programs } = schema;

/** GET /api/programs — the caller's programs, ordered. */
export const GET = withUser(async (ownerId) => {
  const rows = await db
    .select()
    .from(programs)
    .where(eq(programs.ownerId, ownerId))
    .orderBy(asc(programs.order));
  return Response.json(rows);
});

/** POST /api/programs — create a program owned by the caller. */
export const POST = withUser(async (ownerId, req) => {
  const body = await req.json();
  const row = await createProgram({
    ownerId,
    name: body.name,
    order: body.order,
    blockWeeks: body.blockWeeks,
  });
  return Response.json(row, { status: 201 });
});
