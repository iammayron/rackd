"use client";

import {
  addRoutineSet,
  updateRoutineSet,
  deleteRoutineSet,
  removeRoutineExercise,
} from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useQuery } from "@/lib/use-query";

interface RoutineExerciseRow {
  id: string;
  order: number;
  exercise?: { name: string } | null;
}

interface RoutineSetRow {
  id: string;
  order: number;
  targetWeight?: number;
  targetReps?: number;
}

const CELL =
  "w-[72px] text-center bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md text-base p-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

export function RoutineExerciseEditor({
  routineExercise,
}: {
  routineExercise: RoutineExerciseRow;
}) {
  const { results: sets } = useQuery<RoutineSetRow>(
    (c) =>
      c.query("routineSets").Where("routineExerciseId", "=", routineExercise.id).Order("order", "ASC"),
    [routineExercise.id],
  );

  async function onAddSet() {
    const last = sets[sets.length - 1];
    await addRoutineSet(getClient(), {
      routineExerciseId: routineExercise.id,
      order: sets.length + 1,
      targetWeight: last?.targetWeight,
      targetReps: last?.targetReps ?? 8,
    });
  }

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4">
      <div className="flex items-center mb-2">
        <h2 className="text-lg font-bold">
          {routineExercise.exercise?.name ?? "Exercise"}
        </h2>
        <button
          type="button"
          onClick={() => removeRoutineExercise(getClient(), routineExercise.id)}
          aria-label="Remove exercise"
          className="ms-auto bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ×
        </button>
      </div>

      <div className="flex gap-3 text-sm text-[var(--text-muted)]">
        <span className="w-6">set</span>
        <span className="w-[72px] text-center">kg</span>
        <span className="w-[72px] text-center">reps</span>
      </div>

      {sets.map((s) => (
        <div key={s.id} className="flex items-center gap-3 py-2">
          <span className="w-6 font-semibold text-[var(--text-muted)]">{s.order}</span>
          <input
            className={CELL}
            inputMode="decimal"
            placeholder="kg"
            defaultValue={s.targetWeight ?? ""}
            onBlur={(e) =>
              updateRoutineSet(getClient(), s.id, { targetWeight: Number(e.target.value) || 0 })
            }
            aria-label={`Set ${s.order} target weight`}
          />
          <input
            className={CELL}
            inputMode="numeric"
            placeholder="reps"
            defaultValue={s.targetReps ?? ""}
            onBlur={(e) =>
              updateRoutineSet(getClient(), s.id, { targetReps: Number(e.target.value) || 0 })
            }
            aria-label={`Set ${s.order} target reps`}
          />
          <button
            type="button"
            onClick={() => deleteRoutineSet(getClient(), s.id)}
            aria-label="Delete set"
            className="ms-auto w-8 bg-transparent border-none text-lg text-[var(--text-muted)]"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 min-h-11 w-full rounded-lg bg-[var(--surface-2)] text-[var(--accent)] border border-dashed border-[var(--border)] font-semibold"
      >
        + Add set
      </button>
    </section>
  );
}
