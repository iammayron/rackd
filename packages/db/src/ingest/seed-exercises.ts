import { readFile } from "node:fs/promises";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  normalizeFreeExercise,
  type FreeExerciseRecord,
  type NormalizedExercise,
} from "@rackd/core";
import { db } from "../db";
import { exercises, exerciseMuscles, exerciseMedia } from "../schema";
import { sourceFile } from "./paths";

/**
 * Normalize free-exercise-db records (cached by ingest:fetch) into our canonical
 * model and upsert them. Idempotent: re-running updates rows + replaces the
 * exercise's muscle/media child rows. Library exercises from the original seed
 * (ids `ex_*`, source `rackd`) are untouched — these get slugified source ids.
 *
 *   pnpm --filter @rackd/db ingest:exercises [-- --limit=50 --dry-run]
 */

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function seedExercisesFromSource(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<void> {
  const raw = await readFile(sourceFile("free-exercise-db"), "utf8").catch(() => {
    throw new Error("Source not cached. Run `pnpm --filter @rackd/db ingest:fetch` first.");
  });
  let records = JSON.parse(raw) as FreeExerciseRecord[];
  if (opts.limit) records = records.slice(0, opts.limit);

  const normalized: NormalizedExercise[] = [];
  const unmapped = new Map<string, number>();
  for (const rec of records) {
    const { exercise, unmappedMuscles } = normalizeFreeExercise(rec);
    normalized.push(exercise);
    for (const m of unmappedMuscles) unmapped.set(m, (unmapped.get(m) ?? 0) + 1);
  }

  console.log(`[exercises] normalized ${normalized.length} records`);
  if (unmapped.size) {
    console.warn(
      "[exercises] unmapped muscles (add to SOURCE_MUSCLE_MAP):",
      [...unmapped.entries()].map(([m, n]) => `${m}×${n}`).join(", "),
    );
  }
  if (opts.dryRun) {
    console.log("[exercises] dry run — sample:", JSON.stringify(normalized[0], null, 2));
    return;
  }

  const exerciseRows = normalized.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    source: e.source,
    sourceId: e.sourceId,
    primaryMuscle: e.primaryMuscle,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment,
    category: e.category,
    instructions: e.instructions,
    force: e.force ?? null,
    level: e.level ?? null,
    mechanic: e.mechanic ?? null,
    movementPattern: e.movementPattern ?? null,
    isUnilateral: e.isUnilateral,
    bodyPart: e.bodyPart,
    thumbnailUrl: e.images[0] ?? null,
    mediaSource: "library",
    isCustom: false,
  }));

  for (const batch of chunk(exerciseRows, 250)) {
    await db
      .insert(exercises)
      .values(batch)
      .onConflictDoUpdate({
        target: exercises.id,
        set: {
          name: sql`excluded.name`,
          slug: sql`excluded.slug`,
          source: sql`excluded.source`,
          sourceId: sql`excluded.source_id`,
          primaryMuscle: sql`excluded.primary_muscle`,
          secondaryMuscles: sql`excluded.secondary_muscles`,
          equipment: sql`excluded.equipment`,
          category: sql`excluded.category`,
          instructions: sql`excluded.instructions`,
          force: sql`excluded.force`,
          level: sql`excluded.level`,
          mechanic: sql`excluded.mechanic`,
          movementPattern: sql`excluded.movement_pattern`,
          isUnilateral: sql`excluded.is_unilateral`,
          bodyPart: sql`excluded.body_part`,
          thumbnailUrl: sql`excluded.thumbnail_url`,
        },
      });
  }

  // Replace child rows for these exercises (idempotent re-seed).
  const ids = normalized.map((e) => e.id);
  for (const batch of chunk(ids, 200)) {
    await db.delete(exerciseMuscles).where(inArray(exerciseMuscles.exerciseId, batch));
  }
  const muscleRows = normalized.flatMap((e) =>
    e.muscles.map((m) => ({
      exerciseId: e.id,
      muscleId: m.muscleId,
      role: m.role,
      activation: m.activation,
    })),
  );
  for (const batch of chunk(muscleRows, 1000)) {
    if (batch.length) await db.insert(exerciseMuscles).values(batch).onConflictDoNothing();
  }

  for (const batch of chunk(ids, 200)) {
    await db
      .delete(exerciseMedia)
      .where(and(inArray(exerciseMedia.exerciseId, batch), eq(exerciseMedia.kind, "image")));
  }
  const mediaRows = normalized.flatMap((e) =>
    e.images.map((url, i) => ({
      id: `${e.id}-img-${i}`,
      exerciseId: e.id,
      kind: "image",
      url, // hotlinked source URL for now; download-media mirrors to our CDN later
      originalUrl: url,
      order: i,
    })),
  );
  for (const batch of chunk(mediaRows, 1000)) {
    if (batch.length) await db.insert(exerciseMedia).values(batch).onConflictDoNothing();
  }

  console.log(
    `[exercises] upserted ${exerciseRows.length} exercises, ${muscleRows.length} muscle links, ${mediaRows.length} media`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const limit =
    Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || undefined;
  const dryRun = process.argv.includes("--dry-run");
  seedExercisesFromSource({ limit, dryRun })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[exercises] failed", e);
      process.exit(1);
    });
}
