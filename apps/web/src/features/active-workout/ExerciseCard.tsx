"use client";

import { useEffect, useState } from "react";
import { nextWeight } from "@fitnow/core";
import { addSet, lastPerformance, removeSessionExercise, type PrevSet } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useUnit } from "@/lib/units-store";
import { useQuery } from "@/lib/use-query";
import { MoveButtons } from "@/components/MoveButtons";
import { ExerciseThumb, ExerciseMediaModal, type ExerciseMediaData } from "@/components/ExerciseMedia";
import { SetRow, type SetRowData } from "./SetRow";
import { PlatesPanel } from "./PlatesPanel";

interface SessionExerciseRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  restSec: number;
  exercise?: ExerciseMediaData | null;
}

/**
 * One exercise in the live session: header + its set rows + "add set".
 * Owns its own reactive query for its sets (composes cleanly per card).
 */
export function ExerciseCard({
  sessionExercise,
  index,
  total,
  onMove,
  inGroup = false,
  startsRest = true,
}: {
  sessionExercise: SessionExerciseRow;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  inGroup?: boolean;
  startsRest?: boolean;
}) {
  const { unit, display } = useUnit();
  const [showMedia, setShowMedia] = useState(false);
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
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4 ${
        inGroup ? "border-l-4 border-l-[var(--accent)]" : ""
      }`}
    >
      {inGroup && (
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--accent)] mb-1">
          Superset{!startsRest ? " → no rest, go to next" : ""}
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <MoveButtons index={index} total={total} onMove={onMove} />
        {sessionExercise.exercise && (
          <ExerciseThumb ex={sessionExercise.exercise} size={40} onClick={() => setShowMedia(true)} />
        )}
        <h2 className="text-lg font-bold">
          {sessionExercise.exercise?.name ?? "Exercise"}
        </h2>
        <button
          type="button"
          onClick={() => removeSessionExercise(getClient(), sessionExercise.id)}
          aria-label="Remove exercise"
          className="ms-auto bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ×
        </button>
      </div>

      {prevTop && suggestedWeight !== undefined && noneCompleted && (
        <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg py-2 px-3 mb-3 text-sm">
          <span>📈 Try</span>
          <strong className="text-[var(--accent)]">
            {display(suggestedWeight)} {unit} × {prevTop.reps}
          </strong>
          <span className="text-[var(--text-muted)]">
            (last {display(prevTop.weight)}×{prevTop.reps})
          </span>
        </div>
      )}

      <div className="flex gap-3 text-sm text-[var(--text-muted)] pb-1">
        <span className="w-6">#</span>
        <span className="w-[88px]">prev</span>
        <span className="w-16 text-center">kg</span>
        <span className="w-16 text-center">reps</span>
      </div>

      {sets.map((s) => {
        const p = prevFor(s.order);
        return (
          <SetRow
            key={s.id}
            data={s}
            restSec={sessionExercise.restSec}
            startsRest={startsRest}
            prevLabel={p ? `${display(p.weight)}×${p.reps}` : undefined}
          />
        );
      })}

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 min-h-11 w-full rounded-lg bg-[var(--surface-2)] text-[var(--accent)] border border-dashed border-[var(--border)] text-base font-semibold"
      >
        + Add set
      </button>

      <PlatesPanel topWeight={sets.reduce((m, s) => Math.max(m, s.weight), 0)} />

      {showMedia && sessionExercise.exercise && (
        <ExerciseMediaModal ex={sessionExercise.exercise} onClose={() => setShowMedia(false)} />
      )}
    </section>
  );
}
