import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { createInMemoryPool } from "./in-memory-db";

/**
 * Single Postgres pool + Drizzle instance for the whole server (DRY). API route
 * handlers import `db` and the repository functions; nothing else touches pg.
 *
 * When DATABASE_URL is not set or placeholder, an in-memory pool instance is used
 * as fallback, allowing local preview and offline development to run smoothly.
 */

const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };

function connectionString(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  if (raw.includes("xxxx") || raw.includes("example.com") || raw.includes("placeholder")) {
    return undefined;
  }
  if (!ssl) return raw;
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

export type DB = ReturnType<typeof drizzlePg<typeof schema>>;

let activeDb: DB | null = null;

export function getDb(): DB {
  if (activeDb) return activeDb;

  const conn = connectionString();
  if (conn) {
    const pool = new Pool({ connectionString: conn, ssl });
    activeDb = drizzlePg(pool, { schema });
    return activeDb;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inMemoryPool = createInMemoryPool();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeDb = drizzlePg(inMemoryPool as any, { schema });
  return activeDb;
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const target = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (target as any)[prop];
    return typeof val === "function" ? val.bind(target) : val;
  },
});
