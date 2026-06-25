import { createHmac } from "node:crypto";
import webpush, { WebPushError } from "web-push";
import {
  createClient,
  subscribePendingPushes,
  markPushSent,
  cancelScheduledPush,
  deletePushSubscription,
  type PendingPushRow,
} from "@rackd/db";

/**
 * Rackd push sender. The PWA can't notify a backgrounded/locked phone (its JS is
 * suspended), so it queues a `scheduledPushes` row at the rest timer's endAt. This
 * worker keeps a live subscription to all pending rows and, when a row's `fireAt`
 * passes, delivers a VAPID Web Push to the stored subscription and marks it sent.
 *
 * Transport is Triplit itself — no bespoke HTTP API, no extra auth. We connect
 * with a service token (bypasses owner rules) so we see every user's queue.
 *
 * Env:
 *   JWT_SECRET        (required) HS256 secret of the sync server — mints our service token
 *   TRIPLIT_URL       sync server URL (default http://localhost:8787; in compose: http://sync:8787)
 *   VAPID_PUBLIC_KEY  (required) VAPID public key  (`npx web-push generate-vapid-keys`)
 *   VAPID_PRIVATE_KEY (required) VAPID private key
 *   VAPID_SUBJECT     contact URI (default mailto:admin@rackd.app)
 *   POLL_MS           how often to check fire times (default 1000)
 */

const jwtSecret = process.env.JWT_SECRET;
const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@rackd.app";
const triplitUrl = process.env.TRIPLIT_URL ?? "http://localhost:8787";
const pollMs = Number(process.env.POLL_MS ?? 1000);

if (!jwtSecret) {
  console.error("[push] JWT_SECRET is required");
  process.exit(1);
}
if (!vapidPublic || !vapidPrivate) {
  console.error("[push] VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required");
  process.exit(1);
}

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

/** Mint a full-access ("secret") HS256 token, matching apps/sync/gen-token.mjs. */
function serviceToken(secret: string): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { "x-triplit-token-type": "secret", iat: Math.floor(Date.now() / 1000) };
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Block until the sync server answers /healthcheck. Without this the worker can
 * lose the cold-start race (it boots alongside sync): its first WebSocket connect
 * fails and the live subscription never re-attaches, so rows created later are
 * silently ignored. Subscribing only once the server is up makes the attach stick.
 */
async function waitForServer(): Promise<void> {
  const healthUrl = `${triplitUrl.replace(/\/$/, "")}/healthcheck`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return;
    } catch {
      // server not reachable yet
    }
    if (attempt === 1 || attempt % 10 === 0) {
      console.log(`[push] waiting for sync at ${healthUrl} (attempt ${attempt})`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

await waitForServer();

const client = createClient({
  serverUrl: triplitUrl,
  token: serviceToken(jwtSecret),
  storage: "memory",
});

/** Latest snapshot of pending pushes, kept fresh by the Triplit subscription. */
let pending: PendingPushRow[] = [];
/** Rows currently being delivered, so a slow send isn't retried on the next tick. */
const inFlight = new Set<string>();

subscribePendingPushes(
  client,
  (rows) => {
    pending = rows;
  },
  (err) => console.error("[push] subscription error", err),
);

async function deliver(row: PendingPushRow): Promise<void> {
  const sub = row.subscription;
  // Orphaned schedule (device unsubscribed) — drop it.
  if (!sub) {
    await cancelScheduledPush(client, row.id);
    return;
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: row.title, body: row.body, url: "/" }),
    );
    await markPushSent(client, row.id);
    console.log(`[push] delivered ${row.id} -> ${sub.endpoint.slice(0, 48)}…`);
  } catch (err) {
    const status = err instanceof WebPushError ? err.statusCode : undefined;
    if (status === 404 || status === 410) {
      // Subscription is gone for good — prune it and the schedule.
      await deletePushSubscription(client, sub.id);
      await cancelScheduledPush(client, row.id);
      console.warn(`[push] pruned expired subscription ${sub.id}`);
    } else {
      // Give up on this one (mark sent) rather than hot-looping every tick.
      await markPushSent(client, row.id);
      console.error(`[push] send failed for ${row.id} (status ${status ?? "?"})`, err);
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const row of pending) {
    if (row.fireAt > now || inFlight.has(row.id)) continue;
    inFlight.add(row.id);
    void deliver(row).finally(() => inFlight.delete(row.id));
  }
}, pollMs);

console.log(`[push] sender up — connected to ${triplitUrl} (poll ${pollMs}ms)`);
