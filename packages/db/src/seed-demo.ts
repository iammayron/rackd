import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

/**
 * Demo data seeder — populates one account with a realistic, screenshot-ready
 * home dashboard: an active Push/Pull/Legs program (today = Push Day), a few
 * finished sessions with logged sets (for streak + weekly volume), PRs on a
 * couple of them (for the "N PR" badges), and body-weight history.
 *
 * Idempotent: it wipes the target owner's app data first, then re-inserts, so
 * it's safe to run repeatedly. The library exercises it references must already
 * be seeded (`pnpm --filter @rackd/db seed`).
 *
 * Run against the LOCAL Supabase stack:
 *   pnpm --filter @rackd/db db:seed-demo
 * (auto-loads apps/web/.env.local for DATABASE_URL / DATABASE_SSL). Override the
 * account with DEMO_EMAIL=someone@example.com.
 */

// --- env: load apps/web/.env.local so a bare `pnpm db:seed-demo` just works ---
function loadLocalEnv(): void {
  if (process.env.DATABASE_URL) return;
  const here = dirname(fileURLToPath(import.meta.url)); // packages/db/src
  const envPath = join(here, "../../../apps/web/.env.local");
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      const key = m?.[1];
      const raw = m?.[2];
      if (key === undefined || raw === undefined) continue;
      const val = raw.replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // No env file (e.g. CI) — rely on the ambient environment instead.
  }
}
loadLocalEnv();

const DAY = 86_400_000;
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@rackd.test";

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number; // kg, 0 = bodyweight
  rest: number; // seconds
}
interface PlannedRoutine {
  key: string;
  name: string;
  exercises: PlannedExercise[];
}

const ROUTINES: PlannedRoutine[] = [
  {
    key: "push",
    name: "Push Day",
    exercises: [
      { exerciseId: "ex_bench_press", sets: 4, reps: 5, weight: 80, rest: 180 },
      { exerciseId: "ex_ohp", sets: 3, reps: 8, weight: 45, rest: 120 },
      { exerciseId: "ex_incline_db_press", sets: 3, reps: 10, weight: 28, rest: 90 },
      { exerciseId: "ex_lateral_raise", sets: 3, reps: 15, weight: 10, rest: 60 },
      { exerciseId: "ex_tricep_pushdown", sets: 3, reps: 12, weight: 25, rest: 60 },
    ],
  },
  {
    key: "pull",
    name: "Pull Day",
    exercises: [
      { exerciseId: "ex_deadlift", sets: 3, reps: 5, weight: 120, rest: 180 },
      { exerciseId: "ex_pullup", sets: 4, reps: 8, weight: 0, rest: 120 },
      { exerciseId: "ex_bb_row", sets: 3, reps: 10, weight: 70, rest: 90 },
      { exerciseId: "ex_bb_curl", sets: 3, reps: 12, weight: 30, rest: 60 },
      { exerciseId: "ex_face_pull", sets: 3, reps: 15, weight: 20, rest: 60 },
    ],
  },
  {
    key: "legs",
    name: "Leg Day",
    exercises: [
      { exerciseId: "ex_squat", sets: 4, reps: 5, weight: 100, rest: 180 },
      { exerciseId: "ex_rdl", sets: 3, reps: 8, weight: 90, rest: 120 },
      { exerciseId: "ex_leg_press", sets: 3, reps: 12, weight: 160, rest: 90 },
      { exerciseId: "ex_leg_curl", sets: 3, reps: 12, weight: 45, rest: 60 },
      { exerciseId: "ex_calf_raise", sets: 4, reps: 15, weight: 60, rest: 45 },
    ],
  },
];

interface PlannedPR {
  exerciseId: string;
  type: "1rm" | "weight";
  value: number;
}
interface PlannedSession {
  routineKey: string;
  daysAgo: number;
  prs: PlannedPR[];
}

// Finished workouts, newest first. None today → the hero stays on "Today's
// workout: Push Day" instead of flipping to the done state. Streak = 3
// (yesterday, -2, -3 are consecutive; -5 sits behind a gap).
const SESSIONS: PlannedSession[] = [
  {
    routineKey: "pull",
    daysAgo: 1,
    prs: [{ exerciseId: "ex_deadlift", type: "weight", value: 122.5 }],
  },
  { routineKey: "legs", daysAgo: 2, prs: [] },
  {
    routineKey: "push",
    daysAgo: 3,
    prs: [
      { exerciseId: "ex_bench_press", type: "1rm", value: 95 },
      { exerciseId: "ex_ohp", type: "weight", value: 47.5 },
    ],
  },
  { routineKey: "pull", daysAgo: 5, prs: [] },
];

export async function seedDemo(email = DEMO_EMAIL): Promise<void> {
  // Imported after env load so the pool picks up DATABASE_URL/DATABASE_SSL.
  const { db } = await import("./db");
  const s = await import("./schema");

  // Resolve the owner id (= Supabase auth user id) by email.
  const found = await db.execute<{ id: string }>(
    sql`select id::text as id from auth.users where email = ${email} limit 1`,
  );
  const ownerId = found.rows[0]?.id;
  if (!ownerId) {
    throw new Error(`No auth user for ${email}. Sign up in the app first, then re-run.`);
  }

  const now = Date.now();

  // --- wipe this owner's app data (child→parent), so re-runs are clean -------
  await db.delete(s.setLogs).where(eq(s.setLogs.ownerId, ownerId));
  await db.delete(s.sessionExercises).where(eq(s.sessionExercises.ownerId, ownerId));
  await db.delete(s.sessions).where(eq(s.sessions.ownerId, ownerId));
  await db.delete(s.personalRecords).where(eq(s.personalRecords.ownerId, ownerId));
  await db.delete(s.routineSets).where(eq(s.routineSets.ownerId, ownerId));
  await db.delete(s.routineExercises).where(eq(s.routineExercises.ownerId, ownerId));
  await db.delete(s.programDays).where(eq(s.programDays.ownerId, ownerId));
  await db.delete(s.sessions).where(eq(s.sessions.ownerId, ownerId)); // (no-op safety)
  await db.delete(s.routines).where(eq(s.routines.ownerId, ownerId));
  await db.delete(s.programs).where(eq(s.programs.ownerId, ownerId));
  await db.delete(s.bodyWeightLogs).where(eq(s.bodyWeightLogs.ownerId, ownerId));
  await db.delete(s.userProfile).where(eq(s.userProfile.ownerId, ownerId));

  // --- routines (the plan tree) ---------------------------------------------
  const routineIdByKey = new Map<string, string>();
  for (const [i, r] of ROUTINES.entries()) {
    const routineId = randomUUID();
    routineIdByKey.set(r.key, routineId);
    await db.insert(s.routines).values({
      id: routineId,
      ownerId,
      name: r.name,
      order: i,
      category: "strength",
    });
    for (const [j, ex] of r.exercises.entries()) {
      const reId = randomUUID();
      await db.insert(s.routineExercises).values({
        id: reId,
        ownerId,
        routineId,
        exerciseId: ex.exerciseId,
        order: j,
        restSec: ex.rest,
      });
      await db.insert(s.routineSets).values(
        Array.from({ length: ex.sets }, (_, k) => ({
          id: randomUUID(),
          ownerId,
          routineExerciseId: reId,
          order: k,
          type: "normal",
          targetReps: ex.reps,
          targetWeight: ex.weight,
        })),
      );
    }
  }

  // --- active Push/Pull/Legs program (rotation, today = Push) ----------------
  const programId = randomUUID();
  await db.insert(s.programs).values({
    id: programId,
    ownerId,
    name: "Push / Pull / Legs",
    order: 0,
    blockWeeks: 4,
    active: true,
    scheduleMode: "rotation",
    rotationCursor: 0, // ordered day 0 → Push Day is today's slot
    activatedAt: now - 6 * DAY,
  });
  await db.insert(s.programDays).values(
    ROUTINES.map((r, i) => ({
      id: randomUUID(),
      ownerId,
      programId,
      order: i,
      name: r.name,
      routineId: routineIdByKey.get(r.key)!,
    })),
  );

  // --- finished sessions with logged sets, PRs ------------------------------
  for (const plan of SESSIONS) {
    const routine = ROUTINES.find((r) => r.key === plan.routineKey)!;
    const endedAt = now - plan.daysAgo * DAY;
    const startedAt = endedAt - 55 * 60_000; // ~55 min workout
    const sessionId = randomUUID();
    await db.insert(s.sessions).values({
      id: sessionId,
      ownerId,
      routineId: routineIdByKey.get(routine.key)!,
      programId,
      name: routine.name,
      startedAt,
      endedAt,
    });
    for (const [j, ex] of routine.exercises.entries()) {
      const seId = randomUUID();
      await db.insert(s.sessionExercises).values({
        id: seId,
        ownerId,
        sessionId,
        exerciseId: ex.exerciseId,
        order: j,
        restSec: ex.rest,
      });
      await db.insert(s.setLogs).values(
        Array.from({ length: ex.sets }, (_, k) => ({
          id: randomUUID(),
          ownerId,
          sessionExerciseId: seId,
          order: k,
          type: "normal",
          weight: ex.weight,
          reps: ex.reps,
          completed: true,
        })),
      );
    }
    if (plan.prs.length > 0) {
      await db.insert(s.personalRecords).values(
        plan.prs.map((pr) => ({
          id: randomUUID(),
          ownerId,
          exerciseId: pr.exerciseId,
          type: pr.type,
          value: pr.value,
          sessionId,
          achievedAt: endedAt,
        })),
      );
    }
  }

  // --- profile + body-weight trend (for the Weight progress card) -----------
  await db.insert(s.userProfile).values({
    id: randomUUID(),
    ownerId,
    displayName: "Demo Lifter",
    currentWeightKg: 80.5,
    goalWeightKg: 75,
    unitPreference: "metric",
  });
  await db.insert(s.bodyWeightLogs).values(
    [
      { daysAgo: 30, weightKg: 83 },
      { daysAgo: 21, weightKg: 82.4 },
      { daysAgo: 14, weightKg: 81.6 },
      { daysAgo: 7, weightKg: 80.9 },
      { daysAgo: 1, weightKg: 80.5 },
    ].map((b) => ({
      id: randomUUID(),
      ownerId,
      weightKg: b.weightKg,
      loggedAt: now - b.daysAgo * DAY,
    })),
  );

  console.log(
    `[seed-demo] ${email} (${ownerId}): 1 program, ${ROUTINES.length} routines, ${SESSIONS.length} sessions seeded.`,
  );
}

// Allow running as a standalone script: `tsx src/seed-demo.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[seed-demo] failed", e);
      process.exit(1);
    });
}
