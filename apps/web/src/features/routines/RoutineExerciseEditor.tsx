"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge, mmss } from "@rackd/ui";
import {
  addRoutineSet,
  updateRoutineSet,
  deleteRoutineSet,
  removeRoutineExercise,
  replaceRoutineExercise,
  updateRoutineExercise,
  lastPerformance,
  type PrevSet,
} from "@rackd/db";
import { getClient } from "@/lib/triplit";
import { useUnit } from "@/lib/units-store";
import { useQuery } from "@/lib/use-query";
import { ExerciseThumb, type ExerciseMediaData } from "@/components/ExerciseMedia";
import { ReplaceExercisePicker } from "@/features/routines/ReplaceExercisePicker";
import { HeaderMenu } from "@/features/active-workout/ExerciseCard";
import { RestSheet } from "@/features/active-workout/RestSheet";
import { PlatesPanel } from "@/features/active-workout/PlatesPanel";
import { SetValueSheet } from "@/features/active-workout/SetValueSheet";

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

interface RoutineExerciseRow {
  id: string;
  order: number;
  exerciseId: string;
  restSec: number;
  exercise?: ExerciseMediaData | null;
}

interface RoutineSetData {
  id: string;
  order: number;
  targetWeight?: number;
  targetReps?: number;
}

/**
 * One exercise in the routine editor. Mirrors the live-session
 * {@link ExerciseCard} (drag handle, thumbnail, name›, muscle subtitle, rest
 * chip, ⋯ menu) but writes ROUTINE targets — so it drops the performance-only
 * RPE and ✓-complete columns. Owns its own reactive query for its sets.
 */
export function RoutineExerciseEditor({
  routineExercise,
  inGroup,
  onToggleNext,
  dragging,
  onDragHandleDown,
}: {
  routineExercise: RoutineExerciseRow;
  inGroup: boolean;
  linkedNext: boolean;
  onToggleNext: () => void;
  dragging?: boolean;
  onDragHandleDown?: (e: PointerEvent) => void;
}) {
  const router = useRouter();
  const { unit, display } = useUnit();
  const [showRest, setShowRest] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const { results: sets } = useQuery<RoutineSetData>(
    (c) =>
      c.query("routineSets").Where("routineExerciseId", "=", routineExercise.id).Order("order", "ASC"),
    [routineExercise.id],
  );

  // "prev" = this exercise's last completed performance in a finished session.
  const [prev, setPrev] = useState<PrevSet[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    lastPerformance(getClient(), { exerciseId: routineExercise.exerciseId }).then((p) => {
      if (!cancelled) setPrev(p);
    });
    return () => {
      cancelled = true;
    };
  }, [routineExercise.exerciseId]);

  function prevFor(order: number): PrevSet | undefined {
    return prev?.find((p) => p.order === order);
  }

  const ex = routineExercise.exercise;
  const subtitleRaw = ex?.primaryMuscle || ex?.equipment;
  const subtitle = subtitleRaw ? cap(subtitleRaw) : undefined;

  function goDetails() {
    router.push(`/exercise/${routineExercise.exerciseId}`);
  }

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
        inGroup ? "mb-1" : "mb-4"
      } ${dragging ? "opacity-60 ring-2 ring-[var(--accent)]" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {onDragHandleDown && (
          <button
            type="button"
            onPointerDown={onDragHandleDown}
            aria-label="Drag to reorder"
            style={{ touchAction: "none", cursor: "grab" }}
            className="flex items-center justify-center w-6 shrink-0 text-[var(--text-muted)] select-none"
          >
            ⠿
          </button>
        )}
        {ex && <ExerciseThumb ex={ex} size={40} onClick={goDetails} />}

        <button
          type="button"
          onClick={goDetails}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
        >
          <span className="flex items-center gap-1">
            <span className="text-lg font-bold truncate">{ex?.name ?? "Exercise"}</span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ›
            </span>
          </span>
          {subtitle && (
            <span className="block text-sm text-[var(--text-muted)] truncate">{subtitle}</span>
          )}
        </button>

        {inGroup && <Badge tone="accent">Superset</Badge>}

        <button
          type="button"
          onClick={() => setShowRest(true)}
          aria-label={`Rest ${mmss(routineExercise.restSec * 1000)} — edit`}
          className="inline-flex shrink-0 items-center gap-1.5 min-h-9 px-3 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" className="text-[var(--text-muted)]">
            <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 9v4l2.5 1.5M9 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {mmss(routineExercise.restSec * 1000)}
        </button>

        <HeaderMenu
          open={showMenu}
          onOpenChange={setShowMenu}
          onReplace={() => setShowReplace(true)}
          onViewDetails={goDetails}
          onSuperset={onToggleNext}
          onRemove={() => removeRoutineExercise(getClient(), routineExercise.id)}
        />
      </div>

      <ReplaceExercisePicker
        currentExerciseId={routineExercise.exerciseId}
        onReplace={(newId) => replaceRoutineExercise(getClient(), routineExercise.id, newId)}
        open={showReplace}
        onOpenChange={setShowReplace}
      />

      <RestSheet
        open={showRest}
        restSec={routineExercise.restSec}
        onChange={(sec) => updateRoutineExercise(getClient(), routineExercise.id, { restSec: sec })}
        onClose={() => setShowRest(false)}
      />

      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] pb-1">
        <span className="w-6 shrink-0">#</span>
        <span className="w-16 shrink-0">prev</span>
        <span className="w-16 shrink-0 text-center">{unit}</span>
        <span className="w-16 shrink-0 text-center">reps</span>
      </div>

      {sets.map((s) => {
        const p = prevFor(s.order);
        return (
          <RoutineSetRow
            key={s.id}
            data={s}
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

      <PlatesPanel topWeight={sets.reduce((m, s) => Math.max(m, s.targetWeight ?? 0), 0)} />
    </section>
  );
}

/** Weight/reps display cell — a tap target that opens the slide-up editor. */
const CELL =
  "w-16 shrink-0 inline-flex items-center justify-center gap-0.5 min-h-11 text-center bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md text-lg px-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

/**
 * One routine set row: target weight + reps as tap-to-edit cells (same
 * {@link SetValueSheet} interaction as the live workout), plus delete. No RPE
 * or ✓-complete — those are performance-only.
 */
function RoutineSetRow({ data, prevLabel }: { data: RoutineSetData; prevLabel?: string }) {
  const { unit, display, toKg } = useUnit();
  const [weight, setWeight] = useState(data.targetWeight ? String(display(data.targetWeight)) : "");
  const [reps, setReps] = useState(String(data.targetReps || ""));
  const [editing, setEditing] = useState<"weight" | "reps" | null>(null);

  // While our own write is in flight we don't overwrite local state from the
  // query echo (write→subscribe loop), mirroring the live SetRow.
  const weightWriting = useRef(false);
  const repsWriting = useRef(false);

  useEffect(() => {
    if (!weightWriting.current) setWeight(data.targetWeight ? String(display(data.targetWeight)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.targetWeight, unit]);
  useEffect(() => {
    if (!repsWriting.current) setReps(String(data.targetReps || ""));
  }, [data.targetReps]);

  async function commitWeight(value: number) {
    setWeight(value ? String(value) : "");
    weightWriting.current = true;
    try {
      await updateRoutineSet(getClient(), data.id, { targetWeight: value ? toKg(value) : 0 });
    } finally {
      weightWriting.current = false;
    }
  }
  async function commitReps(value: number) {
    setReps(value ? String(value) : "");
    repsWriting.current = true;
    try {
      await updateRoutineSet(getClient(), data.id, { targetReps: value });
    } finally {
      repsWriting.current = false;
    }
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <span className="w-6 shrink-0 font-semibold text-[var(--text-muted)]">{data.order}</span>
      <span className="w-16 shrink-0 text-sm text-[var(--text-muted)] truncate">
        {prevLabel ?? "—"}
      </span>

      <button
        type="button"
        onClick={() => setEditing("weight")}
        aria-label={`Set ${data.order} target weight${weight ? ` ${weight} ${unit}` : ""}, tap to edit`}
        aria-haspopup="dialog"
        className={CELL}
      >
        {weight ? weight : <span className="text-[var(--text-muted)]">{unit}</span>}
      </button>

      <button
        type="button"
        onClick={() => setEditing("reps")}
        aria-label={`Set ${data.order} target reps${reps ? ` ${reps}` : ""}, tap to edit`}
        aria-haspopup="dialog"
        className={CELL}
      >
        {reps ? reps : <span className="text-[var(--text-muted)]">reps</span>}
      </button>

      <SetValueSheet
        open={editing === "weight"}
        title={`Weight (${unit})`}
        initial={Number(weight) || 0}
        step={unit === "kg" ? 2.5 : 5}
        suffix={unit}
        inputMode="decimal"
        onCommit={commitWeight}
        onClose={() => setEditing(null)}
      />
      <SetValueSheet
        open={editing === "reps"}
        title="Reps"
        initial={Number(reps) || 0}
        step={1}
        integer
        inputMode="numeric"
        onCommit={commitReps}
        onClose={() => setEditing(null)}
      />

      <button
        type="button"
        onClick={() => deleteRoutineSet(getClient(), data.id)}
        aria-label="Delete set"
        className="ms-auto shrink-0 min-h-11 w-7 bg-transparent border-none text-lg text-[var(--text-muted)]"
      >
        ×
      </button>
    </div>
  );
}
