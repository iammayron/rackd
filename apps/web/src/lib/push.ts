"use client";

import { api } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

/**
 * Notification + Web Push helpers.
 *
 * iOS quirks (the reason this file exists):
 * - iOS PWAs DO NOT support the `new Notification(...)` constructor. The only
 *   way to show a notification on iOS is `ServiceWorkerRegistration.showNotification`.
 *   So we always go through the SW registration and only fall back to the
 *   constructor on other platforms.
 * - Notifications only work in an *installed* (Add-to-Home-Screen) PWA on iOS 16.4+.
 * - A backgrounded PWA has its JS suspended, so a `setInterval`-driven local
 *   notification will NOT fire while the app is closed/backgrounded. Reaching a
 *   locked iPhone requires a *server-side* Web Push delivered at the timer's
 *   endAt — we register the device subscription here and queue a `scheduledPush`
 *   (via @rackd/db) that the apps/push sender drains.
 */

/** Copy for the rest-over notification (kept in one place; the SW has a fallback). */
const REST_OVER = { title: "Rest over", body: "Time for your next set." } as const;

/** True when we can show notifications at all (permission granted). */
export function canNotify(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

/**
 * Request notification permission. Must be called from a user gesture on iOS.
 * Returns the resulting permission ("granted" | "denied" | "default").
 */
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Show a notification now. Prefers the service-worker registration
 * (`showNotification`) — the only path that works on iOS — and falls back to the
 * `Notification` constructor elsewhere. No-ops without permission.
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions,
): Promise<void> {
  if (!canNotify()) return;
  const opts: NotificationOptions = {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "rest-timer",
    ...options,
  };
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    } catch {
      // fall through to constructor below
    }
  }
  try {
    new Notification(title, opts);
  } catch {
    // some platforms (iOS) throw on the constructor — already tried the SW path
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribe this device's SW to the push service using the VAPID public key,
 * returning the browser `PushSubscription` (or null when unconfigured /
 * unsupported / permission missing). Reuses an existing subscription if present.
 */
export async function ensurePushSubscription(): Promise<PushSubscription | null> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!canNotify()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  } catch {
    return null;
  }
}

/**
 * Ensure this device's subscription is stored server-side (via @rackd/db) and
 * return its persisted row id — the handle the sender targets. Null when push is
 * unconfigured/unsupported, permission isn't granted, or there's no signed-in
 * user yet. Idempotent (savePushSubscription dedupes by endpoint).
 */
export async function registerPushSubscription(): Promise<string | null> {
  const sub = await ensurePushSubscription();
  if (!sub) return null;
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  // Short-circuit when signed out (the API would 401 anyway). Owner is derived
  // server-side from the JWT — never sent in the payload.
  if (!getCurrentUserId()) return null;
  try {
    const row = await api<{ id: string }>("/api/push-subscriptions", {
      method: "POST",
      body: JSON.stringify({
        endpoint,
        p256dh,
        auth,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    });
    return row.id;
  } catch {
    return null;
  }
}

/**
 * The id of the scheduled push backing the current rest timer, so add-time can
 * reschedule it and skip/foreground-fire can cancel it. Module-scoped because
 * there is exactly one global rest timer.
 */
let scheduledPushId: string | null = null;

/**
 * Queue a server-side rest-over push for `fireAt` (the timer's endAt). Registers
 * the device if needed. Best-effort: any failure (push off, offline, no user)
 * silently no-ops — the local foreground notification still covers that case.
 */
export async function scheduleRestPush(fireAt: number): Promise<void> {
  try {
    // Drop any push still queued from a previous rest so it can't fire late.
    await cancelRestPush();
    const subscriptionId = await registerPushSubscription();
    if (!subscriptionId) return;
    const row = await api<{ id: string }>("/api/scheduled-pushes", {
      method: "POST",
      body: JSON.stringify({
        subscriptionId,
        fireAt,
        title: REST_OVER.title,
        body: REST_OVER.body,
      }),
    });
    scheduledPushId = row.id;
  } catch {
    // best-effort; never block the timer on push wiring
  }
}

/** Move the queued push to a new fire time (rest +/- time). No-op if none queued. */
export async function rescheduleRestPush(fireAt: number): Promise<void> {
  const id = scheduledPushId;
  if (!id) return;
  try {
    await api(`/api/scheduled-pushes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ fireAt }),
    });
  } catch {
    // best-effort
  }
}

/**
 * Cancel the queued push (rest skipped, or the timer fired locally while the app
 * was foregrounded — no need for the server to also send). No-op if none queued.
 */
export async function cancelRestPush(): Promise<void> {
  const id = scheduledPushId;
  scheduledPushId = null;
  if (!id) return;
  try {
    await api(`/api/scheduled-pushes/${id}`, { method: "DELETE" });
  } catch {
    // best-effort
  }
}
