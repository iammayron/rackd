import type { Client } from "./index";
import {
  createProgram,
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  addProgramDay,
} from "./index";

/**
 * Built-in starter programs. Reference seeded exercise ids; "cloning" copies the
 * whole tree (program → days → routines → exercises → sets) into the user's own
 * owned data, so they can edit freely afterwards.
 */
export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  reps: number;
}
export interface TemplateDay {
  name: string;
  exercises: TemplateExercise[];
}
export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  days: TemplateDay[];
}

const e = (exerciseId: string, sets: number, reps: number): TemplateExercise => ({
  exerciseId,
  sets,
  reps,
});

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: "tpl_ppl",
    name: "Push / Pull / Legs",
    description: "Classic 3-day split. Run twice a week for 6 sessions.",
    days: [
      {
        name: "Push",
        exercises: [
          e("ex_bench_press", 4, 6),
          e("ex_ohp", 3, 8),
          e("ex_incline_db_press", 3, 10),
          e("ex_lateral_raise", 3, 15),
          e("ex_tricep_pushdown", 3, 12),
        ],
      },
      {
        name: "Pull",
        exercises: [
          e("ex_deadlift", 3, 5),
          e("ex_pullup", 3, 8),
          e("ex_bb_row", 3, 10),
          e("ex_face_pull", 3, 15),
          e("ex_bb_curl", 3, 12),
        ],
      },
      {
        name: "Legs",
        exercises: [
          e("ex_squat", 4, 6),
          e("ex_rdl", 3, 8),
          e("ex_leg_press", 3, 12),
          e("ex_leg_curl", 3, 12),
          e("ex_calf_raise", 4, 15),
        ],
      },
    ],
  },
  {
    id: "tpl_fullbody",
    name: "Full Body 3×",
    description: "Three full-body sessions a week. Great for beginners.",
    days: [
      {
        name: "Full Body A",
        exercises: [e("ex_squat", 3, 5), e("ex_bench_press", 3, 5), e("ex_bb_row", 3, 8), e("ex_plank", 3, 30)],
      },
      {
        name: "Full Body B",
        exercises: [e("ex_deadlift", 3, 5), e("ex_ohp", 3, 5), e("ex_lat_pulldown", 3, 10), e("ex_hanging_leg_raise", 3, 12)],
      },
      {
        name: "Full Body C",
        exercises: [e("ex_front_squat", 3, 6), e("ex_incline_db_press", 3, 8), e("ex_seated_row", 3, 10), e("ex_calf_raise", 3, 15)],
      },
    ],
  },
];

/** Clone a template into the user's own program + routines. Returns program id. */
export async function cloneProgramTemplate(
  client: Client,
  template: ProgramTemplate,
  ownerId: string,
): Promise<string> {
  const program = await createProgram(client, { ownerId, name: template.name });

  for (let i = 0; i < template.days.length; i++) {
    const day = template.days[i]!;
    const routine = await createRoutine(client, { ownerId, name: day.name, order: i });
    for (let j = 0; j < day.exercises.length; j++) {
      const ex = day.exercises[j]!;
      const re = await addRoutineExercise(client, {
        routineId: routine.id,
        exerciseId: ex.exerciseId,
        order: j + 1,
      });
      for (let s = 0; s < ex.sets; s++) {
        await addRoutineSet(client, {
          routineExerciseId: re.id,
          order: s + 1,
          targetReps: ex.reps,
        });
      }
    }
    await addProgramDay(client, {
      programId: program.id,
      order: i + 1,
      name: day.name,
      routineId: routine.id,
    });
  }
  return program.id;
}
