# Fly.io Setup Guide

Step-by-step commands to get MyFit infrastructure running on Fly.io.

**Prerequisites:** `flyctl` installed and logged in (`fly auth login`), Fly app already created.

---

## 1. Verify your Fly app

```bash
fly apps list
# You should see your app. Note the name — update fly.toml if it differs from "rackd".
fly status
```

If the app name differs from `rackd`, update `app = "..."` in `fly.toml`.

---

## 2. Provision Tigris (object storage)

```bash
fly storage create --name rackd-photos --region iad
```

This outputs credentials. Save them — you'll need them for secrets:
- `AWS_ACCESS_KEY_ID` → use as `S3_ACCESS_KEY`
- `AWS_SECRET_ACCESS_KEY` → use as `S3_SECRET_KEY`
- `AWS_ENDPOINT_URL_S3` → use as `S3_ENDPOINT`
- `BUCKET_NAME` → use as `S3_BUCKET`

Set the bucket to allow public reads (so `<img>` can load photos):

```bash
# Install the AWS CLI if needed, then:
aws s3api put-bucket-policy \
  --bucket <BUCKET_NAME> \
  --endpoint-url <AWS_ENDPOINT_URL_S3> \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::<BUCKET_NAME>/*"]
    }]
  }'
```

---

## 3. Create Neon Postgres (in browser)

1. Go to [neon.tech](https://neon.tech) → Sign up (GitHub login works)
2. Create a new project:
   - **Name:** `rackd`
   - **Region:** `US East (Virginia)` — match your Fly region
   - **Postgres version:** 17
3. Copy the **connection string** from the dashboard. It looks like:
   ```
   postgresql://neondb_owner:xxxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this as your `DATABASE_URL`.

---

## 4. Create Supabase Cloud project (in browser)

1. Go to [supabase.com](https://supabase.com) → Sign up → New project
2. Settings:
   - **Name:** `rackd`
   - **Region:** `US East (N. Virginia)` — match Fly/Neon
   - **Database password:** (this is Supabase's internal Postgres — we won't use it for app data)
3. From Project Settings → API, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (for server-side JWT validation)
4. Configure auth:
   - Authentication → URL Configuration → Add redirect URL: `https://rackd.fly.dev` (and your custom domain if any)
   - Enable whatever auth providers you want (email/password at minimum)

---

## 5. Set Fly secrets

`NEXT_PUBLIC_*` vars need to be build args (baked at build time), not runtime secrets. Set them via `fly deploy --build-arg`. The rest are runtime secrets:

```bash
# Runtime secrets (server-side only, never in client bundle)
fly secrets set \
  DATABASE_URL="postgresql://neondb_owner:xxxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require" \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  S3_ENDPOINT="https://fly.storage.tigris.dev" \
  S3_PUBLIC_URL="https://rackd-photos.fly.storage.tigris.dev" \
  S3_BUCKET="rackd-photos" \
  S3_REGION="auto" \
  S3_ACCESS_KEY="tid_..." \
  S3_SECRET_KEY="tsec_..."
```

---

## 6. Deploy

First deploy (with build args for client-side env vars):

```bash
fly deploy --remote-only \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

> **Note:** The Dockerfile already declares these as `ARG`. Fly's remote builder will
> pick them up. You only need to pass build args that change; once baked, they persist
> in the image until the next build.

---

## 7. Set up GitHub Actions auto-deploy

1. Generate a Fly API token:
   ```bash
   fly tokens create deploy -x 999999h
   ```

2. In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   - **Name:** `FLY_API_TOKEN`
   - **Value:** the token from step 1

3. For build args in CI, add these as GitHub Actions secrets too:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Update `.github/workflows/deploy.yml` to pass build args:
   ```yaml
   - run: |
       flyctl deploy --remote-only \
         --build-arg NEXT_PUBLIC_SUPABASE_URL="${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}" \
         --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}"
     env:
       FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
   ```

Now every push to `main` auto-deploys.

---

## 8. Custom domain (optional)

```bash
fly certs create yourdomain.com
```

Then add a CNAME record in your DNS pointing to `rackd.fly.dev`.

---

## 9. Verify

```bash
fly status          # machine running?
fly logs            # any startup errors?
curl -I https://rackd.fly.dev   # 200?
```

Open `https://rackd.fly.dev` in your browser. You should see the login screen (Supabase auth).

---

## Summary of accounts needed

| Service | Purpose | Cost |
|---------|---------|------|
| [Fly.io](https://fly.io) | Compute + Tigris storage | ~$1–3/mo |
| [Neon](https://neon.tech) | Postgres database | Free |
| [Supabase](https://supabase.com) | Auth (JWT issuance) | Free |
| **Total** | | **~$1–3/mo** |
