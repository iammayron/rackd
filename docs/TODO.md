# FitNow — TODO

Living backlog. Done work lives in git history; this tracks what's next.

## ✅ Shipped
- **Phase 1** — core loop (routines → run → rest timer → history), plate calc + warmup, PWA offline
- **Phase 2** — PR detection, stats charts, progressive-overload suggestions, bodyweight, cloud sync (self-hosted Triplit) + anonymous identity
- **UI** — full Preline/Tailwind migration

## 🔴 Next (priority order)

### Security & auth
- [x] **Per-user permission rules** — owner-scoped permissions on all collections; library read/insert-open. Verified: user B can't see user A's data.
- [x] **Real auth** — self-hosted Supabase (RS256), login/signup/signout/account, auth-gated app, Supabase token → Triplit session.
- [ ] Social login (Google/Apple) via Supabase
- [ ] Email confirmation flow + password reset
- [x] Docker deploy flow (web + sync images, compose, DEPLOY.md) — validated locally
- [ ] Run it on the Tailscale box (your step) + bind Supabase to the tailnet

### Phase 3 — Programs
- [x] Programs = ordered named days, each mapped to a routine (PPL-style)
- [ ] Multi-week progression (weeks, percentage/RPE schemes)
- [x] Built-in program templates (PPL, Full Body) — clone into own data
- [ ] More built-ins (5/3/1, nSuns)
- [ ] Scheduled / calendar workouts

### Phase 4 — Social + AI
- [x] Share / discover / clone routines (public catalog)
- [ ] Profiles, follow, activity feed
- [ ] AI suggestions (Claude API) grounded in history — needs ANTHROPIC_API_KEY

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
