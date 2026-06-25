import { getPushSubscriptions, savePushSubscription } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/push-subscriptions — the caller's device subscriptions. */
export const GET = withUser(async (ownerId) => {
  const rows = await getPushSubscriptions(ownerId);
  return Response.json(rows);
});

/** POST /api/push-subscriptions — store (or refresh) a device's push subscription. */
export const POST = withUser(async (ownerId, req) => {
  const body = await req.json();
  const row = await savePushSubscription({
    ownerId,
    endpoint: body.endpoint,
    p256dh: body.p256dh,
    auth: body.auth,
    userAgent: body.userAgent,
    now: Date.now(),
  });
  return Response.json(row, { status: 201 });
});
