import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { personalRecords } = schema;

/** GET /api/personal-records/exercise/[id] — the caller's PRs for one exercise, newest first. */
export const GET = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const rows = await db
    .select()
    .from(personalRecords)
    .where(and(eq(personalRecords.ownerId, ownerId), eq(personalRecords.exerciseId, id)))
    .orderBy(desc(personalRecords.achievedAt));
  return Response.json(rows);
});
