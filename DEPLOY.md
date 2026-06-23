# Deploying FitNow (home box + Tailscale)

Three services run on your always-on box: **Supabase** (auth), the **sync server**
(Triplit), and the **web** PWA. Devices reach them over your **tailnet** (private,
no public internet). All free.

## Prerequisites (on the box)

- Docker + Docker Compose
- Supabase CLI (`supabase`)
- Tailscale (box joined to your tailnet). Note its tailnet host, e.g. `gymbox.tailXXXX.ts.net`.

## 1. Supabase (auth)

```bash
supabase start                                   # first run pulls images
supabase gen signing-key --algorithm RS256 \
  --output-format json > supabase/_key.json      # then wrap as a JSON array:
node -e "const k=require('./supabase/_key.json');require('fs').writeFileSync('supabase/signing_keys.json',JSON.stringify([k]))"
# config.toml already sets: signing_keys_path = "./signing_keys.json"
supabase stop && supabase start                  # apply RS256
```

> Triplit verifies **RS256/HS256** only — Supabase's default ES256 won't work,
> hence the RS256 signing key. `signing_keys.json` is gitignored (private).

Grab the values:

```bash
supabase status -o env        # API_URL, ANON_KEY
curl -s http://127.0.0.1:54321/auth/v1/.well-known/jwks.json   # RS256 public JWK (the single key object → SUPABASE_JWT_SECRET)
```

## 2. .env (repo root)

```bash
cp .env.example .env
```

Fill it (use the **tailnet host**, not localhost, so phones can reach the services):

```
JWT_SECRET=<openssl rand -hex 32>                     # sync service-token secret
SUPABASE_JWT_SECRET=<the single public JWK JSON from JWKS>
NEXT_PUBLIC_SUPABASE_URL=http://<box>.tailXXXX.ts.net:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
NEXT_PUBLIC_TRIPLIT_URL=http://<box>.tailXXXX.ts.net:8787
```

> Bind Supabase to the tailnet too (config.toml `[api] / [studio]` host, or front it).
> Add `http://<box>.tailXXXX.ts.net:3000` to Supabase `[auth] additional_redirect_urls`.

## 3. Run the app

```bash
docker compose up -d --build
```

- web → `http://<box>.tailXXXX.ts.net:3000`
- sync → `:8787`

`NEXT_PUBLIC_*` are baked at build → if they change, rebuild: `docker compose up -d --build web`.

## 4. Install on your phone

Open the web URL on your phone (on the tailnet) → browser menu → **Add to Home Screen**.
Runs full-screen, offline-capable, syncing to your box.

## Notes

- **Schema changes** → rebuild the sync image (`docker compose up -d --build sync`); it bakes the schema at startup.
- Secrets: never commit `.env` or `supabase/signing_keys.json`.
- Switching Supabase signing keys invalidates sessions — sign out/in.
