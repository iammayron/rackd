"use client";

import type { PointerEvent } from "react";
import {
  addRoutineSet,
  updateRoutineSet,
  deleteRoutineSet,
  removeRoutineExercise,
  replaceRoutineExercise,
} from "@myfit/db";
import { getClient } from "@/lib/triplit";
import { useUnit } from "@/lib/units-store";
import { useQuery } from "@/lib/use-query";
import { MoveButtons } from "@/components/MoveButtons";
import { ReplaceExercisePicker } from "@/features/routines/ReplaceExercisePicker";

interface RoutineExerciseRow {
  id: string;
  order: number;
  exerciseId: string;
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
  index,
  total,
  onMove,
  inGroup,
  linkedNext,
  onToggleNext,
  dragging,
  onDragHandleDown,
}: {
  routineExercise: RoutineExerciseRow;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  inGroup: boolean;
  linkedNext: boolean;
  onToggleNext: () => void;
  dragging?: boolean;
  onDragHandleDown?: (e: PointerEvent) => void;
}) {
  const { unit, display, toKg } = useUnit();
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
    <section
      data-rex={routineExercise.id}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 ${
        linkedNext ? "mb-1" : "mb-4"
      } ${inGroup ? "border-l-4 border-l-[var(--accent)]" : ""} ${
        dragging ? "opacity-60 ring-2 ring-[var(--accent)]" : ""
      }`}
    >
      {inGroup && (
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--accent)] mb-1">
          Superset
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <MoveButtons index={index} total={total} onMove={onMove} />
        {onDragHandleDown && (
          <button
            type="button"
            onPointerDown={onDragHandleDown}
            aria-label="Drag to reorder"
            style={{ touchAction: "none", cursor: "grab" }}
            className="flex items-center justify-center w-6 text-[var(--text-muted)] select-none"
          >
            ⠿
          </button>
        )}
        <h2 className="text-lg font-bold">
          {routineExercise.exercise?.name ?? "Exercise"}
        </h2>
        <div className="ms-auto flex items-center gap-2">
          <ReplaceExercisePicker
            currentExerciseId={routineExercise.exerciseId}
            onReplace={(newId) =>
              replaceRoutineExercise(getClient(), routineExercise.id, newId)
            }
          />
          <button
            type="button"
            onClick={() => removeRoutineExercise(getClient(), routineExercise.id)}
            aria-label="Remove exercise"
            className="bg-transparent border-none text-lg text-[var(--text-muted)]"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex gap-3 text-sm text-[var(--text-muted)]">
        <span className="w-6">set</span>
        <span className="w-[72px] text-center">{unit}</span>
        <span className="w-[72px] text-center">reps</span>
      </div>

      {sets.map((s) => (
        <div key={s.id} className="flex items-center gap-3 py-2">
          <span className="w-6 font-semibold text-[var(--text-muted)]">{s.order}</span>
          <input
            className={CELL}
            inputMode="decimal"
            placeholder={unit}
            defaultValue={s.targetWeight != null ? display(s.targetWeight) : ""}
            onBlur={(e) =>
              updateRoutineSet(getClient(), s.id, {
                targetWeight: e.target.value ? toKg(Number(e.target.value)) : 0,
              })
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

      {index < total - 1 && (
        <button
          type="button"
          onClick={onToggleNext}
          className={`mt-2 min-h-9 w-full rounded-lg text-sm font-semibold ${
            linkedNext
              ? "bg-[var(--accent)] text-white"
              : "bg-transparent text-[var(--text-muted)] border border-[var(--border)]"
          }`}
        >
          ⛓ {linkedNext ? "Supersetted with next" : "Superset with next"}
        </button>
      )}
    </section>
  );
}
