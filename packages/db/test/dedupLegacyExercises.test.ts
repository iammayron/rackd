import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../src/db";
import {
  exercises,
  personalRecords,
  routineExercises,
  sessionExercises,
  setLogs,
} from "../src/schema";
import { dedupLegacyExercises } from "../src/ingest/dedup-legacy-exercises";
import { makeRoutine, makeSessionWithSets, OWNER_A } from "./factories";
import "./setup";

/**
 * The fixture library (setup.ts) seeds `ex_bench`/`ex_squat`/`ex_row` as legacy
 * rows (source 'rackd'). We add one imported candidate that should absorb
 * `ex_bench`; `ex_squat`/`ex_row` have no candidate and must survive untouched.
 */
async function seedImportCandidate() {
  await db.insert(exercises).values({
    id: "bench-press",
    name: "Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: [],
    equipment: "barbell",
    category: "barbell",
    source: "free-exercise-db",
    sourceId: "Bench_Press",
    slug: "bench-press",
  });
}

describe("dedupLegacyExercises", () => {
  it("repoints references onto the import, preserves history, and deletes the legacy row", async () => {
    await seedImportCandidate();

    const routine = await makeRoutine({ exerciseIds: ["ex_bench"] });
    const session = await makeSessionWithSets({
      exerciseId: "ex_bench",
      sets: [{ weight: 100, reps: 5 }],
    });
    await db.insert(personalRecords).values({
      id: "pr1",
      ownerId: OWNER_A,
      exerciseId: "ex_bench",
      type: "1rm",
      value: 120,
      sessionId: session.sessionId,
      achievedAt: Date.now(),
    });

    await dedupLegacyExercises();

    // References now point at the import.
    const re = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.id, routine.exercises[0].id));
    expect(re[0].exerciseId).toBe("bench-press");
    const se = await db
      .select()
      .from(sessionExercises)
      .where(eq(sessionExercises.id, session.sessionExerciseId));
    expect(se[0].exerciseId).toBe("bench-press");
    const pr = await db
      .select()
      .from(personalRecords)
      .where(eq(personalRecords.id, "pr1"));
    expect(pr[0].exerciseId).toBe("bench-press");

    // Logged-set history survives (came along with its session exercise).
    const logs = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionExerciseId, session.sessionExerciseId));
    expect(logs).toHaveLength(1);
    expect(logs[0].weight).toBe(100);

    // Legacy row gone; unmatched legacy rows remain.
    const benchGone = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, "ex_bench"));
    expect(benchGone).toHaveLength(0);
    const squat = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, "ex_squat"));
    expect(squat).toHaveLength(1);
  });

  it("is idempotent — a second run changes nothing", async () => {
    await seedImportCandidate();
    await makeRoutine({ exerciseIds: ["ex_bench"] });

    await dedupLegacyExercises();
    await dedupLegacyExercises(); // must not throw or re-touch anything

    const benchGone = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, "ex_bench"));
    expect(benchGone).toHaveLength(0);
  });

  it("--dry-run writes nothing", async () => {
    await seedImportCandidate();
    const routine = await makeRoutine({ exerciseIds: ["ex_bench"] });

    await dedupLegacyExercises({ dryRun: true });

    const re = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.id, routine.exercises[0].id));
    expect(re[0].exerciseId).toBe("ex_bench");
    const bench = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, "ex_bench"));
    expect(bench).toHaveLength(1);
  });
});
