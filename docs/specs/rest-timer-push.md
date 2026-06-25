# Handoff: Rest-Timer Auto-Close + iPhone Web Push (TODO #9 & #10)

## Session Metadata
- Created: 2026-06-24
- Project: `/Users/mayron/projects/mayron/rackd`
- Branch: `main` (uncommitted working tree — nothing committed/pushed)
- MagicDNS host (this box): `mayrons-macbook-pro.tail49f713.ts.net` (tailnet IP `100.118.227.56`)

---

## 1. Goal & Scope

Two `TODO.md` items, both about the rest timer:

- **#10 — Timer backdrop:** give the rest-timer panel a dimmed scrim so it reads as a focused overlay instead of a flat sticky bar.
- **#9 — Close timer when it ends + notify the iPhone:** auto-dismiss the timer when it fires, and deliver a notification that wakes a **locked/backgrounded iPhone** — which on iOS PWAs requires true server-side **Web Push (VAPID)**, not the local `Notification` API.

The hard part is #9's background push: iOS only runs JS while the tab is foregrounded, so the notification must be sent by a server at the timer's `endAt`.

---

## 2. Current State Summary

The **entire feature is built and the server pipeline is proven** end-to-end (a seeded due row was delivered by the worker). The **only thing blocking a real locked-phone test is transport**: iOS requires a **secure (HTTPS) context** for service workers + `pushManager.subscribe()`, and the app was being served over plain **http** on a Tailscale IP, so the device never subscribed (0 `pushSubscriptions` rows).

We were mid-way through the **HTTPS cutover** (Tailscale HTTPS certs are now enabled in the admin console) when the user paused. See [§6 Current State Snapshot](#6-current-state-snapshot) for exactly what is applied vs. staged vs. reverted.

**The running stack is currently WORKING over http** (`http://100.118.227.56:3000`). `tailscale serve` was **reset** during this pause specifically to restore that working state (it had hijacked ports 8787/54321 for TLS and broken the http bundle's sync/auth calls).

---

## 3. Architecture Summary (data flow)

```
[finish a set] → timer-store.start()
     → requestNotifyPermission() + registerPushSubscription()   (writes a pushSubscriptions row)
     → scheduleRestPush(endAt)                                  (writes a scheduledPushes row, status=pending, fireAt=endAt)

[add time]  → rescheduleRestPush(newEndAt)   (updates fireAt)
[skip / foreground-fire] → cancelRestPush()  (deletes the pending row; foreground fire shows a local SW notification instead)

[apps/push worker]  (service token, always-on)
     → waitForServer() polls sync /healthcheck
     → subscribePendingPushes()  (live Triplit query, .Include()s the subscription)
     → when now >= fireAt: web-push.sendNotification(subscription, {title,body}) signed with VAPID private key
     → markPushSent(id)

[iPhone]  Service worker `push` handler → showNotification("Rest over", "Time for your next set.")
          `notificationclick` handler → focus/open the PWA
```

Transport for "schedule a push" is **Triplit itself** (the client writes a row; the worker subscribes) — no extra HTTP API. This fits the local-first model and keeps DB access in `@rackd/db`.

---

## 4. Work Completed & Verified

### #10 Backdrop — DONE
- `apps/web/src/features/active-workout/RestTimerBar.tsx` — converted from a sticky bottom bar into a **fixed full-screen overlay with a dimmed scrim + rounded panel**, reusing `BottomSheet`'s animation tokens. The scrim is **visual-only (not tap-to-dismiss)** so you can't accidentally skip a rest.

### #9 Client — DONE
- **Auto-close on fire:** `timer-store.ts` clears to idle after `FIRED_AUTOCLOSE_MS` (5s) via `fireTimeoutId`, without fighting a manual dismiss.
- **Foreground notification:** `showLocalNotification()` prefers `ServiceWorkerRegistration.showNotification` (iOS-safe), falls back to `new Notification()`.
- **Subscription registration:** `ensurePushSubscription()` → `registerPushSubscription()` persists a `pushSubscriptions` row after permission is granted.
- **Scheduling:** `scheduleRestPush(endAt)` on start, `rescheduleRestPush()` on add-time, `cancelRestPush()` on skip / foreground-fire.

### #9 Server pipeline — DONE & PROVEN
- **`@rackd/core` types:** `PushSubscriptionRecord`, `ScheduledPush` in `packages/core/src/types.ts`.
- **Triplit schema:** `pushSubscriptions` + `scheduledPushes` collections in `packages/db/src/schema.ts`, both owner-scoped (`ownerId == $token.sub`).
- **`@rackd/db` repo fns:** `savePushSubscription`, `getPushSubscriptions`, `deletePushSubscription`, `schedulePush`, `reschedulePush`, `cancelScheduledPush`, `markPushSent`, `subscribePendingPushes`.
- **`apps/push` worker:** `web-push` + VAPID, Triplit service token, `waitForServer()` cold-start guard, live `subscribePendingPushes()`. Dockerized.
- **Cold-start race fix:** `waitForServer()` + a `healthcheck` on `sync` + `push depends_on: sync (service_healthy)` in `docker-compose.yml`.
- **End-to-end proof:** a manually-seeded due `scheduledPushes` row was picked up and delivered by the worker without error (verified against a test endpoint server-side).
- **VAPID keys:** generated and written to gitignored `.env`; web bakes `NEXT_PUBLIC_VAPID_PUBLIC_KEY` at build (public key in the running bundle confirmed).

### Gate
- `pnpm typecheck && pnpm test` passed at last code change. No code was changed during this pause (only ops/config), so the gate still holds.

---

## 5. Files Touched (one-line purpose)

| File | Purpose |
|------|---------|
| `apps/web/src/features/active-workout/RestTimerBar.tsx` | #10 overlay + scrim; #9 fired-state UI |
| `apps/web/src/features/active-workout/timer-store.ts` | auto-close on fire; calls schedule/reschedule/cancel push |
| `apps/web/src/lib/push.ts` | **new** — permission, `ensure/registerPushSubscription`, `schedule/reschedule/cancelRestPush`, `showLocalNotification`, base64url→Uint8Array |
| `apps/web/src/app/sw.ts` | **new** push + notificationclick handlers |
| `packages/core/src/types.ts` | `PushSubscriptionRecord`, `ScheduledPush` |
| `packages/db/src/schema.ts` | `pushSubscriptions` + `scheduledPushes` collections (owner-scoped) |
| `packages/db/src/index.ts` | repo fns incl. `subscribePendingPushes` (live, `.Include()`s subscription) |
| `apps/push/worker.ts` | **new** — web-push sender; waits for sync; live subscribe; mark-sent |
| `apps/push/Dockerfile`, `apps/push/package.json`, `apps/push/tsconfig.json` | **new** push service |
| `docker-compose.yml` | new `push` service; `web` VAPID build-arg; `sync` healthcheck; `push depends_on sync` |
| `apps/sync/Dockerfile`, `apps/web/Dockerfile` | `COPY apps/push/package.json` for frozen-lockfile install |
| `.env.example` | VAPID + `PUSH_TRIPLIT_URL` documentation/placeholders |
| `.env` (gitignored) | real VAPID keys; **staged** https `NEXT_PUBLIC_*` URLs (see §6) |
| `supabase/config.toml` | **staged** https `site_url` + added https redirect URL (see §6) |

---

## 6. Current State Snapshot

### `tailscale serve status` → **No serve config (RESET)**
Serve was configured during the cutover (443→3000, 8787→8787, 54321→54321) but **reset during this pause**. Reason: serve on the tailnet IP repurposed ports **8787/54321 for TLS**, which broke the still-running **http** web bundle's sync + auth calls (`http://100.118.227.56:8787/:54321` started returning "Client sent an HTTP request to an HTTPS server"). Resetting serve restored the working http app.

### `.env` (gitignored — secrets redacted) → **STAGED to https**
```
NEXT_PUBLIC_SUPABASE_URL=https://mayrons-macbook-pro.tail49f713.ts.net:54321
NEXT_PUBLIC_TRIPLIT_URL=https://mayrons-macbook-pro.tail49f713.ts.net:8787
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLFbT5ABzgua5ICiNCgNTw_Xbeu6j2XNOMnBFyz4be5-zJuWtE8oQ-5X12HaTjlcPX7Tc88lUTZSXY0yF_D-_wk
VAPID_PUBLIC_KEY=<same public key>
VAPID_PRIVATE_KEY=<REDACTED — present in .env>
VAPID_SUBJECT=mailto:admin@rackd.local   # placeholder, change to a real address
S3_PUBLIC_URL=http://localhost:9200/myfit
```
These https values are **inert until the next `--build`** — the running bundle is the previous http build, so they don't affect the currently-working app.

### `supabase/config.toml` → **STAGED to https**
`site_url` set to `https://mayrons-macbook-pro.tail49f713.ts.net`; that URL added to `additional_redirect_urls` (old http URLs preserved). Takes effect only after `supabase` is restarted.

### `docker compose ps` → all Up; app WORKING over http
```
rackd-web-1     Up (serves http://100.118.227.56:3000, bundle baked with OLD http URLs)
rackd-sync-1    Up (healthy)
rackd-push-1    Up
rackd-minio-1   Up
```
Verified just now: web `200`, sync `/healthcheck` `OK 200`, Supabase `/auth/v1/health` `200` — all over http on `100.118.227.56`.

**Net status of the cutover: PARTIALLY APPLIED then made safe.** Config files (`.env`, `config.toml`) are edited to https and ready; `tailscale serve` was reverted; the **web image was never successfully rebuilt** (the `docker compose up -d --build` was interrupted before swapping the container). The stack is in a **consistent, working http state**.

---

## 7. Exact Next Steps to Resume

> Goal: serve the three origins over HTTPS so the iPhone can register for push, then rebuild so the web bundle uses the https URLs, then test on device.

### Step 1 — Re-apply `tailscale serve` (TLS in front of all three origins)
```bash
tailscale serve --bg --https=443   http://127.0.0.1:3000    # web / PWA
tailscale serve --bg --https=8787  http://127.0.0.1:8787    # Triplit sync
tailscale serve --bg --https=54321 http://127.0.0.1:54321   # Supabase
tailscale serve status   # confirm all three mapped
```
(Certs are already enabled in the tailnet admin console. If serve complains about a cert, run `tailscale cert mayrons-macbook-pro.tail49f713.ts.net`.)

> NOTE: once serve is active, the plain-http endpoints on `100.118.227.56:8787/:54321` will again return TLS errors — that's expected; the rebuilt bundle (Step 2) uses the https URLs.

### Step 2 — Rebuild + bring up (`.env` is already https-staged)
```bash
cd /Users/mayron/projects/mayron/rackd
docker compose up -d --build      # long build; re-bakes https NEXT_PUBLIC_* into web
```
If you also want Supabase to honor the new `site_url`/redirect, restart it (`supabase stop && supabase start`) — only needed if auth redirects misbehave; password login should be fine.

### Step 3 — Verify HTTPS + baked bundle (from the box)
```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://mayrons-macbook-pro.tail49f713.ts.net/                 # web → 200
curl -sS -w '%{http_code}\n'              https://mayrons-macbook-pro.tail49f713.ts.net:8787/healthcheck # sync → OK 200
curl -sS -o /dev/null -w '%{http_code}\n' https://mayrons-macbook-pro.tail49f713.ts.net:54321/auth/v1/health
# Confirm the new URL is baked into the running bundle (should print the ts.net:8787 URL, NOT 100.118.227.56):
docker compose exec -T web sh -lc "grep -rho 'https://mayrons-macbook-pro.tail49f713.ts.net:8787' /app/apps/web/.next | sort -u"
```

### Step 4 — On-device retest (the critical timing gotcha)
1. On the iPhone, open the app at **`https://mayrons-macbook-pro.tail49f713.ts.net`** (the https MagicDNS URL).
2. **Re-Add to Home Screen** — an http-installed PWA can't upgrade to the https origin; it must be re-installed from https.
3. Open the installed PWA, log in.
4. Finish a set → **grant the notification permission prompt**.
   - **GOTCHA:** permission + subscription register on *this* rest, so the push for the **NEXT** rest is the first one that can fire in the background. Don't expect the very first rest after granting to push.
5. Start the next rest, **lock the phone**, wait for `endAt`.
6. Expect a "Rest over / Time for your next set." notification on the lock screen.

### Step 5 — Server-side verification if it still fails
- `docker compose logs push --tail=200` — does the worker SEE the pending row and attempt a send? Watch for web-push errors: `400` (bad VAPID), `403` (bad `VAPID_SUBJECT`), `410` (subscription gone — re-subscribe).
- Confirm a `pushSubscriptions` row exists for the device and a `scheduledPushes` row was written at rest start (query Triplit with the service token; a temporary debug script pattern was used previously — run it via `pnpm --filter @rackd/push exec tsx <script>` so monorepo imports resolve).
- Confirm `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (baked in web) **===** `VAPID_PUBLIC_KEY` (push service); a mismatch makes APNs reject.

---

## 8. Blockers / Open Questions / Deferred

- [ ] **HTTPS context (the real blocker):** must complete §7 Steps 1–2 before the iPhone can subscribe. Until then, 0 `pushSubscriptions` rows is expected.
- [ ] **On-device locked-phone push: never confirmed.** This is the final acceptance test.
- [ ] **`VAPID_SUBJECT` is a placeholder** (`mailto:admin@rackd.local`). Change to a real address in `.env` (and rebuild/restart `push`). Not strictly required for APNs but recommended.
- [ ] **Supabase site-url/redirect:** `config.toml` is staged to https; if auth redirects break after the move, restart Supabase so it picks up the new `site_url`. Password login should be unaffected.
- [ ] **`TODO.md` #9/#10 checkboxes** not yet ticked — do so once the on-device test passes.
- [ ] **Nothing committed.** All work is uncommitted on `main`; consider a short-lived branch + PR per project rules.

---

## 9. Gotchas for the Resuming Agent

- **This project runs via Docker Compose, not `pnpm dev`.** `NEXT_PUBLIC_*` is baked at **build** time — you must `--build` to change any client URL or the VAPID public key. A busy `:3000/:8787` is almost always our own container.
- **Sync bakes the schema at startup.** The two new collections require `sync` to have been (re)built/restarted; `.Include()` on `subscribePendingPushes` fails to sync if the server schema is stale. The compose rebuild covers this.
- **`tailscale serve` on the tailnet IP shadows docker's plain-http ports** for the same port number (that's what broke the http bundle this session). With serve active, use the https URLs; with serve reset, the http URLs work.
- **Triplit `filter: []` or `{}` means DENY.** All new collections use `[["ownerId","=","$token.sub"]]`.
- **`@rackd/push` scripts must run via the workspace** (`pnpm --filter @rackd/push exec tsx ...`) or monorepo imports (`@rackd/db`) fail to resolve.
- **iOS notifications** only work for an **installed** PWA (iOS 16.4+) via `ServiceWorkerRegistration.showNotification`, and only over a secure context.

---

## 10. Related Resources
- `CLAUDE.md` (repo root) — conventions, Docker workflow, Supabase/Triplit gotchas.
- `TODO.md` — items #9 and #10.
- `docs/solutions/workflow-issues/` — Docker workflow notes.
- Transcript of the full session: `/Users/mayron/.cursor/projects/Users-mayron-projects-mayron-rackd/agent-transcripts/a2f52ccf-03b9-48ef-acdb-b5af7b986704/a2f52ccf-03b9-48ef-acdb-b5af7b986704.jsonl`
