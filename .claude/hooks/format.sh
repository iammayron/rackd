#!/usr/bin/env bash
# PostToolUse hook: format the file Claude just edited, using whatever formatter
# the project has. Receives the tool payload as JSON on stdin.
# Never fails the tool call (always exit 0).
set -euo pipefail

input="$(cat)"
file="$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{process.stdout.write("")}})' 2>/dev/null || true)"

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

have() { command -v "$1" >/dev/null 2>&1; }

# Repo-local formatter first: the version is pinned in package.json, so a
# differently-versioned global install can't restyle the codebase behind our
# backs. Falls back to a global/npx one only when the project has none.
repo_root="${CLAUDE_PROJECT_DIR:-.}"
local_prettier="$repo_root/node_modules/.bin/prettier"

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.html|*.md|*.mdx|*.yaml|*.yml)
    if have biome; then biome format --write "$file" >/dev/null 2>&1 || true
    elif [ -x "$local_prettier" ]; then "$local_prettier" --write "$file" >/dev/null 2>&1 || true
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
