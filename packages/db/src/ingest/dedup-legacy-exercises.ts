import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
  isApplicable,
  matchLegacyExercise,
  type LegacyMatch,
  type MatchExercise,
} from "@rackd/core";
import { db } from "../db";
import {
  exercises,
  personalRecords,
  programTemplateExercises,
  routineExercises,
  sessionExercises,
} from "../schema";

/**
 * Dedup the original hand-written seed (ids `ex_*`, source `rackd`) against the
 * imported free-exercise-db library. For each legacy exercise we find the
 * imported row that should absorb it (same primary muscle + matching name),
 * repoint every reference (routine/session/PR/template) onto the import, then
 * delete the now-unreferenced legacy row.
 *
 * Safety:
 * - Custom user exercises (isCustom=true) are never touched — only the seed.
 * - A legacy row is deleted ONLY when it has an applicable match AND zero
 *   references remain after repointing. Anything weak/unmatched is left in
 *   place and reported for an operator to resolve via LEGACY_OVERRIDES.
 * - Everything runs in one transaction; --dry-run writes nothing.
 *
 *   pnpm --filter @rackd/db ingest:dedup-legacy [-- --dry-run]
 */

/** The four tables that hold a foreign key onto exercises.id. */
const REF_TABLES = [
  {
    name: "routine_exercises",
    table: routineExercises,
    col: routineExercises.exerciseId,
  },
  {
    name: "session_exercises",
    table: sessionExercises,
    col: sessionExercises.exerciseId,
  },
  {
    name: "personal_records",
    table: personalRecords,
    col: personalRecords.exerciseId,
  },
  {
    name: "program_template_exercises",
    table: programTemplateExercises,
    col: programTemplateExercises.exerciseId,
  },
] as const;

type RefCounts = Record<string, number>;

async function referenceCounts(
  legacyIds: string[],
): Promise<Map<string, RefCounts>> {
  const counts = new Map<string, RefCounts>();
  for (const id of legacyIds) counts.set(id, {});
  if (legacyIds.length === 0) return counts;

  for (const { name, table, col } of REF_TABLES) {
    const rows = await db
      .select({ exerciseId: col, n: sql<number>`count(*)::int` })
      .from(table)
      .where(inArray(col, legacyIds))
      .groupBy(col);
    for (const r of rows) {
      const id = r.exerciseId as string;
      if (id) counts.get(id)![name] = r.n;
    }
  }
  return counts;
}

const totalRefs = (c: RefCounts): number =>
  Object.values(c).reduce((a, b) => a + b, 0);

export async function dedupLegacyExercises(
  opts: { dryRun?: boolean } = {},
): Promise<void> {
  // Legacy seed = source 'rackd', non-custom. Custom user exercises share the
  // default source but are isCustom=true, so they're excluded here.
  const legacy = (await db
    .select({
      id: exercises.id,
      name: exercises.name,
      primaryMuscle: exercises.primaryMuscle,
      source: exercises.source,
    })
    .from(exercises)
    .where(
      and(eq(exercises.source, "rackd"), eq(exercises.isCustom, false)),
    )) as MatchExercise[];

  const candidates = (await db
    .select({
      id: exercises.id,
      name: exercises.name,
      primaryMuscle: exercises.primaryMuscle,
      source: exercises.source,
    })
    .from(exercises)
    .where(ne(exercises.source, "rackd"))) as MatchExercise[];

  console.log(
    `[dedup] ${legacy.length} legacy exercises, ${candidates.length} import candidates`,
  );
  if (legacy.length === 0) {
    console.log("[dedup] nothing to do — no legacy rows.");
    return;
  }

  const matches: LegacyMatch[] = legacy.map((l) =>
    matchLegacyExercise(l, candidates),
  );
  const refs = await referenceCounts(legacy.map((l) => l.id));
  const nameById = new Map(legacy.map((l) => [l.id, l.name]));

  // Report table — every legacy row, sorted unresolved-first.
  const ordered = [...matches].sort(
    (a, b) => Number(isApplicable(a)) - Number(isApplicable(b)),
  );
  console.log("\n[dedup] match report:");
  for (const m of ordered) {
    const tag = isApplicable(m) ? "APPLY" : "SKIP ";
    const r = totalRefs(refs.get(m.legacyId) ?? {});
    console.log(
      `  ${tag} ${m.legacyId} (${nameById.get(m.legacyId)})` +
        `  →  ${m.targetId ?? "—"}${m.targetName ? ` (${m.targetName})` : ""}` +
        `  [${m.confidence} ${m.score.toFixed(2)} via ${m.via}, ${r} refs]`,
    );
  }

  const applicable = matches.filter(isApplicable);
  const skipped = matches.length - applicable.length;
  console.log(
    `\n[dedup] ${applicable.length} applicable, ${skipped} left in place (weak/unmatched).`,
  );

  if (opts.dryRun) {
    console.log("[dedup] dry run — no changes written.");
    return;
  }
  if (applicable.length === 0) {
    console.log("[dedup] no applicable matches — nothing written.");
    return;
  }

  let repointed = 0;
  let deleted = 0;
  await db.transaction(async (tx) => {
    for (const m of applicable) {
      const target = m.targetId!;
      for (const { table, col } of REF_TABLES) {
        await tx
          .update(table)
          .set({ exerciseId: target })
          .where(eq(col, m.legacyId));
      }
      repointed++;
    }

    // Re-count after repointing; delete only fully-dereferenced legacy rows.
    const after = await referenceCounts(applicable.map((m) => m.legacyId));
    const deletable = applicable
      .map((m) => m.legacyId)
      .filter((id) => totalRefs(after.get(id) ?? {}) === 0);
    const stillReferenced = applicable.length - deletable.length;
    if (stillReferenced > 0) {
      console.warn(
        `[dedup] ${stillReferenced} legacy rows still referenced post-repoint — kept.`,
      );
    }
    if (deletable.length) {
      await tx.delete(exercises).where(inArray(exercises.id, deletable));
      deleted = deletable.length;
    }
  });

  console.log(
    `[dedup] repointed ${repointed} legacy exercises, deleted ${deleted} rows.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  dedupLegacyExercises({ dryRun })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[dedup] failed", e);
      process.exit(1);
    });
}
