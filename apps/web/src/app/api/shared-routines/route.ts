import { desc } from "drizzle-orm";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sharedRoutines } = schema;

/** GET /api/shared-routines — the public catalog (not owner-filtered), newest first. */
export const GET = withUser(async () => {
  const rows = await db.select().from(sharedRoutines).orderBy(desc(sharedRoutines.createdAt));
  return Response.json(rows);
});
