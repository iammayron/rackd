import { sql } from "drizzle-orm";
import { db, schema } from "@rackd/db";

/**
 * Reset the shared Postgres between route tests (truncate every table, re-seed a
 * tiny fixed exercise library that routine/session FKs reference). Route test
 * files call `resetDb()` in beforeEach. Mirrors packages/db/test/setup.ts.
 */
const TABLES = [
  "set_logs",
  "session_exercises",
  "sessions",
  "routine_sets",
  "routine_exercises",
  "program_days",
  "programs",
  "personal_records",
  "body_metrics",
  "body_weight_logs",
  "shared_routines",
  "user_profiles",
  "scheduled_pushes",
  "push_subscriptions",
  "routines",
  "exercises",
];

export const SEED_EX = [
  { id: "ex_bench", name: "Bench Press", primaryMuscle: "chest", equipment: "barbell", category: "barbell" },
  { id: "ex_squat", name: "Back Squat", primaryMuscle: "quads", equipment: "barbell", category: "barbell" },
] as const;

export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));
  await db.insert(schema.exercises).values(
    SEED_EX.map((e) => ({
      id: e.id,
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: [],
      equipment: e.equipment,
      category: e.category,
    })),
  );
}

/** Build a Request with a Bearer token = the calling owner id (or none → 401). */
export function authedRequest(
  url: string,
  ownerId: string | null,
  init?: RequestInit,
): Request {
  const headers = new Headers(init?.headers);
  if (ownerId) headers.set("Authorization", `Bearer ${ownerId}`);
  headers.set("Content-Type", "application/json");
  return new Request(url, { ...init, headers });
}

/** Next 15 route context with async params. */
export function ctx(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}
