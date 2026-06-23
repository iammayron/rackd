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
- [ ] Multi-week program structure (weeks → days → routines)
- [ ] Built-in programs (PPL, 5/3/1, nSuns)
- [ ] Scheduled / calendar workouts

### Phase 4 — Social + AI
- [ ] Profiles, follow, activity feed, share/clone routines
- [ ] AI suggestions (Claude API) grounded in history — workout gen, weak-point analysis

### Content & polish
- [ ] Exercise media — clips/thumbnails (schema fields exist; CDN + cache-on-view)
- [ ] Preline upgrades — add-exercise modal/combobox, PR toast, tooltips
- [x] kg/lb units toggle (canonical kg storage, unit-aware plate calc)
- [x] Add/remove exercises during an active workout
- [ ] Supersets UI; reorder exercises (drag) in routines + active workout

### Infra
- [ ] Deploy — build sync Docker image on the Tailscale box, set web env, ship frontend
- [ ] Formatter/linter (Biome or Prettier) — gate is currently typecheck + test only
