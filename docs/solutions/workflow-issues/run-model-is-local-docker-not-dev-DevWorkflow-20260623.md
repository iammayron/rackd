---
module: Development Workflow
date: 2026-06-23
problem_type: workflow_issue
component: development_workflow
symptoms:
  - "Assistant recommended `pnpm dev` for iterating, but the user runs the app only via local Docker"
  - "Port 3000 'conflict' was actually the project's own myfit-web-1 container, not a stray dev server"
  - "compose comment ('home box + Tailscale') was misread as a remote deploy box when the stack runs locally"
  - "Code changes (seed/template/CSS) didn't appear until the Docker image was rebuilt"
root_cause: inadequate_documentation
resolution_type: documentation_update
severity: low
tags: [docker, docker-compose, workflow, dev-server, pwa, run-model]
---

# Troubleshooting: This project's run model is local Docker Compose, not `pnpm dev`

## Problem

While iterating, the assistant defaulted to suggesting `pnpm dev` (and `pnpm --filter @myfit/web dev`), then assumed the Triplit sync server was on a separate remote "deploy box." In reality the user runs the **entire stack as local Docker containers** via `docker compose` on the same machine. The mismatch caused a wrong-port diagnosis and confusion about why source edits weren't showing up.

## Environment

- Module: Development Workflow / local runtime
- Affected Component: `docker-compose.yml` (`web` + `sync` services), `apps/web/Dockerfile`, `apps/sync/Dockerfile`
- Date: 2026-06-23

## Symptoms

- Suggested `pnpm dev`; user replied they "will not keep running dev, I want to run the docker and that is it."
- `lsof :3000` showed `com.docke...` — the port owner was the project's own `myfit-web-1` (earlier `fitnow-web-1`) container.
- The compose header comment "home box + Tailscale" read like a remote deploy target, but it's how the user runs it locally.
- New seed exercises / PPL template / safe-area CSS only appeared after a rebuild, because the image bakes source at build time.

## What Didn't Work

**Assumption 1: iterate with `pnpm dev`**

- **Why it was wrong:** the user runs the app exclusively through Docker. Dev-server advice added friction and a port clash with the already-running container.

**Assumption 2: the sync server is a remote deploy box**

- **Why it was wrong:** both `web` (:3000) and `sync` (:8787) run as local containers from this same repo's compose file. There is no separate box in this user's setup.

## Solution

Treat **local Docker Compose as the canonical run model** for this repo.

**Run / restart the stack:**

```bash
docker compose up -d --build      # build images from source + start web(:3000) + sync(:8787)
docker ps --filter name=myfit     # confirm myfit-web-1 / myfit-sync-1 are Up
```

**Apply code changes** (images bake source — there is no hot reload):

```bash
docker compose up -d --build web  # rebuild just web after editing apps/web or packages it imports
```

**Free a "busy" port — it's almost certainly our own container:**

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'   # identify the owner
docker rm -f myfit-web-1                       # remove our container (NOT `kill` a dev process)
```

Supabase runs separately via its own CLI containers (`supabase_*`), several of which expose `:3000` _internally_ but unpublished — not the host-port owner.

## Why This Works

1. **Root cause:** the run model (local docker-compose for web + sync) was never written where an agent would read it first, so the assistant fell back to the generic monorepo assumption (`pnpm dev`) and misread the deploy-flavored compose comments.
2. The `web`/`sync` Dockerfiles copy source and build at image-build time; `NEXT_PUBLIC_*` is also baked then (see CLAUDE.md). So a rebuild — not a reload — is what propagates changes.
3. Port "conflicts" are self-inflicted: the published `3000:3000` / `8787:8787` mappings mean the running containers own those host ports, so `docker rm -f` is the fix, not hunting a Node process.

## Prevention

- For any "run it / restart / why isn't my change showing" request in this repo, reach for `docker compose up -d --build` first; do **not** suggest `pnpm dev` unless the user explicitly opts into it.
- After editing source, rebuild the relevant service image; remember there is no hot reload in the Docker path.
- The PWA service worker caches the shell on top of this — after a rebuild, unregister the SW / re-add to home screen to see changes.
- Consider adding a one-line "How this project runs (local Docker)" note to `CLAUDE.md` so future sessions skip the wrong assumption.

## Related Issues

- See also: [content-under-status-bar-WebPWA-20260623.md](../ui-bugs/content-under-status-bar-WebPWA-20260623.md) — the safe-area fix that surfaced this (changes only appeared after a Docker rebuild + SW refresh).
