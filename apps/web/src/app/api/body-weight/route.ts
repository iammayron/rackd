import { asc, eq } from "drizzle-orm";
import { bodyWeightLogsInRange, logBodyWeight, db, schema } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

const { bodyWeightLogs } = schema;

/**
 * GET /api/body-weight — the caller's body-weight entries.
 * With `from` and `to` (epoch ms) query params, returns only that range;
 * otherwise returns every entry, oldest→newest.
 */
export const GET = withUser(async (ownerId, req) => {
  const params = new URL(req.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (from && to) {
    const rows = await bodyWeightLogsInRange({ ownerId, from: Number(from), to: Number(to) });
    return Response.json(rows);
  }
  const rows = await db
    .select()
    .from(bodyWeightLogs)
    .where(eq(bodyWeightLogs.ownerId, ownerId))
    .orderBy(asc(bodyWeightLogs.loggedAt));
  return Response.json(rows);
});

/** POST /api/body-weight — log an entry (also mirrors onto profile.currentWeightKg). */
export const POST = withUser(async (ownerId, req) => {
  const body = await req.json();
  const log = await logBodyWeight({
    ownerId,
    weightKg: body.weightKg,
    loggedAt: body.loggedAt ?? Date.now(),
  });
  return Response.json(log, { status: 201 });
});
