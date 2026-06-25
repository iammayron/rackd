import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * MyFit service worker. Precaches the app shell (offline-first) and
 * runtime-caches assets/data so a started workout keeps working with no signal.
 * Exercise media (added later) will be cached on view by defaultCache's
 * image strategy.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

/**
 * Web Push. Required for rest-over notifications to reach a backgrounded/locked
 * iPhone (installed PWA, iOS 16.4+): the page's JS is suspended, so the alert
 * must be delivered as a push the SW renders. The server side that sends the
 * push at `endAt` is not built yet — these handlers make the client ready.
 */
self.addEventListener("push", (event) => {
  const fallback = { title: "Rest over", body: "Time for your next set.", url: "/" };
  let data = fallback;
  try {
    data = { ...fallback, ...(event.data?.json() ?? {}) };
  } catch {
    // payload absent or not JSON — keep the fallback copy
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "rest-timer",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
