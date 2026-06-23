"use client";

import { useEffect, useState } from "react";
import { nextWeight } from "@fitnow/core";
import { addSet, lastPerformance, type PrevSet } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useQuery } from "@/lib/use-query";
import { SetRow, type SetRowData } from "./SetRow";
import { PlatesPanel } from "./PlatesPanel";

interface SessionExerciseRow {
  id: string;
  sessionId: string;
  exerciseId: string;
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

  // "prev" = this exercise's last completed performance in a finished session.
  const [prev, setPrev] = useState<PrevSet[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    lastPerformance(getClient(), {
      exerciseId: sessionExercise.exerciseId,
      excludeSessionId: sessionExercise.sessionId,
    }).then((p) => {
      if (!cancelled) setPrev(p);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionExercise.exerciseId, sessionExercise.sessionId]);

  function prevFor(order: number): PrevSet | undefined {
    return prev?.find((p) => p.order === order);
  }

  // Heaviest set last time → progressive-overload target for this session.
  const prevTop = prev?.reduce((b, s) => (s.weight > b.weight ? s : b), prev[0]!);
  const suggestedWeight = prevTop
    ? nextWeight(prevTop.weight, prevTop.reps, prevTop.reps)
    : undefined;
  const noneCompleted = sets.every((s) => !s.completed);

  async function onAddSet() {
    const order = sets.length + 1;
    const last = sets[sets.length - 1];
    const fallback = prevFor(order) ?? prev?.[prev.length - 1];
    // first set of the session → suggest the progressive-overload weight
    const firstWeight = suggestedWeight ?? fallback?.weight ?? 0;
    await addSet(getClient(), {
      sessionExerciseId: sessionExercise.id,
      order,
      weight: last?.weight ?? firstWeight,
      reps: last?.reps ?? prevTop?.reps ?? fallback?.reps ?? 0,
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

      {prevTop && suggestedWeight !== undefined && noneCompleted && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "var(--space-2) var(--space-3)",
            marginBottom: "var(--space-3)",
            fontSize: "var(--text-sm)",
          }}
        >
          <span>📈 Try</span>
          <strong style={{ color: "var(--accent)" }}>
            {suggestedWeight} kg × {prevTop.reps}
          </strong>
          <span style={{ color: "var(--text-muted)" }}>
            (last {prevTop.weight}×{prevTop.reps})
          </span>
        </div>
      )}

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

      {sets.map((s) => {
        const p = prevFor(s.order);
        return (
          <SetRow
            key={s.id}
            data={s}
            restSec={sessionExercise.restSec}
            prevLabel={p ? `${p.weight}×${p.reps}` : undefined}
          />
        );
      })}

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

      <PlatesPanel topWeight={sets.reduce((m, s) => Math.max(m, s.weight), 0)} />
    </section>
  );
}
