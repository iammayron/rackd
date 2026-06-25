import { desc, eq } from "drizzle-orm";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { personalRecords } = schema;

/** GET /api/personal-records — the caller's PRs, newest achieved first. */
export const GET = withUser(async (ownerId) => {
  const rows = await db
    .select()
    .from(personalRecords)
    .where(eq(personalRecords.ownerId, ownerId))
    .orderBy(desc(personalRecords.achievedAt));
  return Response.json(rows);
});
