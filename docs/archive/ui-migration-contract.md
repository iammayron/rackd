# UI migration contract (Triplit → React Query + API)

Reference for migrating `apps/web` UI files off Triplit onto React Query + the JSON API. The backend (DB + 43 routes) is DONE and green. **You only touch UI files.**

## Hard rules

1. **Never value-import `@rackd/db` from a UI file** — it pulls in `pg` (Node-only) and breaks the client bundle. Replace every value import with an `api()` call. Domain TYPES: import from `@rackd/core` (`import type { ... }`), or if the type only lived in `@rackd/db`, redefine a minimal local `interface`. `DetectedPR`, `SaveBackMode`, `SaveBackContext`, `ExerciseStatPoint`, `PrevSet`, `ProfilePatch`, `SharedRoutineRow` were in `@rackd/db` — redefine locally as needed (type-only).
2. **Delete** imports of `@/lib/triplit` (`getClient`) and `@/lib/use-query` (the old `useQuery`).
3. **Mutations never send `ownerId`** — the server derives it from the JWT. Drop `getCurrentUserId()` from write payloads. `getCurrentUserId()` may still be read elsewhere; only remove it where it fed a mutation's ownerId.
4. Keep all existing markup, styling, derivations (`useMemo`), and component structure. Only swap the data layer.
5. Do NOT run typecheck (app is mid-migration). Write clean, consistent code.

## Read pattern

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";

const { data: routines = [] } = useQuery({
  queryKey: qk.routines,
  queryFn: () => api<Routine[]>("/api/routines"),
});
```

- Triplit's `const { results: x } = useQuery((c) => c.query("..."))` → React Query as above. Default `data` to `[]`/sensible empty.
- Triplit gave live updates for free; React Query does not. After a mutation, **invalidate** the affected query keys.
- A reactive query that depended on another value → use `enabled: Boolean(dep)` and put the dep in the queryKey.

## Mutation pattern

```ts
import { useMutation } from "@tanstack/react-query";
import { queryClient, qk } from "@/lib/query";
import { api } from "@/lib/api";

const rename = useMutation({
  mutationFn: (vars: { id: string; name: string }) =>
    api(`/api/routines/${vars.id}`, { method: "PUT", body: JSON.stringify({ name: vars.name }) }),
  onSuccess: (_d, vars) => {
    queryClient.invalidateQueries({ queryKey: qk.routines });
    queryClient.invalidateQueries({ queryKey: qk.routine(vars.id) });
  },
});
```

- For simple imperative call sites (inside an existing `async function handleX()`), you may skip `useMutation` and just `await api(path, { method, body: JSON.stringify(payload) })` then `queryClient.invalidateQueries(...)`. Use whichever keeps the diff smallest and the file consistent.
- `api(path, { method, body })` throws on non-2xx. `body` must be a JSON string.
- Import `queryClient` and `qk` from `@/lib/query`.

## Endpoint reference

**IMPORTANT: open the route file under `apps/web/src/app/api/<path>/route.ts` to confirm the exact JSON response shape before wiring a page.** Summary:

Exercises

- `GET /api/exercises` → `Exercise[]` (library + caller's custom)
- `POST /api/exercises` body `{name, primaryMuscle, equipment, category, instructions?, secondaryMuscles?}` → created exercise
- `GET|PUT|DELETE /api/exercises/[id]`
- `GET /api/exercises/[id]/stats` → `ExerciseStatPoint[]` (`{sessionId,date,best1rm,volume,topWeight}`)
- `GET /api/exercises/[id]/last-performance?excludeSessionId=` → `PrevSet[] | null` (`{order,weight,reps}[]`)

Routines

- `GET /api/routines` → `Routine[]` (ordered)
- `POST /api/routines` body `{name, order?, category?}` → routine
- `GET /api/routines/[id]` → `{ ...routine, exercises: [{ ...routineExercise, exercise: Exercise, sets: RoutineSet[] }] }`
- `PUT /api/routines/[id]` body any of `{name}|{category}|{scheduledDays:number[]}` → routine
- `DELETE /api/routines/[id]`
- `POST /api/routines/[id]/duplicate` → `{ id }`
- `POST /api/routines/[id]/publish` body `{authorName}` → sharedRoutine
- `GET /api/routines/[id]/exercises` → `[{ ...routineExercise, exercise, sets }]`
- `POST /api/routines/[id]/exercises` body `{exerciseId, order}` → routineExercise
- `PUT /api/routines/[id]/exercises/reorder` body `{orderedIds:string[]}`
- `PUT /api/routine-exercises/[id]` body any of `{restSec}|{supersetGroup}|{order}`
- `DELETE /api/routine-exercises/[id]`
- `POST /api/routine-exercises/[id]/replace` body `{exerciseId}`
- `POST /api/routine-sets` body `{routineExerciseId, order, targetReps?, targetWeight?, type?}` → routineSet
- `PUT /api/routine-sets/[id]` body `{targetReps?, targetWeight?}`
- `DELETE /api/routine-sets/[id]`

Sessions

- `GET /api/sessions` → finished `Session[]` (newest first)
- `GET /api/sessions/active` → unfinished `Session | null`
- `POST /api/sessions` body `{routineId?}` (from routine) or `{name?}` (blank) → session
- `GET /api/sessions/[id]` → `{ ...session, exercises: [{ ...sessionExercise, exercise: Exercise, sets: SetLog[] }] }`
- `POST /api/sessions/[id]/finish` → `{ prs: DetectedPR[] }` (`DetectedPR = {exerciseId, type:"1rm"|"weight", value}`)
- `POST /api/sessions/[id]/discard`
- `POST /api/sessions/[id]/save-back` body `{routineId, mode}` (`mode: "numbers"|"exercises"|"everything"`)
- `GET /api/sessions/[id]/save-back-context` → `SaveBackContext | null`
- `POST /api/sessions/[id]/exercises` body `{exerciseId, order, restSec?}`
- `PUT /api/sessions/[id]/exercises/reorder` body `{orderedIds}`
- `PUT /api/session-exercises/[id]` body `{restSec}|{order}`
- `DELETE /api/session-exercises/[id]`
- `POST /api/session-exercises/[id]/replace` body `{exerciseId}`
- `POST /api/set-logs` body `{sessionExerciseId, order, weight?, reps?, rpe?, type?, completed?}` (completed:true → logged set)
- `PUT /api/set-logs/[id]` body `{weight?, reps?, rpe?, completed?}`
- `DELETE /api/set-logs/[id]`

Stats / profile / body / PRs

- `GET /api/personal-records` → `PR[]` (newest first), `GET /api/personal-records/exercise/[id]`
- `GET /api/profile` → profile (created if missing); `PUT /api/profile` body ProfilePatch
- `GET /api/body-weight?from=&to=` (range) or no params (all) → `BodyWeightLog[]`; `POST /api/body-weight` body `{weightKg, loggedAt?}`
- `GET /api/stats/weekly-volume` → `{weekStart:number, volume:number}[]`

Programs / shared / templates

- `GET /api/programs` → `Program[]`; `POST /api/programs` body `{name, order?, blockWeeks?}`
- `GET /api/programs/[id]` → `{ ...program, days: [{ ...programDay, routine: Routine|null }] }`
- `PUT /api/programs/[id]` body any of `{name}|{active:true}|{scheduleMode?,rotationCursor?,blockWeeks?}`
- `DELETE /api/programs/[id]`
- `POST /api/programs/[id]/days` body `{order, name?, routineId?, weekday?}`
- `PUT /api/programs/[id]/days/reorder` body `{orderedIds}`
- `PUT /api/program-days/[id]` body `{name?, routineId?(null clears), weekday?}`; `DELETE /api/program-days/[id]`
- `GET /api/shared-routines` → `SharedRoutine[]` (public, newest first)
- `POST /api/shared-routines/[id]/clone` → `{ id }` (new routine id)
- `GET /api/program-templates` → `ProgramTemplate[]`; `POST /api/program-templates/[id]/clone` → `{ id }` (new program id)

Push (lib/push.ts)

- `GET /api/push-subscriptions`; `POST /api/push-subscriptions` body `{endpoint, p256dh, auth, userAgent?}`
- `DELETE /api/push-subscriptions/[id]`
- `POST /api/scheduled-pushes` body `{subscriptionId, fireAt, title, body}`
- `PUT /api/scheduled-pushes/[id]` body `{fireAt}`; `DELETE /api/scheduled-pushes/[id]`

Domain field names are camelCase everywhere (matches `@rackd/core` types). `qk` keys live in `@/lib/query`.
