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

const cell: React.CSSProperties = {
  width: 72,
  textAlign: "center",
  background: "var(--surface-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--text-base)",
  padding: "var(--space-2)",
};

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
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
          {routineExercise.exercise?.name ?? "Exercise"}
        </h2>
        <button
          onClick={() => removeRoutineExercise(getClient(), routineExercise.id)}
          aria-label="Remove exercise"
          style={{
            marginLeft: "auto",
            background: "transparent",
            color: "var(--text-muted)",
            border: "none",
            fontSize: "var(--text-lg)",
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          fontSize: "var(--text-sm)",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ width: 24 }}>set</span>
        <span style={{ width: 72, textAlign: "center" }}>kg</span>
        <span style={{ width: 72, textAlign: "center" }}>reps</span>
      </div>

      {sets.map((s) => (
        <div
          key={s.id}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0" }}
        >
          <span style={{ width: 24, color: "var(--text-muted)", fontWeight: 600 }}>{s.order}</span>
          <input
            style={cell}
            inputMode="decimal"
            placeholder="kg"
            defaultValue={s.targetWeight ?? ""}
            onBlur={(e) =>
              updateRoutineSet(getClient(), s.id, { targetWeight: Number(e.target.value) || 0 })
            }
            aria-label={`Set ${s.order} target weight`}
          />
          <input
            style={cell}
            inputMode="numeric"
            placeholder="reps"
            defaultValue={s.targetReps ?? ""}
            onBlur={(e) =>
              updateRoutineSet(getClient(), s.id, { targetReps: Number(e.target.value) || 0 })
            }
            aria-label={`Set ${s.order} target reps`}
          />
          <button
            onClick={() => deleteRoutineSet(getClient(), s.id)}
            aria-label="Delete set"
            style={{
              marginLeft: "auto",
              width: 32,
              background: "transparent",
              color: "var(--text-muted)",
              border: "none",
              fontSize: "var(--text-lg)",
            }}
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onAddSet}
        style={{
          marginTop: "var(--space-2)",
          minHeight: "var(--tap-min)",
          width: "100%",
          background: "var(--surface-2)",
          color: "var(--accent)",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius)",
          fontWeight: 600,
        }}
      >
        + Add set
      </button>
    </section>
  );
}
