import { describe, expect, it } from "vitest";
import {
  buildShareCardData,
  type ShareSessionTree,
  type SharePrRow,
} from "@/features/share/buildShareCardData";

const id = (kg: number) => kg; // identity display (kg) keeps the math obvious
const opts = { display: id, unit: "kg" };

const START = Date.UTC(2026, 5, 21, 10, 0, 0);
const session: ShareSessionTree = {
  id: "s1",
  name: "Pull Day",
  startedAt: START,
  endedAt: START + 52 * 60_000, // 52 minutes
  exercises: [
    {
      id: "se1",
      exerciseId: "deadlift",
      exercise: { name: "Deadlift" },
      sets: [
        { id: "a", sessionExerciseId: "se1", weight: 160, reps: 3, completed: true },
        { id: "b", sessionExerciseId: "se1", weight: 140, reps: 5, completed: true },
        { id: "c", sessionExerciseId: "se1", weight: 180, reps: 1, completed: false }, // not counted
      ],
    },
    {
      id: "se2",
      exerciseId: "row",
      exercise: { name: "Barbell Row" },
      sets: [{ id: "d", sessionExerciseId: "se2", weight: 80, reps: 10, completed: true }],
    },
  ],
};

describe("buildShareCardData", () => {
  it("sums volume over completed sets only", () => {
    const { cardData } = buildShareCardData(session, [], opts);
    // 160*3 + 140*5 + 80*10 = 480 + 700 + 800 = 1980 (the 180×1 set is incomplete)
    expect(cardData.volume).toBe((1980).toLocaleString());
    expect(cardData.sets).toBe(3);
  });

  it("headlines the heaviest completed set", () => {
    const { cardData } = buildShareCardData(session, [], opts);
    expect(cardData.topSet).toBe("Deadlift · 160kg × 3");
  });

  it("formats the duration compactly", () => {
    const { cardData } = buildShareCardData(session, [], opts);
    expect(cardData.duration).toBe("52m");
  });

  it("counts PRs and appends them to the share text", () => {
    const prs: SharePrRow[] = [
      { id: "p1", exerciseId: "deadlift", type: "1rm", value: 174, sessionId: "s1" },
    ];
    const { cardData, shareText } = buildShareCardData(session, prs, opts);
    expect(cardData.prCount).toBe(1);
    expect(shareText).toContain("1 PR");
  });

  it("returns safe defaults for a missing session", () => {
    const { cardData } = buildShareCardData(undefined, [], opts);
    expect(cardData).toMatchObject({ name: "Workout", date: "", sets: 0, prCount: 0 });
    expect(cardData.topSet).toBeUndefined();
  });
});
