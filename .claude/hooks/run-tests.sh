#!/usr/bin/env bash
# Stop hook: when work touched code, run the fast gate (typecheck + core vitest)
# before letting the turn end. Blocks (exit 2) on failure so the model fixes it.
#
# Deliberately NOT run here: `@rackd/db` repo tests need a live Postgres, so
# running them on every Stop would block whenever the DB is down. Those belong to
# verify-app / an explicit `pnpm --filter @rackd/db test`.
set -uo pipefail

input="$(cat)"

# Loop guard: if we already blocked once this turn, don't block again.
active="$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).stop_hook_active||""))}catch{process.stdout.write("")}})' 2>/dev/null || true)"
[ "$active" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Nothing to test if no TS under packages/ or apps/ changed (tracked or not).
changed="$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null \
  | grep -E '^(packages|apps)/.*\.(ts|tsx)$' || true)"
[ -z "$changed" ] && exit 0

# Gate needs node >= 22; local node may be older. Load nvm 22 if present.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 || true

out="$(pnpm typecheck && pnpm --filter @rackd/core test 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  # stderr is fed back to the model; exit 2 blocks the stop.
  printf 'Gate failed — fix before finishing (typecheck + @rackd/core test):\n\n%s\n' "$out" >&2
  exit 2
fi
exit 0
