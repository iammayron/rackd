import { describe, expect, it } from "vitest";
import {
  isApplicable,
  LEGACY_EXERCISE_MAP,
  LEGACY_OVERRIDES,
  matchLegacyExercise,
  normalizeExerciseName,
  scoreMatch,
  type MatchExercise,
} from "./legacy-dedup";

// A legacy id deliberately NOT in LEGACY_EXERCISE_MAP, so these exercise the
// auto-matcher rather than short-circuiting on a real override.
const legacy = (over: Partial<MatchExercise> = {}): MatchExercise => ({
  id: "ex_unmapped_fixture",
  name: "Barbell Bench Press",
  primaryMuscle: "chest",
  source: "rackd",
  ...over,
});

const imported = (over: Partial<MatchExercise> = {}): MatchExercise => ({
  id: "barbell-bench-press",
  name: "Barbell Bench Press",
  primaryMuscle: "chest",
  source: "free-exercise-db",
  ...over,
});

describe("normalizeExerciseName", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeExerciseName("Push-Up")).toBe("push up");
    expect(normalizeExerciseName("  Barbell   Bench  Press ")).toBe("barbell bench press");
  });
});

describe("scoreMatch", () => {
  it("scores an identical name 1", () => {
    expect(scoreMatch(legacy(), imported())).toBe(1);
  });

  it("vetoes a different primary muscle to 0 even with an identical name", () => {
    expect(scoreMatch(legacy(), imported({ primaryMuscle: "back" }))).toBe(0);
  });

  it("scores a superset-name variant at least 0.85", () => {
    const s = scoreMatch(legacy(), imported({ name: "Barbell Bench Press - Medium Grip" }));
    expect(s).toBeGreaterThanOrEqual(0.85);
    expect(s).toBeLessThan(1);
  });

  it("gives a low score to a same-muscle but different movement", () => {
    expect(scoreMatch(legacy(), imported({ name: "Cable Chest Fly" }))).toBeLessThan(0.5);
  });
});

describe("matchLegacyExercise", () => {
  it("picks the exact same-muscle candidate", () => {
    const m = matchLegacyExercise(legacy(), [
      imported({ id: "cable-fly", name: "Cable Chest Fly" }),
      imported(),
    ]);
    expect(m.targetId).toBe("barbell-bench-press");
    expect(m.confidence).toBe("exact");
    expect(m.via).toBe("auto");
  });

  it("never matches itself or another rackd row", () => {
    const m = matchLegacyExercise(legacy(), [
      legacy(), // self
      legacy({ id: "ex_other", name: "Barbell Bench Press" }), // another rackd row
    ]);
    expect(m.targetId).toBeNull();
    expect(m.confidence).toBe("none");
  });

  it("returns none when nothing shares the primary muscle", () => {
    const m = matchLegacyExercise(legacy(), [
      imported({ id: "squat", name: "Barbell Squat", primaryMuscle: "quads" }),
    ]);
    expect(m.targetId).toBeNull();
    expect(m.via).toBe("none");
  });

  it("an override wins over a better auto-match", () => {
    // Use a throwaway key so we don't mutate a real LEGACY_EXERCISE_MAP entry.
    LEGACY_OVERRIDES["ex_unmapped_fixture"] = "hand-picked-id";
    try {
      const m = matchLegacyExercise(legacy(), [
        imported(), // would auto-match exactly
        imported({ id: "hand-picked-id", name: "Some Bench Variant" }),
      ]);
      expect(m.targetId).toBe("hand-picked-id");
      expect(m.via).toBe("override");
      expect(m.confidence).toBe("exact");
    } finally {
      delete LEGACY_OVERRIDES["ex_unmapped_fixture"];
    }
  });
});

describe("LEGACY_EXERCISE_MAP", () => {
  it("is the dedup override table (single source of truth)", () => {
    expect(LEGACY_OVERRIDES).toBe(LEGACY_EXERCISE_MAP);
  });

  it("maps every legacy id to an import slug, never back to another ex_*", () => {
    for (const [legacy, target] of Object.entries(LEGACY_EXERCISE_MAP)) {
      expect(legacy.startsWith("ex_")).toBe(true);
      expect(target).toMatch(/^[a-z0-9-]+$/);
      expect(target.startsWith("ex_")).toBe(false);
    }
  });

  it("uses the corrected variants, not the auto-matcher's wrong picks", () => {
    expect(LEGACY_EXERCISE_MAP.ex_pullup).toBe("pullups"); // not band-assisted
    expect(LEGACY_EXERCISE_MAP.ex_leg_ext).toBe("leg-extensions"); // not single-leg
    expect(LEGACY_EXERCISE_MAP.ex_leg_curl).toBe("lying-leg-curls"); // not seated
    expect(LEGACY_EXERCISE_MAP.ex_cable_chest_fly).toBe("cable-crossover"); // not a press
  });
});

describe("isApplicable", () => {
  it("applies exact, strong, and override matches", () => {
    expect(
      isApplicable({
        legacyId: "a",
        targetId: "x",
        confidence: "exact",
        score: 1,
        via: "auto",
      }),
    ).toBe(true);
    expect(
      isApplicable({
        legacyId: "a",
        targetId: "x",
        confidence: "strong",
        score: 0.9,
        via: "auto",
      }),
    ).toBe(true);
    expect(
      isApplicable({
        legacyId: "a",
        targetId: "x",
        confidence: "weak",
        score: 0.6,
        via: "override",
      }),
    ).toBe(true);
  });

  it("does not apply weak or none auto-matches", () => {
    expect(
      isApplicable({
        legacyId: "a",
        targetId: "x",
        confidence: "weak",
        score: 0.6,
        via: "auto",
      }),
    ).toBe(false);
    expect(
      isApplicable({
        legacyId: "a",
        targetId: null,
        confidence: "none",
        score: 0,
        via: "none",
      }),
    ).toBe(false);
  });
});
