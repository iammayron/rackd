import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Single Postgres pool + Drizzle instance for the whole server (DRY). API route
 * handlers import `db` and the repository functions; nothing else touches pg.
 *
 * The pool is created lazily-at-connect: constructing it never opens a socket,
 * so importing this module during `next build` (which only loads route modules,
 * never runs them) is safe even when DATABASE_URL is unset.
 */

// Supabase requires TLS, so default to SSL ON (relaxed cert check — Supabase's
// chain isn't in the default CA bundle). Set DATABASE_SSL=false for the local
// stack, which doesn't speak TLS.
const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };

// Strip any `sslmode` from the URL when our relaxed `ssl` is in force. Recent
// `pg`/`pg-connection-string` parse `sslmode=require` (and stronger) from the
// connection string and escalate it to verify-full, which OVERRIDES the `ssl`
// object above and rejects Supabase's self-signed chain
// (SELF_SIGNED_CERT_IN_CHAIN → every query 500s). Removing it lets our `ssl`
// posture govern. Mirrors scripts/migrate.mjs, which hit the same trap.
function connectionString(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !ssl) return raw;
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const pool = new Pool({ connectionString: connectionString(), ssl });

export const db = drizzle(pool, { schema });
export type DB = typeof db;
