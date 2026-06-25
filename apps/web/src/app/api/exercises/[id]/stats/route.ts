import { exerciseStats } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/exercises/[id]/stats — per-session stat points for one exercise. */
export const GET = withUser(async (_ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const points = await exerciseStats(id);
  return Response.json(points);
});
