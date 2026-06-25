---
description: Scaffold an owner-scoped API route + repo function + client query wiring
---

Add a new API endpoint end-to-end, following this repo's layering and the ownerId
security rule. `$ARGUMENTS` describes the endpoint (e.g. "GET+POST /api/programs/[id]/days",
or "add a route to archive a routine"). If it's vague, ask for: method(s), path, and
what data goes in/out.

Context (precomputed):

- Routes today: !`find apps/web/src/app/api -name route.ts | wc -l` under `apps/web/src/app/api`
- qk registry: !`grep -n "export const qk" apps/web/src/lib/query.ts`
- Repo fns live in: `packages/db/src/index.ts`

The layers (never skip one, never collapse two):

1. **Repo function** (`packages/db/src/index.ts`) — the ONLY place that touches Postgres.
   - Signature takes `{ ownerId, … }`; every read/write filters/sets by `ownerId`. Use the
     Drizzle `db` + `t.<table>` already imported in that file. Match the style of
     `createRoutine` / `renameRoutine` (small, single-purpose, returns the row).
   - Mutating an existing owned row → scope the `where` by both `id` AND `ownerId` so one
     owner can't touch another's row.
   - If it needs a new table/column, that's a schema change — stop and run `/db-migrate` first.

2. **Route handler** (`apps/web/src/app/api/<path>/route.ts`):
   ```ts
   import { withUser } from "@/lib/api-auth";
   import { <repoFn>, db, schema } from "@rackd/db";

   export const runtime = "nodejs";

   /** GET /api/... — one line on what it returns. */
   export const GET = withUser(async (ownerId, req, ctx) => {
     // dynamic route: const { id } = await ctx.params;
     const rows = await <repoFn>({ ownerId /* … */ });
     return Response.json(rows);
   });
   ```
   - **Always** `withUser`; derive `ownerId` from it. NEVER read an ownerId from the body,
     query string, or params — that's the core security gotcha.
   - POST returns `201`; mutations with no body return `Response.json(row)` or a 204.
   - `[id]` params come from `await ctx.params` (the `RouteCtx` is typed loosely on purpose).

3. **Client wiring**:
   - Add a key to the `qk` registry in `apps/web/src/lib/query.ts` (static `[...] as const`,
     or a `(id) => [...] as const` for parametric).
   - Read: `useQuery({ queryKey: qk.<x>, queryFn: () => api<T>("/api/...") })`.
   - Write: call `api`/`apiMutate` then `queryClient.invalidateQueries({ queryKey: qk.<x> })`.
     Use `apiMutate` for fire-and-forget writes that should survive offline (queues in
     IndexedDB); plain `api` when the caller must see the error.
   - Types come from `@rackd/core` — import them, never redeclare a domain shape. Weight is
     canonical **kg** on the wire; convert at the display edge with `fromKg`/`toKg`.
   - Never value-import `@rackd/db` into a client component (pulls in `pg`); `import type` only.

4. **Test** — repo function gets a `packages/db` test (ownership scoping + behavior, via
   `test/factories.ts`); route isolation gets an `apps/web/test` test if the pattern is new.
   Invoke the **test-author** agent if non-trivial.

5. Run the gate: `pnpm typecheck && pnpm test`. Report the files touched (repo fn, route,
   qk key, client hook) and the exact route(s) added.
