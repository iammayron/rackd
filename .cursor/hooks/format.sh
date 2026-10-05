#!/usr/bin/env bash
# Cursor afterFileEdit hook: format the file the agent just edited, using whatever
# formatter the project has. Receives the hook payload as JSON on stdin.
# Never blocks the edit (always exit 0).
#
# Cursor project hooks run from the repo root, so reference this script as
# ".cursor/hooks/format.sh" in .cursor/hooks.json.
set -euo pipefail

input="$(cat)"
# afterFileEdit payload carries the edited path; field name varies by version,
# so try the common ones.
file="$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.file_path||j.filePath||j.path||(j.file&&(j.file.path||j.file.file_path))||"")}catch{process.stdout.write("")}})' 2>/dev/null || true)"

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

have() { command -v "$1" >/dev/null 2>&1; }

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.html|*.md|*.mdx|*.yaml|*.yml)
    if have biome; then biome format --write "$file" >/dev/null 2>&1 || true
    elif have prettier; then prettier --write "$file" >/dev/null 2>&1 || true
    else npx --no-install prettier --write "$file" >/dev/null 2>&1 || true
    fi
    ;;
  *.py)
    if have ruff; then ruff format "$file" >/dev/null 2>&1 || true; fi
    if have black; then black -q "$file" >/dev/null 2>&1 || true; fi
    ;;
  *.go)  have gofmt && gofmt -w "$file" >/dev/null 2>&1 || true ;;
  *.rs)  have rustfmt && rustfmt "$file" >/dev/null 2>&1 || true ;;
  *.rb)  have rubocop && rubocop -A "$file" >/dev/null 2>&1 || true ;;
esac
exit 0
