# Deploying rackd (Fly.io)

The web PWA runs as a single Fly Machine (`rackd` at `rackd.fly.dev`). Data lives
in **Supabase Postgres** (accessed via Drizzle), auth is **Supabase Cloud**, and
profile photos go to **Tigris** (S3-compatible). Pushes to `main` auto-deploy via
GitHub Actions. Full first-time setup (provisioning accounts, bucket policy,
custom domains) is in `docs/specs/fly-setup-guide.md`; this is the practical
deploy reference.

## Prerequisites

- `flyctl` installed and logged in (`fly auth login`).
- The `rackd` Fly app exists (`fly apps list`). The app name lives in `fly.toml`.
- A Supabase Cloud project (auth + Postgres) and a Tigris bucket provisioned.

## 1. Secrets (runtime, server-side only)

Set once; persist across deploys. These never reach the client bundle:

```bash
fly secrets set \
  DATABASE_URL="postgresql://...@...supabase.co:5432/postgres?sslmode=require" \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  S3_ENDPOINT="https://fly.storage.tigris.dev" \
  S3_PUBLIC_URL="https://rackd-photos.fly.storage.tigris.dev" \
  S3_BUCKET="rackd-photos" \
  S3_REGION="auto" \
  S3_ACCESS_KEY="tid_..." \
  S3_SECRET_KEY="tsec_..." \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:you@example.com"
```

- `DATABASE_URL` — Supabase project's Postgres connection string (Project Settings
  → Database). Used by Drizzle in `@rackd/db` and by the push poller.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side JWT validation in `lib/api-auth.ts`.
- `S3_*` — Tigris credentials from `fly storage create` (bucket must allow public
  reads so `<img>` can load photos — see the setup guide).
- `VAPID_*` — web-push keys (generate with `npx web-push generate-vapid-keys`).

## 2. Build-time env (`NEXT_PUBLIC_*`)

These are baked into the client bundle at build time, so they're passed as
**build args**, not secrets:

```bash
fly deploy --remote-only \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
```

The Dockerfile (`apps/web/Dockerfile`) declares these as `ARG`. Once baked they
persist in the image until the next build — only pass them again when they change.

## 3. Database migrations

Schema changes are applied with Drizzle, pointed at the same `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @rackd/db db:generate  # write SQL
DATABASE_URL="postgresql://..." pnpm --filter @rackd/db db:push      # apply
```

## 4. Seed the exercise library (one-time)

The exercise library is inserted into Postgres once, not per login:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @rackd/db seed
```

## 5. Auto-deploy (GitHub Actions)

Every push to `main` deploys via `.github/workflows/deploy.yml`. Required repo
secrets (Settings → Secrets and variables → Actions):

- `FLY_API_TOKEN` — `fly tokens create deploy -x 999999h`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — passed as build args in the workflow.

## 6. Verify

```bash
fly status                       # machine running?
fly logs                         # startup errors?
curl -I https://rackd.fly.dev    # 200?
```

Open `https://rackd.fly.dev` — you should land on the Supabase login screen.

## Notes

- Machines `auto_stop`/`auto_start` (min 0 running) — the first request after idle
  has a short cold start. Fine for a personal app.
- Never commit secrets. Local dev reads them from `apps/web/.env.local`
  (see `.env.example`).
