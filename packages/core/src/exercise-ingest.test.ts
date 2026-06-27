import { describe, expect, it } from "vitest";
import {
  slugify,
  mapEquipment,
  mapMuscleId,
  canonicalGroupOf,
  deriveCategory,
  deriveBodyRegion,
  deriveIsUnilateral,
  deriveMovementPattern,
  activationForRole,
  normalizeFreeExercise,
  FREE_EXERCISE_IMAGE_BASE,
} from "./exercise-ingest";
import type { FreeExerciseRecord } from "./exercise-ingest";

describe("slugify", () => {
  it("collapses non-alphanumeric runs into single hyphens", () => {
    expect(slugify("3/4 Sit-Up")).toBe("3-4-sit-up");
  });
  it("lowercases and turns underscores into hyphens", () => {
    expect(slugify("Alternate_Incline_Dumbbell_Curl")).toBe(
      "alternate-incline-dumbbell-curl",
    );
  });
  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Barbell Row!--  ")).toBe("barbell-row");
  });
  it("returns empty for an all-punctuation input", () => {
    expect(slugify("///")).toBe("");
  });
});

describe("mapEquipment", () => {
  it("maps 'body only' to bodyweight", () => {
    expect(mapEquipment("body only")).toBe("bodyweight");
  });
  it("maps the e-z curl bar to barbell", () => {
    expect(mapEquipment("e-z curl bar")).toBe("barbell");
  });
  it("singularizes kettlebells to kettlebell", () => {
    expect(mapEquipment("kettlebells")).toBe("kettlebell");
  });
  it("falls back to 'other' for an unknown source string", () => {
    expect(mapEquipment("trapeze")).toBe("other");
  });
  it("treats null as bodyweight (no equipment)", () => {
    expect(mapEquipment(null)).toBe("bodyweight");
  });
  it("treats undefined as bodyweight", () => {
    expect(mapEquipment(undefined)).toBe("bodyweight");
  });
  it("is case-insensitive and trims", () => {
    expect(mapEquipment("  Barbell  ")).toBe("barbell");
  });
});

describe("mapMuscleId", () => {
  it("maps multi-word 'lower back' to the snake_case id", () => {
    expect(mapMuscleId("lower back")).toBe("lower_back");
  });
  it("is case-insensitive", () => {
    expect(mapMuscleId("Chest")).toBe("chest");
  });
  it("returns undefined for an unknown muscle", () => {
    expect(mapMuscleId("spleen")).toBeUndefined();
  });
});

describe("canonicalGroupOf", () => {
  it("rolls lats into back", () => {
    expect(canonicalGroupOf("lats")).toBe("back");
  });
  it("rolls abdominals into abs", () => {
    expect(canonicalGroupOf("abdominals")).toBe("abs");
  });
  it("rolls abductors into glutes", () => {
    expect(canonicalGroupOf("abductors")).toBe("glutes");
  });
  it("rolls adductors into quads", () => {
    expect(canonicalGroupOf("adductors")).toBe("quads");
  });
  it("returns undefined for an unknown muscle id", () => {
    expect(canonicalGroupOf("spleen")).toBeUndefined();
  });
});

describe("deriveCategory", () => {
  it("returns cardio when the source category is cardio, regardless of equipment", () => {
    expect(deriveCategory("barbell", "cardio")).toBe("cardio");
    expect(deriveCategory("bodyweight", "cardio")).toBe("cardio");
  });
  it("maps barbell to barbell", () => {
    expect(deriveCategory("barbell")).toBe("barbell");
  });
  it("groups dumbbell and kettlebell under dumbbell", () => {
    expect(deriveCategory("dumbbell")).toBe("dumbbell");
    expect(deriveCategory("kettlebell")).toBe("dumbbell");
  });
  it("groups machine and cable under machine", () => {
    expect(deriveCategory("machine")).toBe("machine");
    expect(deriveCategory("cable")).toBe("machine");
  });
  it("falls back to bodyweight for bodyweight/band/other", () => {
    expect(deriveCategory("bodyweight")).toBe("bodyweight");
    expect(deriveCategory("band")).toBe("bodyweight");
    expect(deriveCategory("other")).toBe("bodyweight");
  });
});

describe("deriveBodyRegion", () => {
  it("maps lower-body groups to 'lower'", () => {
    expect(deriveBodyRegion("quads")).toBe("lower");
    expect(deriveBodyRegion("hamstrings")).toBe("lower");
    expect(deriveBodyRegion("glutes")).toBe("lower");
    expect(deriveBodyRegion("calves")).toBe("lower");
  });
  it("maps abs to 'core'", () => {
    expect(deriveBodyRegion("abs")).toBe("core");
  });
  it("maps fullbody to 'full'", () => {
    expect(deriveBodyRegion("fullbody")).toBe("full");
  });
  it("maps upper-body groups to 'upper'", () => {
    expect(deriveBodyRegion("chest")).toBe("upper");
    expect(deriveBodyRegion("back")).toBe("upper");
  });
});

describe("deriveIsUnilateral", () => {
  it("flags single-arm work", () => {
    expect(deriveIsUnilateral("Single-Arm Dumbbell Row")).toBe(true);
  });
  it("flags split-squat variants", () => {
    expect(deriveIsUnilateral("Bulgarian Split Squat")).toBe(true);
  });
  it("flags 'alternate'/'alternating' lifts as unilateral", () => {
    expect(deriveIsUnilateral("Alternate Incline Dumbbell Curl")).toBe(true);
    expect(deriveIsUnilateral("Alternating Dumbbell Curl")).toBe(true);
  });
  it("flags the pistol squat", () => {
    expect(deriveIsUnilateral("Pistol Squat")).toBe(true);
  });
  it("is false for a bilateral barbell lift", () => {
    expect(deriveIsUnilateral("Barbell Bench Press")).toBe(false);
  });
});

describe("deriveMovementPattern", () => {
  it("classifies a squat", () => {
    expect(deriveMovementPattern("Barbell Back Squat")).toBe("squat");
  });
  it("prefers lunge over squat for split squats", () => {
    expect(deriveMovementPattern("Bulgarian Split Squat")).toBe("lunge");
  });
  it("classifies a hinge from 'romanian'", () => {
    expect(deriveMovementPattern("Romanian Deadlift")).toBe("hinge");
  });
  it("classifies a press as push", () => {
    expect(deriveMovementPattern("Bench Press")).toBe("push");
  });
  it("classifies a row as pull", () => {
    expect(deriveMovementPattern("Barbell Row")).toBe("pull");
  });
  it("classifies a pull-up as pull", () => {
    expect(deriveMovementPattern("Pull-Up")).toBe("pull");
  });
  it("classifies a plank as core", () => {
    expect(deriveMovementPattern("Plank")).toBe("core");
  });
  it("classifies a farmer's walk as carry", () => {
    expect(deriveMovementPattern("Farmer's Walk")).toBe("carry");
  });
  it("classifies a face pull as pull (beats the press keyword)", () => {
    expect(deriveMovementPattern("Face Pull")).toBe("pull");
  });
  it("falls back to isolation when no keyword matches but mechanic is isolation", () => {
    expect(deriveMovementPattern("Wrist Roller", "isolation")).toBe("isolation");
  });
  it("returns undefined with no keyword and a compound mechanic", () => {
    expect(deriveMovementPattern("Wrist Roller", "compound")).toBeUndefined();
  });
  it("returns undefined with no keyword and no mechanic", () => {
    expect(deriveMovementPattern("Wrist Roller")).toBeUndefined();
  });
});

describe("activationForRole", () => {
  it("weights a primary muscle fully", () => {
    expect(activationForRole("primary")).toBe(1);
  });
  it("weights a secondary muscle at half", () => {
    expect(activationForRole("secondary")).toBe(0.5);
  });
  it("weights a tertiary muscle at a quarter", () => {
    expect(activationForRole("tertiary")).toBe(0.25);
  });
});

describe("normalizeFreeExercise", () => {
  const makeRec = (over: Partial<FreeExerciseRecord> = {}): FreeExerciseRecord => ({
    id: "Barbell_Row",
    name: "Barbell Row",
    force: "pull",
    level: "intermediate",
    mechanic: "compound",
    equipment: "barbell",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps"],
    instructions: ["Set up.", "Pull the bar."],
    category: "strength",
    images: ["Barbell_Row/0.jpg", "Barbell_Row/1.jpg"],
    ...over,
  });

  it("maps a normal record onto the canonical model", () => {
    const { exercise, unmappedMuscles } = normalizeFreeExercise(makeRec());
    expect(exercise.primaryMuscle).toBe("back"); // lats → back
    expect(exercise.secondaryMuscles).toContain("biceps");
    expect(exercise.secondaryMuscles).not.toContain("back");
    expect(unmappedMuscles).toEqual([]);
  });

  it("derives id and slug from slugify(rec.id), not the name", () => {
    const { exercise } = normalizeFreeExercise(makeRec());
    expect(exercise.id).toBe("barbell-row");
    expect(exercise.slug).toBe("barbell-row");
  });

  it("stamps source provenance", () => {
    const { exercise } = normalizeFreeExercise(makeRec());
    expect(exercise.source).toBe("free-exercise-db");
    expect(exercise.sourceId).toBe("Barbell_Row");
  });

  it("joins instructions with newlines", () => {
    const { exercise } = normalizeFreeExercise(makeRec());
    expect(exercise.instructions).toBe("Set up.\nPull the bar.");
  });

  it("builds the fine-grained muscles array with derived activations", () => {
    const { exercise } = normalizeFreeExercise(makeRec());
    expect(exercise.muscles).toEqual([
      { muscleId: "lats", role: "primary", activation: 1 },
      { muscleId: "biceps", role: "secondary", activation: 0.5 },
    ]);
  });

  it("resolves images to absolute CDN urls", () => {
    const { exercise } = normalizeFreeExercise(makeRec());
    expect(exercise.images).toEqual([
      `${FREE_EXERCISE_IMAGE_BASE}Barbell_Row/0.jpg`,
      `${FREE_EXERCISE_IMAGE_BASE}Barbell_Row/1.jpg`,
    ]);
  });

  it("surfaces an unmappable muscle and drops it from muscles", () => {
    const { exercise, unmappedMuscles } = normalizeFreeExercise(
      makeRec({ primaryMuscles: ["nonsense"], secondaryMuscles: ["biceps"] }),
    );
    expect(unmappedMuscles).toEqual(["nonsense"]);
    expect(exercise.muscles.map((m) => m.muscleId)).toEqual(["biceps"]);
  });

  it("falls back to a secondary's group when every primary is unmappable", () => {
    const { exercise, unmappedMuscles } = normalizeFreeExercise(
      makeRec({ primaryMuscles: ["nonsense"], secondaryMuscles: ["biceps"] }),
    );
    expect(unmappedMuscles).toEqual(["nonsense"]);
    expect(exercise.primaryMuscle).toBe("biceps");
  });

  it("falls back to fullbody when nothing maps", () => {
    const { exercise, unmappedMuscles } = normalizeFreeExercise(
      makeRec({ primaryMuscles: ["nonsense"], secondaryMuscles: ["bogus"] }),
    );
    expect(unmappedMuscles).toEqual(["nonsense", "bogus"]);
    expect(exercise.primaryMuscle).toBe("fullbody");
    expect(exercise.bodyPart).toBe("full");
  });

  it("de-dups a secondary that maps to the same coarse group as the primary", () => {
    // lats (primary) and middle back (secondary) both roll up to "back".
    const { exercise } = normalizeFreeExercise(
      makeRec({ primaryMuscles: ["lats"], secondaryMuscles: ["middle back"] }),
    );
    expect(exercise.primaryMuscle).toBe("back");
    expect(exercise.secondaryMuscles).not.toContain("back");
    expect(exercise.secondaryMuscles).toEqual([]);
  });
});
