-- ONE-TIME baseline for prod Supabase Postgres.
--
-- Our early schema (0000_init) and the activated_at column (0001) were applied
-- with `drizzle-kit push`, which does NOT record anything in drizzle's
-- migrations journal. Now that CI runs `drizzle-kit migrate` on deploy, the
-- empty journal would make it re-run 0000_init (CREATE TABLE) against existing
-- tables and fail. This script:
--   1. adds the activated_at column if it's still missing (idempotent), and
--   2. seeds the journal so migrate treats 0000 + 0001 as already applied.
--
-- Run ONCE in the Supabase SQL Editor against prod. Safe to re-run (idempotent).
-- After this, every deploy applies only genuinely-new migrations automatically.

-- 1. The fix that was missing in prod.
alter table programs add column if not exists activated_at bigint;

-- 2. Baseline drizzle's migrations journal.
create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);

insert into drizzle.__drizzle_migrations (hash, created_at)
select v.hash, v.created_at
from (values
  ('5addf0fc8fa9a5b6574d6138339c397c40e1326158ecc866401ff67596307877'::text, 1782354311930::bigint), -- 0000_init
  ('a6b66eac974744a5a2125099129701aad4ca4200cc8a091332a8806831d5f818',       1782426739840)          -- 0001_new_wither
) as v(hash, created_at)
where not exists (
  select 1 from drizzle.__drizzle_migrations m where m.hash = v.hash
);
