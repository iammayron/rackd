import { db } from "./db";
import { exercises } from "./schema";
import { SEED_EXERCISES } from "./seed";

/**
 * Insert any missing library exercises (idempotent per id). Existing rows are
 * left untouched — `onConflictDoNothing` skips ids already present — so adding to
 * SEED_EXERCISES seeds only the new ones. Returns the count inserted.
 *
 * Unlike the old per-login Triplit seed, this is a one-time SERVER migration:
 *   DATABASE_URL=… pnpm --filter @rackd/db seed
 */
export async function seedExercises(): Promise<number> {
  const rows = SEED_EXERCISES.map((ex) => ({
    id: ex.id,
    name: ex.name,
    primaryMuscle: ex.primaryMuscle,
    secondaryMuscles: ex.secondaryMuscles,
    equipment: ex.equipment,
    category: ex.category,
    instructions: ex.instructions,
    mediaSource: "library",
    isCustom: false,
  }));
  const inserted = await db
    .insert(exercises)
    .values(rows)
    .onConflictDoNothing({ target: exercises.id })
    .returning({ id: exercises.id });
  return inserted.length;
}

// Allow running as a standalone script: `tsx src/seed-pg.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedExercises()
    .then((n) => {
      console.log(`[seed] inserted ${n} exercise(s)`);
      process.exit(0);
    })
    .catch((e) => {
      console.error("[seed] failed", e);
      process.exit(1);
    });
}
