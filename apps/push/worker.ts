import webpush, { WebPushError } from "web-push";
import {
  getPendingPushes,
  markPushSent,
  cancelScheduledPush,
  deletePushSubscription,
  type PendingPushRow,
} from "@rackd/db";

/**
 * Rackd push sender. The PWA can't notify a backgrounded/locked phone (its JS is
 * suspended), so it queues a `scheduled_pushes` row at the rest timer's endAt.
 * This worker polls Postgres for pending rows and, when a row's `fireAt` passes,
 * delivers a VAPID Web Push to the stored subscription and marks it sent.
 *
 * Talks to Postgres directly through @rackd/db (the same Drizzle layer the API
 * routes use) — no Triplit, no sync server. Owner rules don't apply here: the
 * repo's `getPendingPushes()` returns every user's pending queue.
 *
 * Env:
 *   DATABASE_URL      (required) Postgres connection string (Supabase)
 *   VAPID_PUBLIC_KEY  (required) VAPID public key  (`npx web-push generate-vapid-keys`)
 *   VAPID_PRIVATE_KEY (required) VAPID private key
 *   VAPID_SUBJECT     contact URI (default mailto:admin@rackd.app)
 *   POLL_MS           how often to check fire times (default 1000)
 */

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@rackd.app";
const pollMs = Number(process.env.POLL_MS ?? 1000);

if (!process.env.DATABASE_URL) {
  console.error("[push] DATABASE_URL is required");
  process.exit(1);
}
if (!vapidPublic || !vapidPrivate) {
  console.error("[push] VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required");
  process.exit(1);
}

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

/** Rows currently being delivered, so a slow send isn't retried on the next tick. */
const inFlight = new Set<string>();

async function deliver(row: PendingPushRow): Promise<void> {
  const sub = row.subscription;
  // Orphaned schedule (device unsubscribed) — drop it.
  if (!sub) {
    await cancelScheduledPush(row.id);
    return;
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: row.title, body: row.body, url: "/" }),
    );
    await markPushSent(row.id);
    console.log(`[push] delivered ${row.id} -> ${sub.endpoint.slice(0, 48)}…`);
  } catch (err) {
    const status = err instanceof WebPushError ? err.statusCode : undefined;
    if (status === 404 || status === 410) {
      // Subscription is gone for good — prune it and the schedule.
      await deletePushSubscription(sub.id);
      await cancelScheduledPush(row.id);
      console.warn(`[push] pruned expired subscription ${sub.id}`);
    } else {
      // Give up on this one (mark sent) rather than hot-looping every tick.
      await markPushSent(row.id);
      console.error(`[push] send failed for ${row.id} (status ${status ?? "?"})`, err);
    }
  }
}

async function tick(): Promise<void> {
  let pending: PendingPushRow[];
  try {
    pending = await getPendingPushes();
  } catch (err) {
    console.error("[push] poll failed", err);
    return;
  }
  const now = Date.now();
  for (const row of pending) {
    if (row.fireAt > now || inFlight.has(row.id)) continue;
    inFlight.add(row.id);
    void deliver(row).finally(() => inFlight.delete(row.id));
  }
}

setInterval(() => void tick(), pollMs);

console.log(`[push] sender up — polling Postgres every ${pollMs}ms`);
