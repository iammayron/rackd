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
- [ ] 8. Fix exercise details slide up
- [x] 9. Close timer when it ends + send a notification to iPhone (via Web Push; Live Activities not possible on PWA) — auto-close + local notification + queued web-push in `timer-store.ts`
- [x] 10. Timer backdrop — dimmed scrim in `RestTimerBar.tsx`
- [x] 11. ~~Verify Triplit sync is actually working~~ — obsolete: Triplit removed; data now syncs via Supabase Postgres + React Query (IndexedDB offline cache + mutation queue)
- [x] 12. Status bar when scrolling
- [x] 13. Home icon bar
- [x] 14. Some buttons are too close to the edge (safe-area / edge padding) — resolved: existing edge gutters (`px-4`/`px-5` pages + cards, 12–16px floating overlays) verified adequate on iPhone. Horizontal safe-area insets are moot — the app is iPhone-only and portrait-locked, so `safe-area-inset-left/right` are always 0. No code change needed.
- [x] 15. Weight & reps editing — tap cell opens slide-up sheet with [−] [typeable value] [+], select-all on focus, −/＋ steps (reps 1, weight 2.5kg/5lb), commit on Done/close
- [ ] 16. Superset button is missing — DB field + routine-editor toggle exist; in-workout menu action still stubbed ("coming soon")
- [ ] 17. Bar weight + plate breakdown (barbell only) — per-side plate breakdown shipped (`PlatesPanel.tsx`); still missing the global bar-weight setting in Settings (bar hard-coded 20 kg / 45 lb)
  - Typed weight = TOTAL lifted incl. bar; min = bar weight; store the true total.
  - Global bar weight in Settings (default 45 lb / 20 kg), applied to barbell-category exercises only (auto-detected from equipment); others type normally.
  - Default a barbell exercise's starting weight to the bar weight, with help text.
  - Show per-side plate breakdown: per side = (total − bar) / 2, decomposed greedily from available plates — lb: 2.5/5/10/25/35/45; kg: 1.25/2.5/5/10/15/20/25. Display e.g. "45 bar + 25 each side".
  - If per-side isn't exactly achievable, show the closest combo and flag the remainder.
- [x] 18. Always scroll to current exercise — snaps back to the current exercise after a rest, on reopen, once on load, and after editing (`workout/[id]/page.tsx`, `SetRow.tsx`)
- [x] 19. Complete summary not computing properly — verified on device: the summary renders and populates its values (`summary/page.tsx`). Open follow-up: confirm the displayed numbers are actually correct (values are present; accuracy not yet spot-checked).
- [x] 20. Share not working — verified working on device (native share + PNG/clipboard fallback).
- [ ] 21. Progress page is wrong — history/progress page implemented and computing (`history/page.tsx`); re-test on device to confirm
- [ ] 22. "Done" status on the Home Screen
