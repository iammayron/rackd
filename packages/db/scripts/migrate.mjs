// Deploy-time schema migrate. Applies committed Drizzle migrations to
// $DATABASE_URL using drizzle-orm's own migrator — NOT the `drizzle-kit
// migrate` CLI, which builds its connection from the config `url` with
// sslmode=require. Recent pg upgrades that mode to `verify-full`, and
// Supabase's cert chain isn't in Node's default CA bundle, so the handshake
// fails and the CLI swallows the error as a useless "undefined" (exit 1).
//
// This script owns the pool and mirrors db.ts's TLS posture
// (rejectUnauthorized:false), so the connection actually succeeds and any real
// migration error is printed in full.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

const db = drizzle(pool);
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

try {
  await migrate(db, { migrationsFolder });
  console.log("migrate: up to date");
} catch (err) {
  console.error("migrate: failed");
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
