import { describe, expect, it } from "vitest";
import { bestPrsByExercise, startOfWeek } from "@/features/prs/bestPrs";

const exercises = [
  { id: "bench", name: "Bench Press", primaryMuscle: "chest" },
  { id: "squat", name: "Squat", primaryMuscle: "quads" },
];

const NOW = startOfWeek(Date.UTC(2026, 5, 25)) + 3 * 86_400_000; // mid-week anchor
const thisWeek = NOW; // already inside the current week window
const lastWeek = startOfWeek(NOW) - 86_400_000; // before week start

describe("bestPrsByExercise", () => {
  it("prefers an est-1RM record over a top-weight record for the same exercise", () => {
    const rows = bestPrsByExercise(
      [
        { exerciseId: "bench", type: "weight", value: 120, achievedAt: thisWeek },
        { exerciseId: "bench", type: "1rm", value: 100, achievedAt: thisWeek },
      ],
      exercises,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exerciseId: "bench", type: "1rm", value: 100 });
  });

  it("prefers the higher value within the same record type", () => {
    const rows = bestPrsByExercise(
      [
        { exerciseId: "squat", type: "1rm", value: 150, achievedAt: thisWeek },
        { exerciseId: "squat", type: "1rm", value: 180, achievedAt: lastWeek },
      ],
      exercises,
      NOW,
    );
    expect(rows[0]).toMatchObject({ value: 180 });
  });

  it("returns one row per exercise, newest achievement first", () => {
    const rows = bestPrsByExercise(
      [
        { exerciseId: "bench", type: "1rm", value: 100, achievedAt: lastWeek },
        { exerciseId: "squat", type: "1rm", value: 150, achievedAt: thisWeek },
      ],
      exercises,
      NOW,
    );
    expect(rows.map((r) => r.exerciseId)).toEqual(["squat", "bench"]);
  });

  it("flags records set this week as fresh, older ones as stale", () => {
    const rows = bestPrsByExercise(
      [
        { exerciseId: "bench", type: "1rm", value: 100, achievedAt: thisWeek },
        { exerciseId: "squat", type: "1rm", value: 150, achievedAt: lastWeek },
      ],
      exercises,
      NOW,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.exerciseId, r.fresh]));
    expect(byId.bench).toBe(true);
    expect(byId.squat).toBe(false);
  });

  it("skips records whose exercise is not in the library list", () => {
    const rows = bestPrsByExercise(
      [{ exerciseId: "ghost", type: "1rm", value: 100, achievedAt: thisWeek }],
      exercises,
      NOW,
    );
    expect(rows).toEqual([]);
  });
});
