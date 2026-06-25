import { lastPerformance } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/exercises/[id]/last-performance — last completed sets in a prior session. */
export const GET = withUser(async (_ownerId, req, ctx) => {
  const { id } = await ctx.params;
  const excludeSessionId = new URL(req.url).searchParams.get("excludeSessionId") ?? undefined;
  const sets = await lastPerformance({ exerciseId: id, excludeSessionId });
  return Response.json(sets);
});
