#!/usr/bin/env bash
#
# Generate a VAPID keypair for Web Push and install it where each piece is read:
#   - Fly secrets (runtime):  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
#                             → consumed by the push sender (apps/push worker)
#   - GitHub secret (build):  NEXT_PUBLIC_VAPID_PUBLIC_KEY
#                             → baked into the client bundle at `next build`
#                               (build runs in GitHub Actions, so it must be a GH
#                                secret + a --build-arg in deploy.yml)
#
# The private key is set on Fly ONLY — never pushed to GitHub.
#
# Usage:
#   ./scripts/setup-vapid.sh                       # generate + set everything
#   VAPID_SUBJECT=mailto:me@x.com ./scripts/setup-vapid.sh
#   DRY_RUN=1 ./scripts/setup-vapid.sh             # print, set nothing
#
set -euo pipefail

FLY_APP="${FLY_APP:-rackd}"
REPO="${REPO:-iammayron/rackd}"
VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:hi@mayronalves.com}"
DRY_RUN="${DRY_RUN:-0}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ missing required tool: $1" >&2; exit 1; }; }
need node
need npx
[ "$DRY_RUN" = "1" ] || need fly
[ "$DRY_RUN" = "1" ] || need gh

echo "→ generating VAPID keypair…"
KEYS="$(npx --yes web-push generate-vapid-keys --json)"
PUB="$(printf '%s' "$KEYS"  | node -pe 'JSON.parse(require("fs").readFileSync(0)).publicKey')"
PRIV="$(printf '%s' "$KEYS" | node -pe 'JSON.parse(require("fs").readFileSync(0)).privateKey')"

if [ -z "$PUB" ] || [ -z "$PRIV" ]; then
  echo "✗ failed to generate keys" >&2
  exit 1
fi

echo "  public key : $PUB"
echo "  private key: (hidden — Fly only)"
echo "  subject    : $VAPID_SUBJECT"
echo "  fly app    : $FLY_APP"
echo "  gh repo    : $REPO"

if [ "$DRY_RUN" = "1" ]; then
  echo "→ DRY_RUN=1, nothing was set."
  exit 0
fi

echo "→ setting Fly runtime secrets on '$FLY_APP'…"
fly secrets set \
  VAPID_PUBLIC_KEY="$PUB" \
  VAPID_PRIVATE_KEY="$PRIV" \
  VAPID_SUBJECT="$VAPID_SUBJECT" \
  -a "$FLY_APP"

echo "→ setting GitHub build secret NEXT_PUBLIC_VAPID_PUBLIC_KEY on '$REPO'…"
gh secret set NEXT_PUBLIC_VAPID_PUBLIC_KEY --body "$PUB" -R "$REPO"

echo "✓ done."
echo "  Next: add the build arg to .github/workflows/deploy.yml so the GH secret"
echo "  reaches the build:  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=\"\${{ secrets.NEXT_PUBLIC_VAPID_PUBLIC_KEY }}\""
echo "  And ensure the apps/push worker is deployed with DATABASE_URL + the VAPID_* secrets."
