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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires TLS, so default to SSL ON (relaxed cert check — Supabase's
  // chain isn't in the default CA bundle). Set DATABASE_SSL=false for the local
  // stack, which doesn't speak TLS.
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;
