import { desc, eq, and, isNull } from "drizzle-orm";
import { db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { sessions } = schema;

/** GET /api/sessions/active — the caller's single unfinished session, or null. */
export const GET = withUser(async (ownerId) => {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.ownerId, ownerId), isNull(sessions.endedAt)))
    .orderBy(desc(sessions.startedAt))
    .limit(1);
  return Response.json(row ?? null);
});
