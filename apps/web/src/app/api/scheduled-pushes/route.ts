import { schedulePush } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/** POST /api/scheduled-pushes — queue a push for a future fire time. */
export const POST = withUser(async (ownerId, req) => {
  const payload = await req.json();
  const row = await schedulePush({
    ownerId,
    subscriptionId: payload.subscriptionId,
    fireAt: payload.fireAt,
    title: payload.title,
    body: payload.body,
    now: Date.now(),
  });
  return Response.json(row, { status: 201 });
});
