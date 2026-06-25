#!/usr/bin/env bash
#
# One command to apply schema changes to a Postgres DB, runnable from anywhere
# in the repo. Fixes the three things that have bitten us:
#   1. drizzle-kit needs its config in packages/db — we cd there for you.
#   2. DATABASE_URL must be set — we load it from the repo-root .env if absent.
#   3. `pnpm run db:push` swallows the real DB error behind
#      ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL — we exec the binary directly so you
#      see the actual error (auth, host, IPv6, etc).
#
# Usage (from anywhere in the repo):
#   pnpm db:migrate            # apply schema.ts to $DATABASE_URL (drizzle-kit push)
#   pnpm db:generate          # write a SQL migration file from schema.ts
#   DATABASE_URL=… pnpm db:migrate   # override the .env URL for a one-off
#
# Note: uses `drizzle-kit push` (diff schema.ts vs live DB, apply the delta),
# not `migrate`. Our history was applied via push, so the drizzle migrations
# journal table is empty and `migrate` would re-run 0000_init against existing
# tables. Keep committing migrations with `pnpm db:generate` for the record.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load DATABASE_URL from the first env file that defines it, unless it's
# already in the environment. We check the repo-root .env and the web app's
# .env.local (the server env Next uses), since either may hold it.
for envfile in .env apps/web/.env.local; do
  [ -n "${DATABASE_URL:-}" ] && break
  [ -f "$envfile" ] || continue
  set -a
  # shellcheck disable=SC1090,SC1091
  . "./$envfile"
  set +a
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo "db.sh: DATABASE_URL is not set and not found in .env or apps/web/.env.local" >&2
  echo "       Add it to $ROOT/.env, or run: DATABASE_URL=… pnpm db:migrate" >&2
  exit 1
fi

# drizzle-kit subcommand: default to push (apply); allow generate/etc.
cmd="${1:-push}"

# Print the target host only — never the credentials.
echo "db.sh: drizzle-kit $cmd → host ${DATABASE_URL##*@}" >&2

# exec the local binary directly so the real error surfaces (no pnpm wrapper).
exec pnpm --filter @rackd/db exec drizzle-kit "$cmd"
