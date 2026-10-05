# Handoff: Rest-Timer Auto-Close + iPhone Web Push (TODO #9 & #10)

> **Standalone handoff.** Written so a fresh AI/engineer with **no access to prior chat** can continue cold. Secrets are redacted (names + non-secret URLs only).

> **READ FIRST — branch matters.** This feature exists in two different shapes:
>
> - **`migrate/triplit-to-postgres`** (the branch you are most likely on now): push is backed by **Postgres + Next.js API routes + a polling worker**. No Triplit, no sync server, no docker-compose. This is the **current, forward-looking** implementation. **This doc describes this branch as the source of truth.**
> - **`main`**: push is backed by **Triplit as the transport** (client writes a row, the `apps/push` worker subscribes live via Triplit), self-hosted via **Docker Compose + Tailscale**. On-device testing happened here.
>
> The Triplit→Postgres rework of the push transport is **already done** on `migrate/triplit-to-postgres` (commit `0f008e6 feat: migrate from Triplit to Postgres + API routes + React Query`). It is **not** a pending risk on this branch — it's implemented (but not yet deployed/tested on device under Postgres).

---

## 1. Objective (TODO.md)

- **#10 — Timer backdrop:** give the rest-timer panel a dimmed scrim so it reads as a focused overlay, not a flat sticky bar.
- **#9 — Close timer when it ends + notify the iPhone:** when the rest timer fires, auto-dismiss it, and deliver a notification that wakes a **locked/backgrounded iPhone**. On an iOS PWA this requires real **server-side Web Push (VAPID)** — the local `Notification` API can't fire while JS is suspended. (Live Activities are not available to PWAs.)

---

## 2. Status Summary (current reality)

- **#10 backdrop — DONE.**
- **#9 — client + server pipeline BUILT.**
  - **Foreground notification WORKS** — confirmed on a real iPhone with the app **open/unlocked**.
  - **Locked-phone background push NOT yet confirmed.** This is **the main open item.**
- On `migrate/triplit-to-postgres` the pipeline is fully ported to Postgres but has **not** been deployed or device-tested yet (no Fly deploy, no `DATABASE_URL` wired locally — see §6).

---

## 3. Architecture & Data Flow (this branch: Postgres)

```
finish a set → timer-store.start()
   → requestNotifyPermission() + registerPushSubscription()
        POST /api/push-subscriptions      (Drizzle savePushSubscription, deduped by endpoint)
   → scheduleRestPush(endAt)
        POST /api/scheduled-pushes         (Drizzle schedulePush, status="pending", fireAt=endAt)

add time   → rescheduleRestPush(newEndAt)  → PUT    /api/scheduled-pushes/:id   (reschedulePush)
skip / foreground-fire → cancelRestPush()  → DELETE /api/scheduled-pushes/:id   (cancelScheduledPush)
                          (foreground fire also shows a local SW notification immediately)

apps/push worker (separate Node process; needs DATABASE_URL + VAPID):
   → setInterval every POLL_MS (default 1000ms): getPendingPushes()
        (SELECT pending scheduled_pushes LEFT JOIN push_subscriptions — endpoint+keys in one read)
   → for each row where fireAt <= now: web-push.sendNotification(sub, {title,body,url:"/"})
   → markPushSent(id);  on 404/410 → deletePushSubscription + cancelScheduledPush (prune dead device)

iPhone service worker (apps/web/src/app/sw.ts):
   push event          → event.waitUntil(showNotification("Rest over", "Time for your next set."))
   notificationclick   → focus/open the PWA at "/"
```

Key contrasts vs `main`:

- **Transport is Postgres polling**, not a Triplit live subscription. The worker talks to Postgres **directly** through `@rackd/db` (same Drizzle layer the API routes use) — owner rules don't apply to the worker; `getPendingPushes()` returns every user's pending queue.
- **Client never touches the DB** — it goes through **Next.js API routes** guarded by `withUser` (validates the Supabase JWT, derives `ownerId` server-side; never trusts a client-sent owner). React Query + an IndexedDB offline-queue wrap the calls (`apps/web/src/lib/api.ts`).

---

## 4. Files Touched (one-line purpose)

| File                                                                 | Purpose                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/types.ts`                                         | `PushSubscriptionRecord`, `ScheduledPush`, `ScheduledPushStatus` domain types                                                                                                                                                                  |
| `packages/db/src/schema.ts`                                          | Drizzle **`pgTable`** defs: `push_subscriptions`, `scheduled_pushes` (replaces the old Triplit collections)                                                                                                                                    |
| `packages/db/src/index.ts`                                           | Repo fns: `savePushSubscription`, `getPushSubscriptions`, `deletePushSubscription`, `schedulePush`, `reschedulePush`, `cancelScheduledPush`, **`getPendingPushes`** (one-shot poll; replaced Triplit `subscribePendingPushes`), `markPushSent` |
| `apps/web/src/app/api/push-subscriptions/route.ts` + `[id]/route.ts` | API: create / delete a device subscription (`withUser`)                                                                                                                                                                                        |
| `apps/web/src/app/api/scheduled-pushes/route.ts` + `[id]/route.ts`   | API: create / reschedule(PUT) / cancel(DELETE) a scheduled push (`withUser`)                                                                                                                                                                   |
| `apps/web/src/lib/push.ts`                                           | Client helpers: permission, `ensure/registerPushSubscription`, `schedule/reschedule/cancelRestPush`, `showLocalNotification`, base64url→Uint8Array. Calls the API routes (not the DB)                                                          |
| `apps/web/src/lib/api.ts`                                            | Typed fetch wrapper; attaches Supabase JWT; offline mutation queue                                                                                                                                                                             |
| `apps/web/src/lib/api-auth.ts`                                       | `withUser` — validates Supabase token, yields `ownerId` to route handlers                                                                                                                                                                      |
| `apps/web/src/features/active-workout/timer-store.ts`                | Auto-close on fire (`FIRED_AUTOCLOSE_MS`); calls schedule/reschedule/cancel push                                                                                                                                                               |
| `apps/web/src/features/active-workout/RestTimerBar.tsx`              | #10 overlay + dimmed scrim (visual-only, not tap-to-dismiss); fired-state UI                                                                                                                                                                   |
| `apps/web/src/app/sw.ts`                                             | Service-worker `push` + `notificationclick` handlers                                                                                                                                                                                           |
| `apps/push/worker.ts`                                                | Postgres-polling VAPID Web Push sender (web-push)                                                                                                                                                                                              |
| `apps/push/package.json` / `tsconfig.json` / `Dockerfile`            | The push worker package (`start: tsx worker.ts`) + its image                                                                                                                                                                                   |
| `apps/web/Dockerfile`                                                | Web image; bakes `NEXT_PUBLIC_*` (incl. VAPID public key) at build                                                                                                                                                                             |
| `.env.example`                                                       | Documents the new env shape (DATABASE_URL, Supabase, Tigris S3, VAPID)                                                                                                                                                                         |

> On `main` only: there is also a `docker-compose.yml` (web + sync + push + minio, with a `sync` healthcheck and `push depends_on sync`) and an `apps/sync` Triplit server. **Neither exists on `migrate/triplit-to-postgres`** (compose removed; Triplit dropped).

---

## 5. Deployment Topology

### 5a. This branch (`migrate/triplit-to-postgres`) — intended target: **Fly.io**

Per `docs/archive/fly-migration.md` + `docs/specs/fly-setup-guide.md` + `DEPLOY.md`:

- **web** → a Fly Machine (Next.js). `NEXT_PUBLIC_*` baked at build (build args / image), server secrets as Fly secrets.
- **push** → a second Fly Machine running `apps/push` (`tsx worker.ts`), needs `DATABASE_URL` + VAPID secrets.
- **Postgres** → Supabase Postgres (or Fly Postgres) via `DATABASE_URL`.
- **Auth** → **Supabase Cloud** (`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`), API routes validate JWTs with `SUPABASE_SERVICE_ROLE_KEY`.
- **Object storage** → Tigris (S3-compatible) for profile photos.
- There is **no Tailscale, no funnel/serve, no docker-compose** in this model. HTTPS comes from Fly. As of this writing the Fly deploy has **not** been executed; this is design intent in the specs.

### 5b. `main` branch — current self-hosted reality (where device testing happened)

Self-hosted on a home box via **Docker Compose** + **Tailscale**:

- web exposed publicly via Tailscale **funnel `443 → 3000`** at `https://mayrons-macbook-pro.tail49f713.ts.net`.
- sync (Triplit) + Supabase exposed **tailnet-only via `tailscale serve`**: `serve 8443 → 8787` (sync), `serve 10000 → 54321` (Supabase). Chosen for security → **the iPhone must have Tailscale ON** for login/sync/push-scheduling.
  - **Alternative considered:** public **funnel** on `8443`/`10000` instead of serve — works without Tailscale on the phone, but exposes the Supabase API publicly. Tradeoff: convenience vs. exposure.
  - **Gotcha that forced 8443/10000:** `tailscale serve` on a service's own port (`8787`/`54321`) collides with the docker/Kong host bind (`bind: address already in use`). Use the spare funnel-class ports.
- On-disk `.env` (this machine) still carries the `main` self-host URL values (redacted forms): `NEXT_PUBLIC_SUPABASE_URL=https://…ts.net:10000`, `NEXT_PUBLIC_TRIPLIT_URL=https://…ts.net:8443`. **These are stale for `migrate/triplit-to-postgres`** (which uses Supabase Cloud + `DATABASE_URL`, and has no Triplit URL).

---

## 6. Environment / Secrets

`.env` is gitignored — keep secrets out of git and out of this doc. Names + purpose:

| Var                                                                                             | Scope          | Purpose                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                  | server         | Postgres conn string for `@rackd/db` **and** `apps/push`. **Required on this branch.** ⚠️ **Currently MISSING from on-disk `.env`** — must be added to run the Postgres pipeline locally. |
| `DATABASE_SSL`                                                                                  | server         | optional; `false` only for a local non-TLS Postgres                                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_URL`                                                                      | client (baked) | Supabase project URL (Cloud `https://xxxx.supabase.co` on this branch)                                                                                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                                 | client (baked) | Supabase anon key (public)                                                                                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                     | server         | API routes validate the caller's JWT — **never expose to client**                                                                                                                         |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                                                                  | client (baked) | VAPID public key the browser subscribes with                                                                                                                                              |
| `VAPID_PUBLIC_KEY`                                                                              | server (push)  | same public key, used by the sender                                                                                                                                                       |
| `VAPID_PRIVATE_KEY`                                                                             | server (push)  | **secret** — VAPID private key (redacted)                                                                                                                                                 |
| `VAPID_SUBJECT`                                                                                 | server (push)  | contact URI. **Still placeholder `mailto:admin@rackd.local` in on-disk `.env`**; worker default is `mailto:admin@rackd.app`. Set a real address.                                          |
| `S3_ENDPOINT` / `S3_PUBLIC_URL` / `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | server         | Tigris object storage (profile photos)                                                                                                                                                    |
| `JWT_SECRET`, `SUPABASE_JWT_SECRET`, `MINIO_*`, `NEXT_PUBLIC_TRIPLIT_URL`                       | —              | **legacy** (Triplit/self-host era); unused on this branch                                                                                                                                 |

**VAPID keys** — the public key must match between client and sender, or APNs rejects.
Regenerate with: `npx web-push generate-vapid-keys` → put the public value in both `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PUBLIC_KEY`, the private value in `VAPID_PRIVATE_KEY`. Rebuild web (public key is baked) and restart the push worker after any change.

---

## 7. Known Gotchas (learned the hard way)

- **Mixed content:** an HTTPS page cannot call `http://` APIs (Safari blocks silently → login/sync "just fails"). The client URLs are **baked at build** (`NEXT_PUBLIC_*`), so you must **rebuild web** after changing them; confirm the built bundle contains no `http://` origins.
- **Stale service worker / old PWA install:** a SW or home-screen app cached during a broken window will re-serve a bad bundle. On retest: delete the home-screen PWA **and** clear website data for the host, then reload.
- **Permission timing:** the push subscription is registered **on the rest where permission is granted**, so the **next** rest is the first one that can actually schedule/fire a background push. Don't expect the very first post-grant rest to push.
- **`tailscale serve` port collisions (self-host only):** serve on a service's own port conflicts with the docker/Kong host bind — use spare ports (`8443`/`10000`).
- **Supabase site_url (self-host only):** `supabase/config.toml` `site_url`/redirects only apply after a Supabase **stack** restart (Supabase runs as its own stack, not docker-compose). The running local stack's project name is **`fitnow`** while config says `myfit`, so a naive `supabase stop && supabase start` targets a different project — it was **not** restarted. Password login doesn't use `site_url`, so this is **non-blocking** for login (only email/OAuth-redirect flows need it).
- **Schema baking (Triplit/`main` only):** the Triplit sync server bakes the schema at startup — restart it after schema changes. **N/A on this branch** (Postgres uses Drizzle migrations instead; see `packages/db` + `seed-pg.ts`).
- **iOS notifications** require an **installed** PWA (Add to Home Screen, iOS 16.4+) over a **secure context**; only `ServiceWorkerRegistration.showNotification` works (not `new Notification()`).

---

## 8. Verified vs. NOT Verified

**Verified**

- Foreground notification on a real iPhone (app open/unlocked).
- (On `main` self-host) all HTTPS endpoints return 200 (web/sync/Supabase), CORS `*`, baked bundle had no `http://` origins.
- (On `main` self-host) server-side end-to-end delivery: a manually-seeded due row was delivered by the worker without error.

**NOT verified**

- An actual background push arriving on a **LOCKED** iPhone (the headline acceptance test).
- The **Postgres** pipeline (this branch) end-to-end on device — it's built but not deployed/tested; `DATABASE_URL` isn't even set in the local `.env` yet.

---

## 9. Concrete Next Steps to Close the Locked-Phone Push

> Do these on `migrate/triplit-to-postgres` (the Postgres pipeline) unless you deliberately want to finish it on `main` first.

### 9.0 Make the Postgres pipeline runnable locally

1. Add `DATABASE_URL` to `.env` (Supabase Postgres or local Postgres). Run the Drizzle migrations / `packages/db` seed (`seed-pg.ts`) so the `push_subscriptions` / `scheduled_pushes` tables exist.
2. Ensure VAPID vars are set and the public key is **baked into web** (rebuild). Set a real `VAPID_SUBJECT`.
3. Run web (`pnpm --filter @rackd/web dev` or the Fly/image build) and the worker (`pnpm --filter @rackd/push start`, with `DATABASE_URL` + VAPID in env). Worker should log `[push] sender up — polling Postgres every 1000ms`.
4. Serve the app over **HTTPS** reachable by the phone (Fly URL, or the `main` Tailscale setup). iOS needs a secure context.

### 9.1 Confirm a subscription row exists for the device

After installing the PWA from the HTTPS URL, logging in, finishing a set, and granting permission:

```sql
-- against the Postgres DATABASE_URL
select id, owner_id, left(endpoint, 40) as endpoint, user_agent, created_at
from push_subscriptions order by created_at desc limit 5;
```

- **No row?** → client registration failed. Debug `registerPushSubscription` on device: permission actually granted? `NEXT_PUBLIC_VAPID_PUBLIC_KEY` baked + valid (applicationServerKey / base64url conversion)? `/api/push-subscriptions` returning 201 (check Network tab / web logs)? Signed-in (the call short-circuits when `getCurrentUserId()` is null)?

### 9.2 Start a rest, LOCK the phone, watch the worker

```bash
# scheduled row created at rest start?
psql "$DATABASE_URL" -c "select id,status,fire_at,title from scheduled_pushes order by created_at desc limit 5;"
# worker delivery attempt + APNs response
pnpm --filter @rackd/push start     # or: docker logs <push-container>   (main)
```

Interpret:

- **No scheduled row** → client scheduling broke (`scheduleRestPush` / `/api/scheduled-pushes`).
- **Row but no send** → worker not seeing it: check `getPendingPushes()` (status filter, join), `DATABASE_URL` correctness, the `fireAt > now` comparison.
- **Send attempted, APNs error:** `403` → bad `VAPID_SUBJECT`/key mismatch; `410`/`404` → subscription expired (worker auto-prunes — re-subscribe on device); `400` → malformed payload/keys.
- **Send OK (200/201) but no banner** → SW `push` handler (`apps/web/src/app/sw.ts`) payload shape, or iOS-side: notifications permission, Focus/DND, must be the **installed** PWA, app actually backgrounded/locked.

### 9.3 Retest sequence on the iPhone (exact)

1. (self-host path) Tailscale **ON**; open the **HTTPS** URL.
2. Delete any old home-screen PWA; clear website data for the host.
3. Reload → log in → **Add to Home Screen** → open the PWA.
4. Finish a set → **grant** the notification prompt (registers the subscription).
5. Start the **next** rest → **lock the phone** → wait for `endAt`.
6. Expect "Rest over / Time for your next set." on the lock screen.

---

## 10. TODO Bookkeeping

- **#10 (timer backdrop)** — ready to tick (done & shipped).
- **#9 (close timer + notify iPhone)** — keep open until a background push is confirmed on a **locked** iPhone.
- `TODO.md` has **not** been updated yet.

---

## Related Resources

- `docs/archive/fly-migration.md`, `docs/specs/fly-setup-guide.md`, `DEPLOY.md` — Fly + Supabase Cloud + Tigris target for this branch.
- `docs/archive/migration-brief.md`, `docs/archive/ui-migration-contract.md` — broader Triplit→Postgres migration context.
- `CLAUDE.md` (repo root) — project conventions (note: some Docker/Triplit/Supabase-local guidance there reflects the `main` self-host era).
- Branch commit that ported push to Postgres: `0f008e6 feat: migrate from Triplit to Postgres + API routes + React Query`.
