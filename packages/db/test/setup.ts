import { sql } from "drizzle-orm";
import { beforeEach } from "vitest";
import { db } from "../src/db";
import { exercises } from "../src/schema";

/**
 * Truncate every table before each test (RESTART IDENTITY CASCADE), then re-seed
 * a tiny fixed exercise library — every routine/session/PR row FK-references
 * `exercises`, so the fixtures must exist for factories to build trees.
 *
 * Truncate-per-test (not transaction rollback) is deliberate: the repo functions
 * use a module-level `db`, so they can't run inside a per-test tx without a
 * production refactor — and truncate genuinely exercises ON DELETE CASCADE /
 * SET NULL, which is the whole point of the cascade tests.
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

/** Fixed exercise library available to every test (stable ids). */
export const SEED_EX = [
  { id: "ex_bench", name: "Bench Press", primaryMuscle: "chest", equipment: "barbell", category: "barbell" },
  { id: "ex_squat", name: "Back Squat", primaryMuscle: "quads", equipment: "barbell", category: "barbell" },
  { id: "ex_row", name: "Barbell Row", primaryMuscle: "back", equipment: "barbell", category: "barbell" },
] as const;

beforeEach(async () => {
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));
  await db.insert(exercises).values(
    SEED_EX.map((e) => ({
      id: e.id,
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: [],
      equipment: e.equipment,
      category: e.category,
    })),
  );
});
