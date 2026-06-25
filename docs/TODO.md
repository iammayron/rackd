# Rackd — TODO

Living backlog. Done work lives in git history; this tracks what's next.

## ✅ Shipped

- **Phase 1** — core loop (routines → run → rest timer → history), plate calc + warmup, PWA offline
- **Phase 2** — PR detection, stats charts, progressive-overload suggestions, bodyweight, cloud sync (Supabase Postgres via API routes + React Query offline cache)
- **UI** — full Preline/Tailwind migration

## 🔴 Next (priority order)

### Security & auth

- [x] **Per-user permission rules** — owner-scoped permissions on all collections; library read/insert-open. Verified: user B can't see user A's data.
- [x] **Real auth** — Supabase Cloud issues JWTs; login/signup/signout/account, auth-gated app, token validated server-side per API route (`SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Social login (Google/Apple) via Supabase
- [ ] Email confirmation flow + password reset
- [x] Deploy — Fly.io (app `rackd` at rackd.fly.dev), auto-deploy via GitHub Actions on push to `main` (see DEPLOY.md). Replaces the old self-hosted Docker-compose + Tailscale plan.

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

- [ ] Formatter/linter (Biome or Prettier) — gate is currently typecheck + test only
