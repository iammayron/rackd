# FitNow — TODO

Living backlog. Done work lives in git history; this tracks what's next.

## ✅ Shipped
- **Phase 1** — core loop (routines → run → rest timer → history), plate calc + warmup, PWA offline
- **Phase 2** — PR detection, stats charts, progressive-overload suggestions, bodyweight, cloud sync (self-hosted Triplit) + anonymous identity
- **UI** — full Preline/Tailwind migration

## 🔴 Next (priority order)

### Security & auth
- [ ] **Per-user permission rules** — Triplit schema roles scoping rows to `ownerId`; per-user tokens instead of the client service token. Shared exercise library stays world-readable; custom exercises owner-scoped. *(in progress)*
- [ ] **Real auth** — login UI; `getCurrentUserId()` returns the authenticated id; claim anon-owned data on first login; token-mint endpoint (so the JWT secret never reaches the client).

### Phase 3 — Programs
- [x] Programs = ordered named days, each mapped to a routine (PPL-style)
- [ ] Multi-week progression (weeks, percentage/RPE schemes)
- [x] Built-in program templates (PPL, Full Body) — clone into own data
- [ ] More built-ins (5/3/1, nSuns)
- [ ] Scheduled / calendar workouts

### Phase 4 — Social + AI
- [ ] Profiles, follow, activity feed, share/clone routines
- [ ] AI suggestions (Claude API) grounded in history — workout gen, weak-point analysis

### Content & polish
- [x] Exercise media system — thumbnails + detail modal (clip plays when clipUrl set)
- [ ] Source/host real exercise clips (CDN) + populate exercise URLs
- [x] Add-exercise full-screen modal
- [x] PR celebration on finish
- [ ] Preline upgrades — combobox, tooltips, toasts
- [x] kg/lb units toggle (canonical kg storage, unit-aware plate calc)
- [x] Add/remove exercises during an active workout
- [x] Reorder exercises (up/down) in routines + active workout
- [x] Supersets — link adjacent exercises + shared rest (no rest between partners)

### Infra
- [ ] Deploy — build sync Docker image on the Tailscale box, set web env, ship frontend
- [ ] Formatter/linter (Biome or Prettier) — gate is currently typecheck + test only
