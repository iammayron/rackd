#!/usr/bin/env bash
# Status line:  <project> · ⎇ <branch> · <model>[ · ●<n> dirty][ · ✓/✗ tests]
# - dirty: shown only when the working tree has uncommitted changes (count).
# - tests: shown only when .claude/.test-status exists (content "pass"/"fail"),
#   written by the gate (e.g. /ship) or a Stop hook — the status line never runs
#   tests itself.
# Claude Code passes a JSON payload on stdin (model, workspace, …).
set -euo pipefail

input="$(cat)"
read -r dir model <<<"$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const dir=(j.workspace&&j.workspace.current_dir)||j.cwd||"";const model=(j.model&&(j.model.display_name||j.model.id))||"";process.stdout.write(dir+" "+model)}catch{process.stdout.write("")}})' 2>/dev/null || true)"

dir="${dir:-$PWD}"
parts=("$(basename "$dir")")

branch="$(git -C "$dir" branch --show-current 2>/dev/null || true)"
[ -n "$branch" ] && parts+=("⎇ $branch")

# worktree (only when in a linked worktree, not the main one)
if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  gitdir="$(git -C "$dir" rev-parse --git-dir 2>/dev/null || true)"
  commondir="$(git -C "$dir" rev-parse --git-common-dir 2>/dev/null || true)"
  if [ -n "$gitdir" ] && [ "$gitdir" != "$commondir" ]; then
    wt="$(basename "$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || echo "$dir")")"
    parts+=("⑂ $wt")
  fi
fi

[ -n "${model:-}" ] && parts+=("$model")

# dirty (only when there are changes)
if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  dirty="$(git -C "$dir" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  [ "${dirty:-0}" -gt 0 ] && parts+=("●$dirty")
fi

# test status (only when a marker exists)
marker="$dir/.claude/.test-status"
if [ -f "$marker" ]; then
  status="$(tr -d '[:space:]' < "$marker")"
  case "$status" in
    pass) parts+=("✓ tests") ;;
    fail) parts+=("✗ tests") ;;
  esac
fi

# join with " · "
out=""
for p in "${parts[@]}"; do
  [ -z "$out" ] && out="$p" || out="$out · $p"
done
printf '%s' "$out"
