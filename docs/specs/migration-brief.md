# Migration Brief: Triplit → Postgres + API Routes

> **For Claude Code.** This document contains everything needed to execute the
> migration. Read `docs/specs/fly-migration.md` for architecture context.
> Read this file for the detailed implementation plan.

## Overview

Replace Triplit (local-first sync engine) with:
- **Drizzle ORM** talking to Supabase Postgres
- **Next.js API route handlers** for all data operations
- **React Query** (`@tanstack/react-query`) for client-side data fetching
- **IndexedDB offline mutation queue** for offline support

## Infrastructure (already done)

- Fly.io app: `rackd` at `rackd.fly.dev`
- Supabase Cloud: auth + Postgres (`DATABASE_URL` set as Fly secret)
- Tigris: object storage for profile photos (`S3_*` secrets set)
- GitHub Actions: auto-deploy on push to main

---

## Step 1: Install dependencies

```bash
# In packages/db
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg

# In apps/web
pnpm add @tanstack/react-query idb-keyval
pnpm remove @triplit/client

# Remove from apps/sync
# (entire app gets deleted in cleanup)
```

## Step 2: Drizzle schema (`packages/db/src/schema.ts`)

Replace the Triplit schema with Drizzle tables. There are 16 collections total
(14 app + 2 push-related). Map them to Postgres tables:

```
exercises            → exercises
routines             → routines
routineExercises     → routine_exercises
routineSets          → routine_sets
sessions             → sessions
sessionExercises     → session_exercises
setLogs              → set_logs
personalRecords      → personal_records
bodyMetrics          → body_metrics
bodyWeightLogs       → body_weight_logs
programs             → programs
programDays          → program_days
sharedRoutines       → shared_routines
userProfile          → user_profiles
pushSubscriptions    → push_subscriptions
scheduledPushes      → scheduled_pushes
```

All tables need:
- `id` TEXT PRIMARY KEY (use `uuidv7()` from the app, not Postgres-generated)
- `ownerId` TEXT NOT NULL (= Supabase `auth.users.id`)
- Appropriate foreign keys with CASCADE deletes where parent-child

See the full field list in `docs/specs/fly-migration.md` §4.1 and the Triplit
schema audit below.

### Triplit Schema Field Reference

**exercises**: id, name, primaryMuscle, secondaryMuscles (Set→TEXT[]),
equipment, category, instructions, thumbnailUrl?, clipUrl?, clipUrlWebm?,
mediaSource, isCustom, ownerId?

**routines**: id, ownerId, name, folderId?, notes?, order, category?,
scheduledDays? (Set<Number>→INTEGER[])

**routineExercises**: id, ownerId, routineId→FK, exerciseId→FK, order,
supersetGroup?, restSec, notes?

**routineSets**: id, ownerId, routineExerciseId→FK, order, type,
targetReps?, targetWeight?, targetRpe?, tempo?

**sessions**: id, ownerId, routineId?, name, startedAt, endedAt?, notes?,
bodyweight?

**sessionExercises**: id, ownerId, sessionId→FK, exerciseId→FK, order,
supersetGroup?, restSec

**setLogs**: id, ownerId, sessionExerciseId→FK, order, type, weight, reps,
rpe?, completed, restTakenSec?, isPr

**personalRecords**: id, ownerId, exerciseId→FK, type ("1rm"|"weight"),
value, sessionId, achievedAt

**bodyMetrics**: id, ownerId, date, weightKg, note?

**bodyWeightLogs**: id, ownerId, weightKg, loggedAt

**programs**: id, ownerId, name, notes?, order, blockWeeks?, active?,
scheduleMode?, rotationCursor?

**programDays**: id, ownerId, programId→FK, order, name, routineId?→FK,
weekday?

**sharedRoutines**: id, ownerId, authorName, name, exercisesJson (JSONB),
exerciseCount, createdAt

**userProfile**: id, ownerId, displayName?, photoUrl?, heightCm?,
currentWeightKg?, goalWeightKg?, trainingGoal?, unitPreference,
defaultRestSec, defaultSets, defaultReps

**pushSubscriptions**: id, ownerId, endpoint, p256dh, auth, userAgent?,
createdAt

**scheduledPushes**: id, ownerId, subscriptionId→FK, fireAt, title, body,
status, createdAt

## Step 3: Drizzle migration

```bash
cd packages/db
npx drizzle-kit generate   # generates SQL migration
npx drizzle-kit push       # applies to Supabase Postgres
```

Need `drizzle.config.ts` in `packages/db` pointing at `DATABASE_URL`.

## Step 4: Seed the exercise library

Move `packages/db/src/seed.ts` to a server-side migration script. The exercise
library (SEED_EXERCISES) should be inserted into Postgres once, not on every
login. Create an API route or a standalone script:

```bash
npx tsx packages/db/src/seed-pg.ts
```

## Step 5: Rewrite repository functions

`packages/db/src/index.ts` currently exports ~50 functions that take a Triplit
`client` as the first argument. Rewrite them to use the Drizzle `db` instance
instead. Keep the same function names and return types where possible.

Key changes:
- `client.insert(collection, doc)` → `db.insert(table).values(doc)`
- `client.update(collection, id, fn)` → `db.update(table).set(patch).where(eq(table.id, id))`
- `client.delete(collection, id)` → `db.delete(table).where(eq(table.id, id))`
- `client.fetchById(collection, id)` → `db.select().from(table).where(eq(table.id, id))`
- `client.fetch(query)` → `db.select().from(table).where(...).orderBy(...)`

The functions no longer take a `client` param — they use a module-level `db`
instance initialized from `DATABASE_URL`.

## Step 6: Create API route handlers

All routes go in `apps/web/src/app/api/`. Every route:
1. Validates the Supabase JWT from the `Authorization: Bearer <token>` header
2. Extracts `ownerId` from the token's `sub` claim
3. Adds `WHERE owner_id = ownerId` to every query (except public reads on exercises/sharedRoutines)
4. Returns JSON

### Auth middleware helper

```typescript
// apps/web/src/lib/api-auth.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getAuthUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}
```

### Route list

```
GET    /api/exercises                    — list (public + user's custom)
POST   /api/exercises                    — create custom exercise
GET    /api/exercises/[id]               — single exercise
PUT    /api/exercises/[id]               — update custom exercise
DELETE /api/exercises/[id]               — delete custom exercise

GET    /api/routines                     — list user's routines
POST   /api/routines                     — create routine
GET    /api/routines/[id]                — routine with exercises + sets
PUT    /api/routines/[id]                — update (rename, reorder, etc.)
DELETE /api/routines/[id]                — delete routine (cascades)
POST   /api/routines/[id]/duplicate      — deep copy
POST   /api/routines/[id]/publish        — publish to shared

GET    /api/routines/[id]/exercises      — list routine exercises with sets
POST   /api/routines/[id]/exercises      — add exercise to routine
PUT    /api/routines/[id]/exercises/reorder — reorder exercises
PUT    /api/routine-exercises/[id]       — update routine exercise
DELETE /api/routine-exercises/[id]       — remove exercise from routine
POST   /api/routine-exercises/[id]/replace — replace exercise

POST   /api/routine-sets                 — add set to routine exercise
PUT    /api/routine-sets/[id]            — update set
DELETE /api/routine-sets/[id]            — delete set

GET    /api/sessions                     — list finished sessions (history)
POST   /api/sessions                     — start session (blank or from routine)
GET    /api/sessions/[id]                — session with exercises + sets
POST   /api/sessions/[id]/finish         — finish (runs PR detection)
POST   /api/sessions/[id]/discard        — discard session
POST   /api/sessions/[id]/save-back      — apply changes back to routine

POST   /api/sessions/[id]/exercises      — add exercise to session
PUT    /api/sessions/[id]/exercises/reorder — reorder
PUT    /api/session-exercises/[id]       — update (rest time, etc.)
DELETE /api/session-exercises/[id]       — remove exercise
POST   /api/session-exercises/[id]/replace — replace exercise

POST   /api/set-logs                     — add set log
PUT    /api/set-logs/[id]                — update set log
DELETE /api/set-logs/[id]                — delete set log

GET    /api/personal-records             — list PRs
GET    /api/personal-records/exercise/[id] — PRs for exercise

GET    /api/body-weight                  — list logs
POST   /api/body-weight                  — log weight

GET    /api/profile                      — get user profile
PUT    /api/profile                      — update profile
POST   /api/profile-photo               — upload photo (existing, swap S3 creds)

GET    /api/programs                     — list programs
POST   /api/programs                     — create program
GET    /api/programs/[id]                — program with days
PUT    /api/programs/[id]                — update (rename, schedule, active)
DELETE /api/programs/[id]                — delete program
POST   /api/programs/[id]/days           — add day
PUT    /api/program-days/[id]            — update day
DELETE /api/program-days/[id]            — remove day
PUT    /api/programs/[id]/days/reorder   — reorder days

GET    /api/shared-routines              — list shared routines
POST   /api/shared-routines/[id]/clone   — clone to user's routines

GET    /api/exercises/[id]/stats         — exercise history stats
GET    /api/exercises/[id]/last-performance — last performance data

GET    /api/stats/weekly-volume          — aggregated weekly volume
GET    /api/sessions/active              — get active (unfinished) session
```

## Step 7: Client data layer

### 7a: API client helper

```typescript
// apps/web/src/lib/api.ts
import { getSession } from "./supabase";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getSession();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}
```

### 7b: React Query hooks

Replace every `useQuery` (Triplit) call with a React Query `useQuery` hook.
Example pattern:

```typescript
// Before (Triplit):
const { results: routines } = useQuery(
  (client) => client.query("routines").Order("order", "ASC"),
  [userId]
);

// After (React Query):
const { data: routines } = useQuery({
  queryKey: ["routines"],
  queryFn: () => api<Routine[]>("/api/routines"),
});
```

For mutations:

```typescript
const finishMutation = useMutation({
  mutationFn: (id: string) => api(`/api/sessions/${id}/finish`, { method: "POST" }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["personal-records"] });
  },
});
```

### 7c: Offline mutation queue

```typescript
// apps/web/src/lib/offline-queue.ts
import { get, set, del, keys } from "idb-keyval";

interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  body?: string;
  createdAt: number;
}

export async function enqueue(mutation: Omit<QueuedMutation, "id" | "createdAt">) {
  const entry: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await set(`mutation:${entry.id}`, entry);
}

export async function flushQueue(getToken: () => Promise<string | null>) {
  const allKeys = await keys();
  const mutationKeys = allKeys.filter((k) => String(k).startsWith("mutation:"));
  // Sort by createdAt for FIFO
  const entries: QueuedMutation[] = [];
  for (const key of mutationKeys) {
    entries.push(await get(key));
  }
  entries.sort((a, b) => a.createdAt - b.createdAt);

  for (const entry of entries) {
    const token = await getToken();
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: entry.body,
      });
      if (res.ok) await del(`mutation:${entry.id}`);
      else break; // stop on failure
    } catch {
      break; // offline still, stop
    }
  }
}
```

Wire `flushQueue` to `window.addEventListener("online", ...)` and on app mount.

### 7d: React Query persistence

Use `@tanstack/query-persist-client-core` + `idb-keyval` to persist the query
cache to IndexedDB. This gives offline reads.

## Step 8: Update AuthProvider

Remove:
- `client.startSession(accessToken, true)` — no longer needed
- `client.endSession()` — no longer needed
- `seedExercises(client)` — seed is now a one-time server migration

Keep:
- Supabase `onAuthStateChange` listener
- `signIn`, `signUp`, `signOut` functions
- `user`, `loading` state

Add:
- React Query `QueryClientProvider` wrapping the app
- Pass the Supabase access token to the API client

## Step 9: Update providers.tsx

```typescript
// Wrap with QueryClientProvider
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// In the component tree:
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    {children}
  </AuthProvider>
</QueryClientProvider>
```

## Step 10: Cleanup

1. Delete `apps/sync/` entirely
2. Delete `apps/push/` (or rewrite to poll Postgres instead of Triplit subscribe)
3. Remove `@triplit/client`, `@triplit/server`, `better-sqlite3` from all package.json
4. Remove `apps/web/src/lib/triplit.ts`
5. Remove `apps/web/src/lib/use-query.ts` (the old Triplit hook)
6. Remove `docker-compose.yml`, `docker-compose.override.yml`
7. Update `CLAUDE.md` — remove all Triplit/sync/MinIO references
8. Update `DEPLOY.md` — replace with Fly.io deployment instructions
9. Remove `NEXT_PUBLIC_TRIPLIT_URL` from Dockerfile ARGs and all env references

## Step 11: Verify

```bash
pnpm typecheck
pnpm test
```

Then deploy and test the full flow in the browser.

---

## Files to modify (summary)

### New files
- `packages/db/src/schema.ts` (rewrite)
- `packages/db/src/index.ts` (rewrite)
- `packages/db/src/db.ts` (new — Drizzle client)
- `packages/db/drizzle.config.ts`
- `packages/db/src/seed-pg.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/api-auth.ts`
- `apps/web/src/lib/offline-queue.ts`
- `apps/web/src/app/api/**` (~25 route files)

### Files to modify
- `apps/web/src/lib/auth.tsx` — remove Triplit wiring
- `apps/web/src/app/providers.tsx` — add QueryClientProvider
- `apps/web/src/app/page.tsx` — React Query hooks
- `apps/web/src/app/discover/page.tsx`
- `apps/web/src/app/history/page.tsx`
- `apps/web/src/app/history/[id]/page.tsx`
- `apps/web/src/app/exercise/[id]/page.tsx`
- `apps/web/src/app/prs/page.tsx`
- `apps/web/src/app/programs/page.tsx`
- `apps/web/src/app/programs/[id]/page.tsx`
- `apps/web/src/app/routines/page.tsx`
- `apps/web/src/app/routines/[id]/page.tsx`
- `apps/web/src/app/workout/[id]/page.tsx`
- `apps/web/src/app/workout/[id]/summary/page.tsx`
- `apps/web/src/features/active-workout/ExerciseCard.tsx`
- `apps/web/src/features/active-workout/SetRow.tsx`
- `apps/web/src/features/active-workout/MiniWorkoutBar.tsx`
- `apps/web/src/features/dashboard/WeightProgressCard.tsx`
- `apps/web/src/features/dashboard/HistoryStreakCard.tsx`
- `apps/web/src/features/dashboard/WeeklyVolumeCard.tsx`
- `apps/web/src/features/routines/AddExercisePicker.tsx`
- `apps/web/src/features/routines/ReplaceExercisePicker.tsx`
- `apps/web/src/features/routines/RoutineExerciseEditor.tsx`
- `apps/web/src/features/settings/SettingsForm.tsx`
- `apps/web/src/lib/push.ts`
- `apps/web/Dockerfile`
- `packages/db/package.json`
- `apps/web/package.json`
- `CLAUDE.md`
- `DEPLOY.md`

### Files to delete
- `apps/sync/` (entire directory)
- `apps/push/` (entire directory, or rewrite)
- `apps/web/src/lib/triplit.ts`
- `apps/web/src/lib/use-query.ts`
- `docker-compose.yml`
- `docker-compose.override.yml`
- `.env.example` (rewrite for Fly.io)

---

## Execution order

Work in this order to minimize broken intermediate states:

1. **Schema + DB layer first** (packages/db) — no UI changes yet
2. **API routes** (apps/web/src/app/api/) — test with curl
3. **Seed the exercise library** — run seed script against Supabase
4. **Client hooks + offline queue** — one page at a time, starting with the simplest (discover, prs) and ending with the most complex (workout/[id])
5. **Auth wiring** — update providers.tsx and auth.tsx
6. **Cleanup** — delete old files, update docs
7. **Typecheck + test** — fix everything
