# Rackd — iPhone issues TODO

Braindump from on-device testing. Each item gets discussed/scoped before implementing.

## Status

- [x] 1. Prevent screen rotation — lock orientation during a workout (portrait overlay in landscape + Android lock fallback)
- [x] 2. Fix RPE (6-tier perceived-exertion sheet Very light→Max effort w/ colors, RPE inline after reps, row chip colored by tier, stores single number 1/3/5/8/9/10, clear-persistence fix)
- [x] 3. Copy values to remaining sets (on completing a set, toast offers "Copy" → copies weight & reps to later not-completed sets of the exercise)
- [x] 4. Replace exercise — slide-up sheet with "Replacing" header, library search, Similar·muscle + All exercises groups, rounded rows w/ squircle thumb + Swap
- [x] 5. Per-exercise rest timer — editable rest slide-up; rest persists back to routine on finish (next run pulls it); "Skip rest day" on Home reveals next workout to start
- [x] 6. Data getting lost when minimizing workout (persist set edits on blur + focus-guarded resync)
- [x] 7. Fix drag and drop
- [x] 8. Fix exercise details slide up — verified working on device
- [x] 9. Close timer when it ends + send a notification to iPhone (via Web Push; Live Activities not possible on PWA) — auto-close + local notification + queued web-push in `timer-store.ts`
- [x] 10. Timer backdrop — dimmed scrim in `RestTimerBar.tsx`
- [x] 11. ~~Verify Triplit sync is actually working~~ — obsolete: Triplit removed; data now syncs via Supabase Postgres + React Query (IndexedDB offline cache + mutation queue)
- [x] 12. Status bar when scrolling
- [x] 13. Home icon bar
- [x] 14. Some buttons are too close to the edge (safe-area / edge padding) — resolved: existing edge gutters (`px-4`/`px-5` pages + cards, 12–16px floating overlays) verified adequate on iPhone. Horizontal safe-area insets are moot — the app is iPhone-only and portrait-locked, so `safe-area-inset-left/right` are always 0. No code change needed.
- [x] 15. Weight & reps editing — tap cell opens slide-up sheet with [−] [typeable value] [+], select-all on focus, −/＋ steps (reps 1, weight 2.5kg/5lb), commit on Done/close
- [x] 16. Superset — routine-editor toggle creates groups; in-workout view now renders a superset as one bounded unit (accent "Superset · one set of each, then rest" header, members stacked tight). Rest fires only after the LAST member (`startsRest` gates `startTimer` in `SetRow.tsx`); non-resting members show "no rest →" instead of a rest pill. Fixed the missing bottom spacing (group wrapper owns the gap). In-workout "make superset" menu action still stubbed (created via routine editor).
- [x] 17. Bar weight + plate breakdown (barbell only) — per-exercise **bar type** (instead of a single global setting): pick the bar per routine exercise (Standard/Women's/EZ/Trap/Safety), baked weights in `@rackd/core` `BAR_WEIGHTS` (per display unit, sidesteps 20 kg≠45 lb). `barType` stored on `routineExercises` + copied to `sessionExercises` at start; plate panel + warmup ramp gated to barbell exercises and driven by the chosen bar. Migration `0005`.
  - Typed weight = TOTAL lifted incl. bar; store the true total. ✓ (already canonical kg)
  - Per-side plate breakdown: per side = (total − bar) / 2, greedy from available plates; closest combo + remainder flag. ✓ (`plateBreakdown`)
  - Deferred follow-ups: stepper min-clamp at bar weight; default first barbell set to the bar; per-library-exercise default bar type.
- [x] 18. Always scroll to current exercise — snaps back to the current exercise after a rest, on reopen, once on load, and after editing (`workout/[id]/page.tsx`, `SetRow.tsx`)
- [x] 19. Complete summary not computing properly — verified on device (renders + populates) and audited: volume/sets/duration/PRs/top-set traced through `summary/page.tsx` → `sessionVolume` + `fromKg` (canonical kg, linear unit conversion) and confirmed correct. Underlying pure fns covered in `calc.test.ts`. Accuracy confirmed.
- [x] 20. Share not working — verified working on device (native share + PNG/clipboard fallback).
- [x] 21. Progress page is wrong — verified working on device (history/progress computes correctly in `history/page.tsx`)
- [x] 22. "Done" status on the Home Screen — implemented in `page.tsx`: a `completedToday` check (today's scheduled routine has a finished session ending after midnight) flips the hero into a "Today · done / Crushed it 💪" state with a "See your summary" link, plus two actions: "Train {nextName} ›" (starts the next scheduled workout) and "Start quick workout ›". The program card also shows block progress ("Day N of {block}" + completed-workout count + bar).
