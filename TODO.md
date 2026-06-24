# Rackd — iPhone issues TODO

Braindump from on-device testing. Each item gets discussed/scoped before implementing.

## Status

- [x] 1. Prevent screen rotation — lock orientation during a workout (portrait overlay in landscape + Android lock fallback)
- [x] 2. Fix RPE (6-tier perceived-exertion sheet Very light→Max effort w/ colors, RPE inline after reps, row chip colored by tier, stores single number 1/3/5/8/9/10, clear-persistence fix)
- [ ] 3. Copy values to remaining sets
- [ ] 4. Fix replace button (replace exercise)
- [ ] 5. Add timer per exercise
- [x] 6. Data getting lost when minimizing workout (persist set edits on blur + focus-guarded resync)
- [ ] 7. Fix drag and drop
- [ ] 8. Fix exercise details slide up
- [ ] 9. Close timer when it ends + send a notification to iPhone (via Web Push; Live Activities not possible on PWA)
- [ ] 10. Timer backdrop
- [ ] 11. Verify Triplit sync is actually working
- [ ] 12. Status bar when scrolling
- [ ] 13. Home icon bar
- [ ] 14. Some buttons are too close to the edge (safe-area / edge padding)
- [x] 15. Weight & reps editing — tap cell opens slide-up sheet with [−] [typeable value] [+], select-all on focus, −/＋ steps (reps 1, weight 2.5kg/5lb), commit on Done/close
- [ ] 16. Superset button is missing
- [ ] 17. Bar weight + plate breakdown (barbell only)
  - Typed weight = TOTAL lifted incl. bar; min = bar weight; store the true total.
  - Global bar weight in Settings (default 45 lb / 20 kg), applied to barbell-category exercises only (auto-detected from equipment); others type normally.
  - Default a barbell exercise's starting weight to the bar weight, with help text.
  - Show per-side plate breakdown: per side = (total − bar) / 2, decomposed greedily from available plates — lb: 2.5/5/10/25/35/45; kg: 1.25/2.5/5/10/15/20/25. Display e.g. "45 bar + 25 each side".
  - If per-side isn't exactly achievable, show the closest combo and flag the remainder.
- [ ] 18. Always scroll to current exercise
- [ ] 19. Complete summary not computing properly
- [ ] 20. Share not working
- [ ] 21. Progress page is wrong
- [ ] 22. "Done" status on the Home Screen
