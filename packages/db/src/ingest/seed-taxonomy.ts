import { sql } from "drizzle-orm";
import { MUSCLE_TAXONOMY, SOURCE_MUSCLE_MAP, SOURCE_EQUIPMENT_MAP } from "@rackd/core";
import { db } from "../db";
import { muscles, muscleMap, equipmentMap } from "../schema";

/**
 * Seed the fine-grained muscle taxonomy + the source→canonical reconciliation
 * maps from the @rackd/core constants (single source of truth). Idempotent:
 * re-running updates rows in place. Run before seed-exercises.
 *
 *   pnpm --filter @rackd/db ingest:taxonomy
 */
export async function seedTaxonomy(): Promise<void> {
  const muscleRows = MUSCLE_TAXONOMY.map((m) => ({
    id: m.id,
    name: m.name,
    canonicalGroup: m.canonicalGroup,
    region: m.region ?? null,
    svgRegion: m.svgRegion ?? null,
    recoveryHours: m.recoveryHours,
  }));
  await db
    .insert(muscles)
    .values(muscleRows)
    .onConflictDoUpdate({
      target: muscles.id,
      set: {
        name: sql`excluded.name`,
        canonicalGroup: sql`excluded.canonical_group`,
        region: sql`excluded.region`,
        svgRegion: sql`excluded.svg_region`,
        recoveryHours: sql`excluded.recovery_hours`,
      },
    });

  const muscleMapRows = Object.entries(SOURCE_MUSCLE_MAP).map(([sourceValue, muscleId]) => ({
    sourceValue,
    muscleId,
  }));
  await db
    .insert(muscleMap)
    .values(muscleMapRows)
    .onConflictDoUpdate({
      target: muscleMap.sourceValue,
      set: { muscleId: sql`excluded.muscle_id` },
    });

  const equipmentMapRows = Object.entries(SOURCE_EQUIPMENT_MAP).map(([sourceValue, canonical]) => ({
    sourceValue,
    canonical,
  }));
  await db
    .insert(equipmentMap)
    .values(equipmentMapRows)
    .onConflictDoUpdate({
      target: equipmentMap.sourceValue,
      set: { canonical: sql`excluded.canonical` },
    });

  console.log(
    `[taxonomy] ${muscleRows.length} muscles, ${muscleMapRows.length} muscle maps, ${equipmentMapRows.length} equipment maps`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedTaxonomy()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[taxonomy] failed", e);
      process.exit(1);
    });
}
