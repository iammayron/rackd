---
description: Run the full local gate (typecheck, tests)
---

Run the project's pre-commit gate and report results concisely.

```bash
pnpm typecheck && pnpm test
```

Record the outcome for the status line (so it can show ✓/✗ tests):

```bash
mkdir -p .claude && printf '%s' pass > .claude/.test-status   # on success
# printf '%s' fail > .claude/.test-status                      # on failure
```

If everything passes, write `pass` and say so in one line. If anything fails, write `fail`, stop, and show the failing output — do not commit.
