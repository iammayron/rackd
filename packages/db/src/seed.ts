import type { Client } from "./index";

/**
 * Starter exercise library (Phase 1 subset — text only, media added later).
 * Real apps ship ~300; this is enough to run the loop. Stable ids so seeding
 * is idempotent and routines/sessions can reference them.
 */
export interface SeedExercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  instructions: string;
}

export const SEED_EXERCISES: SeedExercise[] = [
  { id: "ex_bench_press", name: "Barbell Bench Press", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "barbell", category: "barbell", instructions: "Lower the bar to mid-chest, drive up to lockout." },
  { id: "ex_incline_db_press", name: "Incline Dumbbell Press", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: "dumbbell", category: "dumbbell", instructions: "Press dumbbells up on a 30° incline." },
  { id: "ex_pushup", name: "Push-Up", primaryMuscle: "chest", secondaryMuscles: ["triceps", "abs"], equipment: "bodyweight", category: "bodyweight", instructions: "Lower chest to floor, push back up, body in a straight line." },
  { id: "ex_squat", name: "Barbell Back Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: "barbell", category: "barbell", instructions: "Descend to parallel, drive up through mid-foot." },
  { id: "ex_front_squat", name: "Front Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "abs"], equipment: "barbell", category: "barbell", instructions: "Bar on front delts, elbows high, squat upright." },
  { id: "ex_leg_press", name: "Leg Press", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: "machine", category: "machine", instructions: "Press the sled away, don't lock knees hard." },
  { id: "ex_deadlift", name: "Conventional Deadlift", primaryMuscle: "back", secondaryMuscles: ["hamstrings", "glutes", "traps"], equipment: "barbell", category: "barbell", instructions: "Hinge, flat back, drive the floor away." },
  { id: "ex_rdl", name: "Romanian Deadlift", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "back"], equipment: "barbell", category: "barbell", instructions: "Push hips back, slight knee bend, feel the stretch." },
  { id: "ex_pullup", name: "Pull-Up", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "bodyweight", category: "bodyweight", instructions: "Pull chin over the bar, control the descent." },
  { id: "ex_lat_pulldown", name: "Lat Pulldown", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "cable", category: "machine", instructions: "Pull the bar to upper chest, drive elbows down." },
  { id: "ex_bb_row", name: "Barbell Row", primaryMuscle: "back", secondaryMuscles: ["biceps", "traps"], equipment: "barbell", category: "barbell", instructions: "Hinge ~45°, row to lower ribs." },
  { id: "ex_seated_row", name: "Seated Cable Row", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "cable", category: "machine", instructions: "Row to the navel, squeeze shoulder blades." },
  { id: "ex_ohp", name: "Overhead Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "barbell", category: "barbell", instructions: "Press the bar overhead, ribs down, glutes tight." },
  { id: "ex_db_shoulder_press", name: "Dumbbell Shoulder Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "dumbbell", category: "dumbbell", instructions: "Press dumbbells overhead from shoulder height." },
  { id: "ex_lateral_raise", name: "Lateral Raise", primaryMuscle: "shoulders", secondaryMuscles: [], equipment: "dumbbell", category: "dumbbell", instructions: "Raise arms to shoulder height, lead with elbows." },
  { id: "ex_face_pull", name: "Face Pull", primaryMuscle: "shoulders", secondaryMuscles: ["traps"], equipment: "cable", category: "machine", instructions: "Pull rope to the face, externally rotate." },
  { id: "ex_bb_curl", name: "Barbell Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "barbell", category: "barbell", instructions: "Curl without swinging, control the negative." },
  { id: "ex_db_curl", name: "Dumbbell Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "dumbbell", category: "dumbbell", instructions: "Curl one or both, supinate at the top." },
  { id: "ex_tricep_pushdown", name: "Triceps Pushdown", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "cable", category: "machine", instructions: "Extend elbows fully, keep them pinned." },
  { id: "ex_skullcrusher", name: "Skullcrusher", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "barbell", category: "barbell", instructions: "Lower to forehead, extend without flaring." },
  { id: "ex_dips", name: "Dips", primaryMuscle: "triceps", secondaryMuscles: ["chest", "shoulders"], equipment: "bodyweight", category: "bodyweight", instructions: "Lower to ~90°, press back up." },
  { id: "ex_leg_curl", name: "Lying Leg Curl", primaryMuscle: "hamstrings", secondaryMuscles: ["calves"], equipment: "machine", category: "machine", instructions: "Curl heels to glutes, control back." },
  { id: "ex_leg_ext", name: "Leg Extension", primaryMuscle: "quads", secondaryMuscles: [], equipment: "machine", category: "machine", instructions: "Extend knees fully, pause at top." },
  { id: "ex_calf_raise", name: "Standing Calf Raise", primaryMuscle: "calves", secondaryMuscles: [], equipment: "machine", category: "machine", instructions: "Full stretch at bottom, full contraction at top." },
  { id: "ex_hip_thrust", name: "Hip Thrust", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], equipment: "barbell", category: "barbell", instructions: "Drive hips up, squeeze glutes, ribs down." },
  { id: "ex_plank", name: "Plank", primaryMuscle: "abs", secondaryMuscles: [], equipment: "bodyweight", category: "bodyweight", instructions: "Hold a straight line, brace the core." },
  { id: "ex_hanging_leg_raise", name: "Hanging Leg Raise", primaryMuscle: "abs", secondaryMuscles: ["forearms"], equipment: "bodyweight", category: "bodyweight", instructions: "Raise legs to hip height, no swinging." },
  { id: "ex_cable_crunch", name: "Cable Crunch", primaryMuscle: "abs", secondaryMuscles: [], equipment: "cable", category: "machine", instructions: "Crunch the ribs toward the pelvis." },
];

/** Insert the starter library if the exercises collection is empty (idempotent). */
export async function seedExercises(client: Client): Promise<number> {
  const existing = await client.fetch(client.query("exercises").Limit(1));
  if (existing.length > 0) return 0;

  for (const ex of SEED_EXERCISES) {
    await client.insert("exercises", {
      id: ex.id,
      name: ex.name,
      primaryMuscle: ex.primaryMuscle,
      secondaryMuscles: new Set(ex.secondaryMuscles),
      equipment: ex.equipment,
      category: ex.category,
      instructions: ex.instructions,
      mediaSource: "library",
      isCustom: false,
    });
  }
  return SEED_EXERCISES.length;
}
