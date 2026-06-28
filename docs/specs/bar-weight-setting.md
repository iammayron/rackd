# Plan: Global bar-weight setting + barbell plate math (TODO #17)

**Status:** Plan (approved direction; not started)
**Scope:** One PR. Additive DB migration + Settings field + wiring. No core-algorithm work.
**Context for a cold start:** This doc is self-contained — a fresh session can implement it without prior chat. Read it top to bottom, then implement in the step order below.

---

## 1. Goal

Add a **global bar-weight setting** (per user, in Settings) and use it for the
barbell **plate breakdown** and **warmup ramp**. Today the bar weight is
hard-coded (20 kg / 45 lb) and the plate panel shows on **every** exercise.

From `TODO.md` #17:

- Typed weight = **TOTAL** lifted incl. the bar; min = bar weight; store the true total.
- Global bar weight in Settings (default 45 lb / 20 kg), applied to **barbell-category exercises only** (auto-detected from equipment); others type normally.
- Default a barbell exercise's **starting weight to the bar weight**, with help text.
- Show **per-side plate breakdown**: per side = (total − bar) / 2, decomposed greedily from available plates — lb: 2.5/5/10/25/35/45; kg: 1.25/2.5/5/10/15/20/25. Display e.g. "45 bar + 25 each side".
- If per-side isn't exactly achievable, show the **closest combo and flag the remainder**.

---

## 2. What already exists (don't rebuild)

- **Core math is already parameterized + unit-tested** (`packages/core/src/calc.ts`):
  - `plateBreakdown(target, barWeight = 20, plates = [...]): { perSide: number[]; leftover: number }` — greedy per-side decomposition; `leftover` is the unachievable remainder (the "closest combo + flag" case).
  - `warmupSets(workingWeight, barWeight = 20, step = 2.5): WarmupSet[]` — ramp; empty-bar set uses `barWeight`.
  - **Both already take `barWeight` as a parameter** — no signature change needed.
- **Weights already store as total kg** (canonical). The typed value is the total incl. bar, so the "store the true total" requirement is already satisfied — **no storage-model change for set weights.**
- **`PlatesPanel.tsx`** (`apps/web/src/features/active-workout/`) renders the breakdown + warmup. It currently:
  - Hard-codes `const BARS = { kg: 20, lb: 45 }`, `PLATES = {...}`, `STEP = {...}`.
  - Takes only `{ topWeight }` (canonical kg = max set weight).
  - Is rendered **unconditionally** in `ExerciseCard.tsx` (~line 368) for every exercise.
- **Profile is the cross-device settings home** (`unitPreference`, `defaultRestSec`, `defaultSets`, `defaultReps` all live there).

---

## 3. Design decisions

### 3.1 Storage: nullable `barbellWeightKg` with unit-default fallback ✅ (decided)

Store `barbellWeightKg` as a **nullable** `double precision` column on `user_profiles`.

- `null` → fall back to the unit default (20 kg / 45 lb) — exactly today's behavior.
- Only a deliberate override is persisted.

**Why nullable (not "default 20 kg"):** 20 kg ≠ 45 lb exactly. A single stored kg
default would show lb users a 44 lb bar. Nullable + fallback keeps the clean
45/20 defaults per unit and only stores an explicit change.

### 3.2 Gate the plate panel to barbell exercises ✅ (decided)

Only show `PlatesPanel` when `exercise.equipment === "barbell"`. Today it shows
"Plates & warmup" on dumbbell/machine lifts, which is meaningless. **This is a
visible behavior change** (the panel disappears from non-barbell exercises) — it
is intentional and matches the spec.

### 3.3 Default the first barbell set to the bar ✅ (decided)

When adding the **first** set of a barbell exercise with no prior history,
prefill the weight to the bar weight (instead of 0). Small help/hint so it's
clear why. See `onAddSet` in `ExerciseCard.tsx`.

### 3.4 OPEN DECISION — stepper "min = bar weight"

Clamp the `[−]` button in the weight editor (`SetValueSheet.tsx`) so a barbell
exercise can't go below the bar weight. Requires plumbing barbell-context
(`isBarbell` + `barWeightKg`) through `SetRow` → `SetValueSheet`.

- **Option A (recommended):** include it now — it's small and completes the spec.
- **Option B:** ship without it (panel + default-to-bar only), add the clamp in a follow-up.

> Confirm A or B before implementing step C3.

---

## 4. Implementation steps

### A. Storage (one additive migration)

**A1.** `packages/db/src/schema.ts` — add to `userProfile`:

```ts
barbellWeightKg: doublePrecision("barbell_weight_kg"), // nullable; null = unit default
```

**A2.** Generate + apply the migration (additive nullable column → safe):

```bash
pnpm --filter @rackd/db db:generate
# review the generated SQL, then against prod DATABASE_URL:
set -a && . ./.env && set +a
pnpm --filter @rackd/db db:deploy
```

**A3.** `packages/db/src/index.ts`:

- Add `barbellWeightKg?: number` to `ProfilePatch` (~line 613).
- In `updateProfile` (~line 638), whitelist it:
  ```ts
  if (patch.barbellWeightKg !== undefined)
    set.barbellWeightKg = patch.barbellWeightKg;
  ```
  Note: `barbellWeightKg` may be `null` to clear the override — if you want
  "clear" support, use `"barbellWeightKg" in patch` and pass `?? null` (mirror
  the `rpe` clear pattern in `updateSet`). Otherwise `undefined` = leave as-is.
- `getProfile` needs no change (nullable column; `insertRow(userProfile, { ownerId })` leaves it null).
- The `/api/profile` route passes the body straight through `updateProfile`, so no route change.

### B. Settings UI

**B1.** `apps/web/src/features/settings/SettingsForm.tsx`:

- Add `barbellWeightKg?: number | null` to the local `Profile` and `ProfilePatch` interfaces (~lines 22–47).
- Add state: `const [barWeight, setBarWeight] = useState("");`
- In the load effect (~line 199), seed it: `setBarWeight(p.barbellWeightKg != null ? String(display(p.barbellWeightKg)) : "");`
- In the unit-toggle reconvert effect (~line 244), reconvert like the other weights:
  `setBarWeight((s) => reconvertWeight(s, from, unit));`
- Add a field in the **"Workout defaults"** card (~line 529) — a 4th input or its own row:
  ```tsx
  <Field label={`Bar weight (${unit})`}>
    <Input
      value={barWeight}
      onChange={(e) => setBarWeight(maskDecimal(e.target.value))}
      placeholder={String(unit === "kg" ? 20 : 45)}
      inputMode="decimal"
      suffix={unit}
    />
  </Field>
  ```
  Help text under it: "Used for barbell plate math & warmups. Leave blank for the standard bar."
- In `save()` (~line 315), add to the patch:
  ```ts
  barbellWeightKg: num(barWeight) != null ? toKg(num(barWeight)!) : undefined,
  ```
  (Decide: blank field → leave unchanged (`undefined`) vs clear to null. Simplest
  v1: blank = leave unchanged. If you want blank to reset to default, send `null`
  and support the clear path in A3.)

### C. Wire the bar weight in

**C1.** `PlatesPanel.tsx` — accept the effective bar weight:

- New prop: `barWeightKg?: number` (canonical kg; `undefined` → unit default).
- Compute the display-unit bar once:
  ```ts
  const bar =
    barWeightKg != null
      ? display(barWeightKg, unit === "kg" ? 1 : 0)
      : BARS[unit];
  ```
- Replace every `BARS[unit]` usage (in `PlateChips` → `plateBreakdown`, and in
  `warmupSets`) with `bar`. `PlateChips` will need `bar` passed in (it currently
  reads `BARS[unit]` itself).
- Keep `PLATES`/`STEP`/`PLATE_COLOR` hard-coded (those are standard plate sets,
  not user-configurable in this PR).

**C2.** `ExerciseCard.tsx`:

- Read the profile for the bar weight:
  ```ts
  const { data: profile } = useQuery({
    queryKey: qk.profile,
    queryFn: () => api<{ barbellWeightKg?: number | null }>("/api/profile"),
  });
  ```
  (Or read it once higher up and thread down — but per-card `useQuery` on the
  same key dedupes via React Query, so it's fine.)
- **Gate** the panel to barbell:
  ```tsx
  {sessionExercise.exercise?.equipment === "barbell" && (
    <PlatesPanel topWeight={...} barWeightKg={profile?.barbellWeightKg ?? undefined} />
  )}
  ```
- **Default first set to bar** in `onAddSet` (~line 152): when the exercise is
  barbell and there's no `last`, no `suggestedWeight`, and no `fallback`, use the
  bar weight (kg) as `firstWeight` instead of 0. Add a small one-line hint near
  the empty first set (optional) explaining the prefill.

**C3.** _(OPEN DECISION 3.4)_ Stepper min-clamp:

- Thread `isBarbell` + `barWeightKg` (display units) from `ExerciseCard` → `SetRow` → `SetValueSheet`.
- In `SetValueSheet`, when editing **weight** for a barbell exercise, clamp the
  `[−]` so the value can't drop below the bar (the min). Type-entry below the bar
  should snap up to the bar (or warn).

### D. Tests

**D1.** Core (`packages/core/src/calc.test.ts`) — `plateBreakdown` / `warmupSets`
already tested at default bar; add cases for a **non-default bar** (e.g. 15 kg,
25 kg, 35 lb) and the **leftover / closest-combo** path (a target that isn't
exactly achievable per side → non-zero `leftover`).

**D2.** DB (`packages/db/test/`) — `updateProfile` persists `barbellWeightKg`
(set a value, read it back; set `null`/clear if that path is supported). Mirror
the existing profile test style. Needs Postgres (the truncate-per-test harness);
run with `pnpm test` when a DB is up.

### E. Verify

- `pnpm typecheck && pnpm --filter @rackd/core test` (the fast gate). Run the DB
  test with a Postgres up.
- One PR. **You** run the migration (`db:deploy`) against prod and device-test:
  set a bar weight in Settings → open a barbell exercise → confirm the breakdown
  uses it, the warmup empty-bar set matches, and a non-barbell exercise shows no
  panel. Confirm a fresh barbell exercise prefills the first set to the bar.

---

## 5. Files touched (summary)

| File                                                                    | Change                                      |
| ----------------------------------------------------------------------- | ------------------------------------------- |
| `packages/db/src/schema.ts`                                             | + `barbellWeightKg` column on `userProfile` |
| `packages/db/drizzle/*` (generated)                                     | migration SQL (`db:generate`)               |
| `packages/db/src/index.ts`                                              | `ProfilePatch` + `updateProfile` whitelist  |
| `apps/web/src/features/settings/SettingsForm.tsx`                       | Bar-weight field, load/reconvert/save       |
| `apps/web/src/features/active-workout/PlatesPanel.tsx`                  | accept `barWeightKg`, drop hard-coded bar   |
| `apps/web/src/features/active-workout/ExerciseCard.tsx`                 | profile read, barbell gate, default-to-bar  |
| `apps/web/src/features/active-workout/SetRow.tsx` + `SetValueSheet.tsx` | _(decision 3.4)_ min-clamp plumbing         |
| `packages/core/src/calc.test.ts`                                        | non-default-bar + leftover tests            |
| `packages/db/test/*.test.ts`                                            | `updateProfile` persists bar weight         |
| `TODO.md`                                                               | tick #17                                    |

---

## 6. Risks / gotchas

- **Units:** bar weight is canonical **kg** in the DB; display/edit in the user's
  unit (`display`/`toKg` from `useUnit`). The Settings field must reconvert on
  unit toggle (the form already does this for Current/Goal weight — copy that).
- **Display rounding:** `PlatesPanel` rounds the top weight (`display(topWeight, unit==="kg"?1:0)`).
  Keep the bar in the **same display precision** so `(total − bar)/2` is clean and
  `leftover` reflects real plate granularity, not a rounding artifact.
- **Migration is the only prod-touching step** — additive nullable column, safe + reversible.
- **Behavior change:** plate panel disappears from non-barbell exercises (intended, §3.2).
- **`equipment` values** are the canonical `Equipment` enum (`barbell` is one). Gate on `=== "barbell"`.
- **KISS:** plate _sets_ (which plates exist) stay hard-coded this PR; only the
  **bar** becomes configurable. Custom plate inventories are out of scope.

---

## 7. Related follow-up (separate, not part of this PR)

A test-audit flagged coverage gaps in the **legacy-dedup** tests (already merged):
the DB suite never exercises the **override path** (the real `LEGACY_EXERCISE_MAP`
runs entirely via overrides) nor the **`isCustom = true` exclusion** safety
invariant, and the idempotency test passes via an early return. Worth a small
test-hardening PR but unrelated to bar weight.
