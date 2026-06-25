# MyFit → Fly.io Migration Spec

> **Status:** Draft  
> **Date:** 2026-06-24  
> **Goal:** Migrate from self-hosted Docker Compose (home box + Tailscale) to Fly.io. Drop Triplit in favor of Postgres + offline mutation queue. Use Supabase Cloud for auth, Tigris for object storage.

---

## 1. Current Architecture

```
Home box (Docker Compose + Tailscale)
├── web        — Next.js 15 PWA (standalone), port 3000
├── sync       — Triplit sync server (SQLite volume), port 8787
├── minio      — S3-compatible object store (profile photos), ports 9000/9001
└── supabase   — Auth only (CLI-managed, ~10 containers), port 54321
```

**Data flow today:**

- Browser runs Triplit client → IndexedDB (local-first)
- Triplit client syncs to the sync server over WebSocket
- Sync server stores data in SQLite on a Docker volume
- Auth: Supabase issues RS256 JWTs → Triplit validates them
- Profile photos: Next.js API route → MinIO (manual SigV4 signing)
- 14 Triplit collections, ~35 repository functions in `@rackd/db`

**Key dependencies:** `@triplit/client`, `@triplit/server`, `@supabase/supabase-js`, `better-sqlite3`, `serwist` (service worker), `zustand`, `preline`, `tailwindcss`

---

## 2. Target Architecture

```
Fly.io
├── web         — Fly Machine (shared-cpu-1x, 512MB–1GB)
│                 Next.js 15 standalone, auto-stop when idle
├── postgres    — Fly Managed Postgres (Basic plan, 1GB RAM)
│                 All app data: exercises, routines, sessions, etc.
├── tigris      — S3-compatible object storage (profile photos)
└── (external)  — Supabase Cloud free tier (auth only)
```

**What's removed:**

- Triplit sync server (replaced by Postgres + offline queue)
- Triplit client (replaced by React Query + IndexedDB offline queue)
- MinIO (replaced by Tigris)
- Self-hosted Supabase (replaced by Supabase Cloud free tier)
- Home box / Tailscale / Docker Compose

---

## 3. Why Drop Triplit

Triplit solves multi-user real-time collaboration with conflict resolution. MyFit is a single-user personal app. The complexity cost:

- Separate sync server to run and maintain
- Schema defined twice (Triplit schema + core types)
- Permission rules in the DB layer
- `syncSchema: true` + baked schema on the server
- Server restart required on any schema change
- IndexedDB ↔ WebSocket ↔ SQLite sync pipeline for one user

**Replacement:** A simple offline mutation queue achieves the same UX (works mid-workout with bad signal) with a fraction of the complexity. Mutations queue in IndexedDB when offline and flush via standard API routes when connectivity returns.

---

## 4. Data Migration: Triplit → Postgres

### 4.1 Postgres Schema

Map the 14 Triplit collections to Postgres tables. All tables get `owner_id` (UUID, FK to Supabase `auth.users`) and standard timestamps.

```
exercises           — id, name, muscleGroup, equipment, thumbnailUrl, clipUrl, ownerId, isPublic, createdAt
routines            — id, name, ownerId, scheduleDays, createdAt, updatedAt
routine_exercises   — id, routineId (FK), exerciseId (FK), position, restSeconds, notes
routine_sets        — id, routineExerciseId (FK), position, type, reps, weight, rpe
sessions            — id, routineId, routineName, startedAt, finishedAt, ownerId
session_exercises   — id, sessionId (FK), exerciseId (FK), position, restSeconds, notes
set_logs            — id, sessionExerciseId (FK), position, type, reps, weight, rpe, completedAt
personal_records    — id, exerciseId (FK), ownerId, best1rm, maxWeight, updatedAt
body_weight_logs    — id, ownerId, weight, date, createdAt
body_metrics        — id, ownerId, height, bodyFat, createdAt
user_profile        — id (= ownerId), displayName, photoUrl, unit, restTimerDefault
programs            — id, name, ownerId, isActive, schedule, currentSlot, createdAt
program_days        — id, programId (FK), routineId (FK), position, label
shared_routines     — id, name, ownerId, exercises (JSONB), createdAt
```

### 4.2 Data Export

One-time script to extract data from the running Triplit SQLite:

1. Connect to the sync server's SQLite volume
2. Query each collection
3. Transform Triplit documents → Postgres INSERT statements
4. Run against the Fly Postgres instance

Alternatively, since this is a personal app with limited data, re-seeding the exercise library and starting fresh for routines/sessions is an option.

---

## 5. Offline Mutation Queue

Replace Triplit's sync engine with a thin offline-first layer.

### 5.1 Architecture

```
┌─────────────┐     online      ┌──────────────┐     ┌──────────┐
│  React app  │ ───────────────→│ API routes   │────→│ Postgres │
│  (queries)  │ ←───────────────│ /api/*       │←────│          │
└─────────────┘                 └──────────────┘     └──────────┘
       │
       │ offline (navigator.onLine === false or fetch fails)
       ▼
┌─────────────┐
│ IndexedDB   │  mutation queue: { id, endpoint, method, body, createdAt }
│ "mutations" │  flushed FIFO on reconnect
└─────────────┘
```

### 5.2 Implementation

**New package: `packages/offline`** (or inline in `apps/web/src/lib/`)

```typescript
// Pseudocode
interface QueuedMutation {
  id: string;
  url: string;         // e.g. "/api/sets"
  method: "POST" | "PUT" | "DELETE";
  body: string;        // JSON
  createdAt: number;
}

// On mutation attempt:
async function mutate(url, method, body) {
  try {
    const res = await fetch(url, { method, body });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch {
    await enqueue({ id: uuidv7(), url, method, body, createdAt: Date.now() });
    // Optimistically update React Query cache
  }
}

// On reconnect (or periodic retry):
window.addEventListener("online", flushQueue);

async function flushQueue() {
  const pending = await getAllQueued(); // ordered by createdAt
  for (const m of pending) {
    try {
      await fetch(m.url, { method: m.method, body: m.body });
      await dequeue(m.id);
    } catch {
      break; // stop on first failure, retry later
    }
  }
}
```

### 5.3 Optimistic Updates

Use React Query's `onMutate` for instant UI feedback. If the mutation eventually fails (conflict, validation), surface a toast and revert the optimistic cache update.

### 5.4 Reads While Offline

Cache recent queries in React Query's cache (persisted to IndexedDB via `@tanstack/query-persist-client`). Stale data is acceptable for a workout in progress — the user's own recent sets and routines will be cached.

---

## 6. API Routes

Replace the ~35 Triplit repository functions with Next.js API route handlers that talk to Postgres directly. Group by domain:

```
/api/exercises          GET (list/search), POST (create custom)
/api/exercises/[id]     GET, PUT, DELETE

/api/routines           GET (list), POST
/api/routines/[id]      GET (with exercises+sets), PUT, DELETE
/api/routines/[id]/duplicate   POST
/api/routines/[id]/publish     POST

/api/sessions           GET (history, paginated), POST (start from routine)
/api/sessions/[id]      GET (with exercises+sets), PUT (finish)
/api/sessions/[id]/exercises         POST, PUT (reorder)
/api/sessions/[id]/exercises/[eid]   DELETE
/api/sessions/[id]/sets              POST
/api/sessions/[id]/sets/[sid]        PUT, DELETE

/api/personal-records   GET (by exercise or all)
/api/body-weight        GET, POST
/api/profile            GET, PUT
/api/profile-photo      POST (unchanged — swap S3 creds to Tigris)

/api/programs           GET, POST
/api/programs/[id]      GET, PUT, DELETE
/api/programs/[id]/days POST, PUT, DELETE

/api/shared-routines    GET (discover), POST (publish)
/api/shared-routines/[id]/clone  POST
```

**DB client:** Use `pg` (node-postgres) or Drizzle ORM. Drizzle is recommended — typed queries, zero runtime overhead, migration tooling.

**Auth middleware:** Validate the Supabase JWT on every request. Extract `sub` as `ownerId`. Every query includes `WHERE owner_id = $ownerId`.

---

## 7. Auth: Supabase Cloud Free Tier

No code changes needed for the auth flow. Swap environment variables:

| Variable | Old (self-hosted) | New (Supabase Cloud) |
|----------|-------------------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://box.tailXXX.ts.net:54321` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local anon key | cloud anon key |

The `AuthProvider`, `signIn`, `signUp`, `signOut` — all unchanged. The Supabase JS client just points at a different URL.

**What's removed:** RS256 signing key management, `signing_keys.json`, JWKS endpoint wrangling, `SUPABASE_JWT_SECRET` for Triplit. The API routes validate the JWT directly via the Supabase client library instead.

**Free tier limits:** 50k MAU, 500 MB database (unused — our data is in Fly Postgres), 1 GB storage (unused), unlimited API requests. More than enough for a personal app.

---

## 8. Object Storage: Tigris

Replace MinIO with Tigris. Same S3 API, minimal code changes.

**Provision:**
```bash
fly storage create --name myfit-photos
# Returns: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, BUCKET_NAME
```

**Code changes in `apps/web/src/lib/s3.ts`:**

The existing manual SigV4 signing works as-is — just swap the credentials:

| Env var | Old (MinIO) | New (Tigris) |
|---------|-------------|--------------|
| `S3_ENDPOINT` | `http://minio:9000` | Tigris endpoint from `fly storage create` |
| `S3_PUBLIC_URL` | `http://box:9000/myfit` | `https://<bucket>.fly.storage.tigris.dev` |
| `S3_BUCKET` | `myfit` | Tigris bucket name |
| `S3_ACCESS_KEY` | MinIO root user | Tigris access key |
| `S3_SECRET_KEY` | MinIO root password | Tigris secret key |

**Public access:** Set the bucket policy to allow public reads (same as MinIO's `mc anonymous set download`), so `<img>` tags can load photos directly.

**Cost:** Free tier covers 5 GB storage + 100k GET requests/month. Profile photos for one user won't approach this.

---

## 9. Fly.io Deployment Setup

### 9.1 fly.toml

```toml
app = "myfit-web"
primary_region = "iad"  # US East

[build]
  dockerfile = "apps/web/Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

### 9.2 Auto-Deploy via GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Fly.io
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### 9.3 Secrets

```bash
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  DATABASE_URL="postgres://..." \
  S3_ENDPOINT="https://fly.storage.tigris.dev" \
  S3_PUBLIC_URL="https://myfit-photos.fly.storage.tigris.dev" \
  S3_BUCKET="myfit-photos" \
  S3_ACCESS_KEY="tid_..." \
  S3_SECRET_KEY="tsec_..."
```

Note: `NEXT_PUBLIC_*` vars need to be available at build time. Set them as build args in the Dockerfile or use `fly deploy --build-arg`.

---

## 10. Estimated Monthly Cost

| Resource | Configuration | Cost |
|----------|---------------|------|
| Web Machine | shared-cpu-1x, 512MB, auto-stop | ~$1–3 |
| Managed Postgres | Basic (1 shared CPU, 1GB) + 5GB storage | ~$39 |
| Tigris | Free tier (5GB, 100k reads) | $0 |
| Supabase Cloud | Free tier (auth only) | $0 |
| SSL | First 10 certs free | $0 |
| **Total** | | **~$40–42/mo** |

**Budget option:** Use unmanaged Fly Postgres (self-run, ~$4/mo for a dev single-node) instead of managed. Brings total to ~$5–7/mo but you own Postgres operations (backups, upgrades, failover).

**Comparison to current setup:** Home box electricity + internet is "free" but requires hardware, Tailscale networking, and manual maintenance. Fly.io is fully managed with auto-deploy.

---

## 11. Migration Steps

### Phase 1: Infrastructure Setup (no code changes)
1. Create Supabase Cloud project, configure auth settings (redirect URLs, providers)
2. `fly launch` — create the Fly app
3. `fly postgres create` — provision Managed Postgres
4. `fly storage create` — provision Tigris bucket, set public read policy
5. Set all secrets via `fly secrets set`
6. Set up GitHub Actions for auto-deploy

### Phase 2: Database Layer (biggest code change)
1. Design Postgres schema (see §4.1), write Drizzle schema + migrations
2. Create new `packages/db-pg` (or replace `packages/db`) with Drizzle client + repository functions matching the existing API surface
3. Build all API route handlers (see §6)
4. Add auth middleware — validate Supabase JWT, extract `ownerId`

### Phase 3: Client Rewrite
1. Replace all `@triplit/client` usage with React Query hooks calling the new API routes
2. Implement offline mutation queue (see §5)
3. Set up `@tanstack/query-persist-client` for offline read cache
4. Remove Triplit client singleton, `startSession`/`endSession` calls
5. Update `AuthProvider` — remove `client.startSession(accessToken)`, keep Supabase auth as-is

### Phase 4: Storage Swap
1. Update `S3_*` env vars to point at Tigris
2. Test profile photo upload/display
3. Migrate existing photos from MinIO to Tigris (if needed — or start fresh)

### Phase 5: Cleanup
1. Remove `apps/sync` entirely
2. Remove `@triplit/client`, `@triplit/server`, `better-sqlite3` dependencies
3. Remove Triplit schema from `packages/db`
4. Remove Docker Compose, MinIO config, Supabase self-host config
5. Update `CLAUDE.md`, `DEPLOY.md`, `README.md`

### Phase 6: Verify
1. Test full flow: signup → create routine → run workout → log sets → finish → history
2. Test offline: airplane mode mid-workout → log sets → reconnect → verify sync
3. Test profile photo upload
4. Test auto-deploy: push to main → verify Fly deploys
5. Monitor Fly dashboard for resource usage, adjust machine size if needed

---

## 12. Risks & Open Questions

- **Managed Postgres cost ($39/mo)** is the biggest line item. For a personal app, unmanaged Postgres (~$4/mo) may be acceptable if you're comfortable with manual backups. Alternatively, explore Neon (serverless Postgres with a generous free tier) as the Fly Postgres provider — Fly supports Neon as a database option.
- **Offline mutation conflicts:** With Triplit, conflict resolution was built in. The simple offline queue relies on last-write-wins. For a single-user app this is fine, but the flush logic should handle 409s gracefully.
- **Build-time env vars:** `NEXT_PUBLIC_*` must be available at Docker build time. The current Dockerfile handles this via build args — verify this works with Fly's remote builder.
- **Cold starts:** With auto-stop enabled, the first request after idle wakes the machine. Next.js standalone cold start is typically 1–3 seconds. Acceptable for a personal app.
- **Data migration:** If preserving existing workout history matters, write an export script before decommissioning the home box. If starting fresh is OK, skip this.
- **Tigris path-style addressing:** The existing `s3.ts` uses path-style URLs (`{endpoint}/{bucket}/{key}`). Verify Tigris supports this — most S3-compatible services do, but some default to virtual-hosted style.
- **Query migration scope:** Triplit queries are inlined at each call site via a custom `useQuery` hook (no `@triplit/react`). Each call site needs to be rewritten to a React Query + fetch hook. Audit all `useQuery` call sites before estimating effort.
