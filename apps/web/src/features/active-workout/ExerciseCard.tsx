"use client";

import { addSet } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useQuery } from "@/lib/use-query";
import { SetRow, type SetRowData } from "./SetRow";

interface SessionExerciseRow {
  id: string;
  order: number;
  restSec: number;
  exercise?: { name: string } | null;
}

/**
 * One exercise in the live session: header + its set rows + "add set".
 * Owns its own reactive query for its sets (composes cleanly per card).
 */
export function ExerciseCard({ sessionExercise }: { sessionExercise: SessionExerciseRow }) {
  const { results: sets } = useQuery<SetRowData>(
    (c) =>
      c
        .query("setLogs")
        .Where("sessionExerciseId", "=", sessionExercise.id)
        .Order("order", "ASC"),
    [sessionExercise.id],
  );

  async function onAddSet() {
    const last = sets[sets.length - 1];
    await addSet(getClient(), {
      sessionExerciseId: sessionExercise.id,
      order: sets.length + 1,
      // prefill from the previous set (auto-fill — progressive overload starts here)
      weight: last?.weight ?? 0,
      reps: last?.reps ?? 0,
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
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
        {sessionExercise.exercise?.name ?? "Exercise"}
      </h2>
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          fontSize: "var(--text-sm)",
          color: "var(--text-muted)",
          paddingBottom: "var(--space-1)",
        }}
      >
        <span style={{ width: 24 }}>#</span>
        <span style={{ width: 88 }}>prev</span>
        <span style={{ width: 64, textAlign: "center" }}>kg</span>
        <span style={{ width: 64, textAlign: "center" }}>reps</span>
      </div>

      {sets.map((s) => (
        <SetRow key={s.id} data={s} restSec={sessionExercise.restSec} />
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
          fontSize: "var(--text-base)",
          fontWeight: 600,
        }}
      >
        + Add set
      </button>
    </section>
  );
}
