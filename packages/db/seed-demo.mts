/**
 * Demo-data seeder. Writes a few months of fake workout history (sessions, sets,
 * PRs, bodyweight, one routine, profile) for a single user straight to the sync
 * server over HTTP, which then syncs down to that user's app.
 *
 * All demo rows use ids prefixed `demo_` so a re-run wipes only its own data —
 * never the user's real rows. Run:
 *   OWNER=<uuid> URL=http://localhost:8787 TOKEN=<service> tsx packages/db/seed-demo.mts
 */
import { HttpClient } from "@triplit/client";
import { estimate1RM } from "@rackd/core";
import { schema } from "./src/schema";
import { SEED_EXERCISES } from "./src/seed";

const OWNER = process.env.OWNER!;
const URL = process.env.URL ?? "http://localhost:8787";
const TOKEN = process.env.TOKEN!;
if (!OWNER || !TOKEN) throw new Error("set OWNER and TOKEN env");

const c = new HttpClient({ serverUrl: URL, token: TOKEN, schema });

const DAY = 86_400_000;
const now = Date.now();
const id = (...p: (string | number)[]) => `demo_${p.join("_")}`;

/** Remove this seeder's prior output (demo_-prefixed) so re-runs are clean. */
async function wipeDemo() {
  const cols = [
    "setLogs",
    "sessionExercises",
    "sessions",
    "personalRecords",
    "bodyWeightLogs",
    "routineSets",
    "routineExercises",
    "routines",
  ] as const;
  for (const col of cols) {
    const rows = await c.fetch(c.query(col).Where("ownerId", "=", OWNER));
    let n = 0;
    for (const r of rows as { id: string }[]) {
      if (r.id.startsWith("demo_")) {
        await c.delete(col, r.id);
        n++;
      }
    }
    if (n) console.log(`  wiped ${n} ${col}`);
  }
}

/** Ensure the library exercises we reference exist (user login usually seeds these). */
async function ensureExercises(ids: string[]) {
  const existing = (await c.fetch(c.query("exercises"))) as { id: string }[];
  const have = new Set(existing.map((e) => e.id));
  for (const exId of ids) {
    if (have.has(exId)) continue;
    const def = SEED_EXERCISES.find((e) => e.id === exId);
    if (!def) continue;
    await c.insert("exercises", {
      id: def.id,
      name: def.name,
      primaryMuscle: def.primaryMuscle,
      secondaryMuscles: new Set(def.secondaryMuscles),
      equipment: def.equipment,
      category: def.category,
      instructions: def.instructions,
      mediaSource: "library",
      isCustom: false,
    });
    console.log(`  inserted exercise ${def.id}`);
  }
}

// PPL-ish split. base kg, reps, weekly increment per exercise.
type Lift = { ex: string; base: number; reps: number; inc: number };
const DAYS: { name: string; lifts: Lift[] }[] = [
  {
    name: "Push",
    lifts: [
      { ex: "ex_bench_press", base: 60, reps: 8, inc: 2.5 },
      { ex: "ex_ohp", base: 35, reps: 8, inc: 1.25 },
      { ex: "ex_tricep_pushdown", base: 25, reps: 12, inc: 1.25 },
    ],
  },
  {
    name: "Pull",
    lifts: [
      { ex: "ex_deadlift", base: 100, reps: 5, inc: 5 },
      { ex: "ex_bb_row", base: 55, reps: 8, inc: 2.5 },
      { ex: "ex_lat_pulldown", base: 50, reps: 10, inc: 2.5 },
      { ex: "ex_bb_curl", base: 30, reps: 10, inc: 1.25 },
    ],
  },
  {
    name: "Legs",
    lifts: [
      { ex: "ex_squat", base: 80, reps: 6, inc: 5 },
      { ex: "ex_leg_press", base: 140, reps: 10, inc: 5 },
    ],
  },
];
const DAY_OFFSET = [0, 2, 4]; // Mon/Wed/Fri-ish within the week

const WEEKS = 8;
const PR_LIFTS = new Set(["ex_bench_press", "ex_squat", "ex_deadlift", "ex_ohp"]);

async function seedWorkouts() {
  const usedExercises = [...new Set(DAYS.flatMap((d) => d.lifts.map((l) => l.ex)))];
  await ensureExercises(usedExercises);

  // best est-1RM per PR lift, to record a single PR at the end.
  const bestPr = new Map<string, { value: number; sessionId: string; at: number }>();

  for (let w = 0; w < WEEKS; w++) {
    const weeksAgo = WEEKS - w; // oldest first
    for (let d = 0; d < DAYS.length; d++) {
      const day = DAYS[d]!;
      const startedAt = now - weeksAgo * 7 * DAY + DAY_OFFSET[d]! * DAY + 18 * 3600_000;
      const endedAt = startedAt + (45 + d * 5) * 60_000;
      const sessionId = id("s", w, d);
      await c.insert("sessions", {
        id: sessionId,
        ownerId: OWNER,
        name: day.name,
        startedAt,
        endedAt,
      });
      for (let i = 0; i < day.lifts.length; i++) {
        const lift = day.lifts[i]!;
        const seId = id("se", w, d, i);
        await c.insert("sessionExercises", {
          id: seId,
          ownerId: OWNER,
          sessionId,
          exerciseId: lift.ex,
          order: i,
          restSec: 120,
        });
        const weight = lift.base + w * lift.inc;
        for (let set = 0; set < 3; set++) {
          // small rep drop-off across sets for realism
          const reps = Math.max(1, lift.reps - set);
          await c.insert("setLogs", {
            id: id("set", w, d, i, set),
            ownerId: OWNER,
            sessionExerciseId: seId,
            order: set,
            type: "normal",
            weight,
            reps,
            completed: true,
          });
          if (PR_LIFTS.has(lift.ex)) {
            const est = estimate1RM(weight, reps);
            const prev = bestPr.get(lift.ex);
            if (!prev || est > prev.value) {
              bestPr.set(lift.ex, { value: Math.round(est), sessionId, at: startedAt });
            }
          }
        }
      }
    }
  }

  for (const [ex, pr] of bestPr) {
    await c.insert("personalRecords", {
      id: id("pr", ex),
      ownerId: OWNER,
      exerciseId: ex,
      type: "1rm",
      value: pr.value,
      sessionId: pr.sessionId,
      achievedAt: pr.at,
    });
  }
  console.log(`  seeded ${WEEKS * DAYS.length} sessions, ${bestPr.size} PRs`);
}

async function seedBodyweight() {
  const N = 12;
  for (let i = 0; i < N; i++) {
    const weeksAgo = N - i;
    await c.insert("bodyWeightLogs", {
      id: id("bw", i),
      ownerId: OWNER,
      weightKg: Number((84.5 - i * 0.42).toFixed(1)),
      loggedAt: now - weeksAgo * 7 * DAY,
    });
  }
  console.log(`  seeded ${N} bodyweight logs`);
}

async function seedRoutine() {
  const routineId = id("routine", "fb");
  await c.insert("routines", {
    id: routineId,
    ownerId: OWNER,
    name: "Full Body A",
    order: 0,
    scheduledDays: new Set([1, 3, 5]),
  });
  const plan: { ex: string; reps: number; weight: number }[] = [
    { ex: "ex_squat", reps: 6, weight: 100 },
    { ex: "ex_bench_press", reps: 8, weight: 70 },
    { ex: "ex_bb_row", reps: 8, weight: 65 },
  ];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    const reId = id("re", i);
    await c.insert("routineExercises", {
      id: reId,
      ownerId: OWNER,
      routineId,
      exerciseId: p.ex,
      order: i,
      restSec: 150,
    });
    for (let s = 0; s < 3; s++) {
      await c.insert("routineSets", {
        id: id("rs", i, s),
        ownerId: OWNER,
        routineExerciseId: reId,
        order: s,
        type: "normal",
        targetReps: p.reps,
        targetWeight: p.weight,
      });
    }
  }
  console.log("  seeded 1 routine (Full Body A)");
}

async function seedProfile() {
  const existing = await c.fetchOne(c.query("userProfile").Where("ownerId", "=", OWNER));
  const patch = {
    displayName: "Mayron",
    heightCm: 178,
    currentWeightKg: 79.5,
    goalWeightKg: 76,
    trainingGoal: "hypertrophy",
  };
  if (existing) {
    await c.update("userProfile", (existing as { id: string }).id, (p: Record<string, unknown>) => {
      Object.assign(p, patch);
    });
    console.log("  updated profile");
  } else {
    await c.insert("userProfile", { ownerId: OWNER, ...patch });
    console.log("  inserted profile");
  }
}

console.log(`Seeding demo data for owner ${OWNER}`);
await wipeDemo();
await seedWorkouts();
await seedBodyweight();
await seedRoutine();
await seedProfile();
console.log("Done.");
