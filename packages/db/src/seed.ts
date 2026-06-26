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
  /** Short coaching cues shown as a checklist on the exercise detail. */
  formCues?: string[];
}

export const SEED_EXERCISES: SeedExercise[] = [
  { id: "ex_bench_press", name: "Barbell Bench Press", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "barbell", category: "barbell", instructions: "Lower the bar to mid-chest, drive up to lockout.", formCues: ["Shoulder blades pinned back and down", "Bar touches mid-chest, no bounce", "Drive feet into the floor"] },
  { id: "ex_incline_db_press", name: "Incline Dumbbell Press", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: "dumbbell", category: "dumbbell", instructions: "Press dumbbells up on a 30° incline." },
  { id: "ex_pushup", name: "Push-Up", primaryMuscle: "chest", secondaryMuscles: ["triceps", "abs"], equipment: "bodyweight", category: "bodyweight", instructions: "Lower chest to floor, push back up, body in a straight line." },
  { id: "ex_squat", name: "Barbell Back Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: "barbell", category: "barbell", instructions: "Descend to parallel, drive up through mid-foot.", formCues: ["Brace your core before unracking", "Knees track over the toes", "Hit depth, drive through mid-foot"] },
  { id: "ex_front_squat", name: "Front Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "abs"], equipment: "barbell", category: "barbell", instructions: "Bar on front delts, elbows high, squat upright." },
  { id: "ex_leg_press", name: "Leg Press", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: "machine", category: "machine", instructions: "Press the sled away, don't lock knees hard." },
  { id: "ex_deadlift", name: "Conventional Deadlift", primaryMuscle: "back", secondaryMuscles: ["hamstrings", "glutes", "traps"], equipment: "barbell", category: "barbell", instructions: "Hinge, flat back, drive the floor away.", formCues: ["Flat back — no rounding", "Bar stays close to the shins", "Lock out with glutes, not the lower back"] },
  { id: "ex_rdl", name: "Romanian Deadlift", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "back"], equipment: "barbell", category: "barbell", instructions: "Push hips back, slight knee bend, feel the stretch.", formCues: ["Push the hips back, not down", "Soft knees, shins vertical", "Stop at a deep hamstring stretch"] },
  { id: "ex_pullup", name: "Pull-Up", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "bodyweight", category: "bodyweight", instructions: "Pull chin over the bar, control the descent." },
  { id: "ex_lat_pulldown", name: "Lat Pulldown", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "cable", category: "machine", instructions: "Pull the bar to upper chest, drive elbows down.", formCues: ["Drive the elbows down, not back", "Pull to the upper chest", "Control the bar back up"] },
  { id: "ex_bb_row", name: "Barbell Row", primaryMuscle: "back", secondaryMuscles: ["biceps", "traps"], equipment: "barbell", category: "barbell", instructions: "Hinge ~45°, row to lower ribs.", formCues: ["Hinge to ~45°, flat back", "Row to the lower ribs", "Squeeze the shoulder blades"] },
  { id: "ex_seated_row", name: "Seated Cable Row", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "cable", category: "machine", instructions: "Row to the navel, squeeze shoulder blades." },
  { id: "ex_ohp", name: "Overhead Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "barbell", category: "barbell", instructions: "Press the bar overhead, ribs down, glutes tight.", formCues: ["Squeeze glutes — no leaning back", "Shrug at the top", "Full lockout overhead"] },
  { id: "ex_db_shoulder_press", name: "Dumbbell Shoulder Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "dumbbell", category: "dumbbell", instructions: "Press dumbbells overhead from shoulder height." },
  { id: "ex_lateral_raise", name: "Lateral Raise", primaryMuscle: "shoulders", secondaryMuscles: [], equipment: "dumbbell", category: "dumbbell", instructions: "Raise arms to shoulder height, lead with elbows.", formCues: ["Lead with the elbows", "Stop at shoulder height", "No swinging — slow and controlled"] },
  { id: "ex_face_pull", name: "Face Pull", primaryMuscle: "shoulders", secondaryMuscles: ["traps"], equipment: "cable", category: "machine", instructions: "Pull rope to the face, externally rotate." },
  { id: "ex_bb_curl", name: "Barbell Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "barbell", category: "barbell", instructions: "Curl without swinging, control the negative." },
  { id: "ex_db_curl", name: "Dumbbell Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "dumbbell", category: "dumbbell", instructions: "Curl one or both, supinate at the top." },
  { id: "ex_tricep_pushdown", name: "Triceps Pushdown", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "cable", category: "machine", instructions: "Extend elbows fully, keep them pinned." },
  { id: "ex_skullcrusher", name: "Skullcrusher", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "barbell", category: "barbell", instructions: "Lower to forehead, extend without flaring." },
  { id: "ex_dips", name: "Dips", primaryMuscle: "triceps", secondaryMuscles: ["chest", "shoulders"], equipment: "bodyweight", category: "bodyweight", instructions: "Lower to ~90°, press back up." },
  { id: "ex_leg_curl", name: "Lying Leg Curl", primaryMuscle: "hamstrings", secondaryMuscles: ["calves"], equipment: "machine", category: "machine", instructions: "Curl heels to glutes, control back." },
  { id: "ex_leg_ext", name: "Leg Extension", primaryMuscle: "quads", secondaryMuscles: [], equipment: "machine", category: "machine", instructions: "Extend knees fully, pause at top." },
  { id: "ex_calf_raise", name: "Standing Calf Raise", primaryMuscle: "calves", secondaryMuscles: [], equipment: "machine", category: "machine", instructions: "Full stretch at bottom, full contraction at top." },
  { id: "ex_hip_thrust", name: "Hip Thrust", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], equipment: "barbell", category: "barbell", instructions: "Drive hips up, squeeze glutes, ribs down.", formCues: ["Tuck the chin, ribs down", "Drive through the heels", "Squeeze glutes hard at the top"] },
  { id: "ex_plank", name: "Plank", primaryMuscle: "abs", secondaryMuscles: [], equipment: "bodyweight", category: "bodyweight", instructions: "Hold a straight line, brace the core." },
  { id: "ex_hanging_leg_raise", name: "Hanging Leg Raise", primaryMuscle: "abs", secondaryMuscles: ["forearms"], equipment: "bodyweight", category: "bodyweight", instructions: "Raise legs to hip height, no swinging." },
  { id: "ex_cable_crunch", name: "Cable Crunch", primaryMuscle: "abs", secondaryMuscles: [], equipment: "cable", category: "machine", instructions: "Crunch the ribs toward the pelvis." },

  // PPL program additions (chest / shoulders / arms)
  { id: "ex_db_bench_press", name: "Dumbbell Bench Press", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "dumbbell", category: "dumbbell", instructions: "Press dumbbells from chest to lockout — wider ROM than the barbell." },
  { id: "ex_cable_chest_fly", name: "Cable Chest Fly", primaryMuscle: "chest", secondaryMuscles: ["shoulders"], equipment: "cable", category: "machine", instructions: "Bring the handles together in front, squeeze the chest, keep constant tension." },
  { id: "ex_cable_lateral_raise", name: "Cable Lateral Raise", primaryMuscle: "shoulders", secondaryMuscles: [], equipment: "cable", category: "machine", instructions: "Raise the handle to shoulder height, lead with the elbow, no swinging." },
  { id: "ex_reverse_pec_deck", name: "Reverse Pec Deck", primaryMuscle: "shoulders", secondaryMuscles: ["traps"], equipment: "machine", category: "machine", instructions: "Lead with the elbows going wide, squeeze the rear delts." },
  { id: "ex_bb_overhead_tricep_ext", name: "Barbell Overhead Triceps Extension", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "barbell", category: "barbell", instructions: "Press the bar overhead, lower behind the head, elbows forward — long head focus." },
  { id: "ex_overhead_cable_tricep_ext", name: "Overhead Cable Triceps Extension", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "cable", category: "machine", instructions: "Face away from the machine, hinge slightly, extend the rope overhead." },
  { id: "ex_db_skullcrusher", name: "Dumbbell Skullcrusher", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "dumbbell", category: "dumbbell", instructions: "Lying on a bench, lower the dumbbells toward the temples, extend to full lockout." },
  { id: "ex_hammer_curl", name: "Hammer Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "dumbbell", category: "dumbbell", instructions: "Neutral grip, elbows fixed — hits the brachialis and brachioradialis." },
  { id: "ex_incline_db_curl", name: "Incline Dumbbell Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "dumbbell", category: "dumbbell", instructions: "Arms hanging back on an incline bench for a big long-head stretch; slow eccentric." },
  { id: "ex_cable_curl", name: "Cable Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "cable", category: "machine", instructions: "Curl the low pulley, hold and squeeze at the top for peak contraction." },

  // PPL program additions (back / legs)
  { id: "ex_single_arm_db_row", name: "Single-Arm Dumbbell Row", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "dumbbell", category: "dumbbell", instructions: "Brace on a bench, pull the elbow back and up, big range of motion." },
  { id: "ex_straight_arm_pulldown", name: "Cable Straight-Arm Pulldown", primaryMuscle: "back", secondaryMuscles: [], equipment: "cable", category: "machine", instructions: "Arms near-straight, hinge at the hips, pull the bar to the thighs — lat isolation." },
  { id: "ex_hack_squat", name: "Hack Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "machine", category: "machine", instructions: "Squat in the hack machine, full depth, drive through mid-foot." },
  { id: "ex_bulgarian_split_squat", name: "Bulgarian Split Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: "dumbbell", category: "dumbbell", instructions: "Rear foot elevated, descend on the front leg, stay upright." },
  { id: "ex_sumo_deadlift", name: "Sumo Deadlift", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings", "back", "quads"], equipment: "barbell", category: "barbell", instructions: "Wide stance, toes out, flat back, drive the floor away — more glute/inner-thigh than conventional." },
  { id: "ex_seated_calf_raise", name: "Seated Calf Raise", primaryMuscle: "calves", secondaryMuscles: [], equipment: "machine", category: "machine", instructions: "Seated, full stretch and contraction — targets the soleus." },
];
