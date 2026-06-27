import { fetchSource } from "./fetch-source";
import { seedTaxonomy } from "./seed-taxonomy";
import { seedExercisesFromSource } from "./seed-exercises";

/**
 * One-shot ingest: fetch the source dataset → seed taxonomy + maps → seed
 * exercises. Idempotent; safe to re-run. Needs DATABASE_URL.
 *
 *   pnpm --filter @rackd/db ingest:all
 */
export async function ingestAll(): Promise<void> {
  await fetchSource("free-exercise-db");
  await seedTaxonomy();
  await seedExercisesFromSource();
}

export { fetchSource, seedTaxonomy, seedExercisesFromSource };

if (import.meta.url === `file://${process.argv[1]}`) {
  ingestAll()
    .then(() => {
      console.log("[ingest] done");
      process.exit(0);
    })
    .catch((e) => {
      console.error("[ingest] failed", e);
      process.exit(1);
    });
}
