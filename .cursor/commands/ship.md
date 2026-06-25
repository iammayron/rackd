# /ship — run the local gate

Run the project's pre-commit gate and report results concisely.

```bash
pnpm typecheck && pnpm test
```

The fast gate (skips Postgres-dependent suites) is `pnpm typecheck && pnpm --filter @rackd/core test` — use it when no DB is up and you only touched pure logic / UI.

If everything passes, say so in one line. If anything fails, stop and show the failing output — do not commit.
