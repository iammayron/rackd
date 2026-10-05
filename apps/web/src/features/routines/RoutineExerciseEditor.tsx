"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { BAR_LABELS, BAR_WEIGHTS } from "@rackd/core";
import type { BarType } from "@rackd/core";
import { Badge, mmss } from "@rackd/ui";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryClient, qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { ExerciseThumb, type ExerciseMediaData } from "@/components/ExerciseMedia";
import { ReplaceExercisePicker } from "@/features/routines/ReplaceExercisePicker";
import { useExerciseDetail } from "@/features/exercise/exercise-detail-store";
import { HeaderMenu } from "@/features/active-workout/ExerciseCard";
import { RestSheet } from "@/features/active-workout/RestSheet";
import { PlatesPanel } from "@/features/active-workout/PlatesPanel";
import { SetValueSheet } from "@/features/active-workout/SetValueSheet";

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

interface RoutineExerciseRow {
  id: string;
  routineId: string;
  order: number;
  exerciseId: string;
  restSec: number;
  barType?: BarType;
  exercise?: ExerciseMediaData | null;
}

interface RoutineSetData {
  id: string;
  order: number;
  targetWeight?: number;
  targetReps?: number;
}

/** Last completed performance of an exercise (was a `@rackd/db` type). */
interface PrevSet {
  order: number;
  weight: number;
  reps: number;
}

/** The nested routine-exercise shape from GET /api/routines/[id]. */
interface RoutineDetailExercise {
  id: string;
  sets: RoutineSetData[];
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
  existingIds,
}: {
  routineExercise: RoutineExerciseRow;
  inGroup: boolean;
  linkedNext: boolean;
  onToggleNext: () => void;
  dragging?: boolean;
  onDragHandleDown?: (e: PointerEvent) => void;
  /** Every exercise id in the routine — so Replace can't swap in a duplicate. */
  existingIds?: string[];
}) {
  const confirm = useConfirm();
  const { unit, display } = useUnit();
  const [showRest, setShowRest] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  // Sets live inside the owning routine's nested fetch; read them from that
  // cached query (no extra request) and keep them ordered.
  const { data: sets = [] } = useQuery({
    queryKey: qk.routine(routineExercise.routineId),
    queryFn: () =>
      api<{ exercises: RoutineDetailExercise[] }>(`/api/routines/${routineExercise.routineId}`),
    select: (routine) =>
      [...(routine.exercises.find((e) => e.id === routineExercise.id)?.sets ?? [])].sort(
        (a, b) => a.order - b.order,
      ),
  });

  // "prev" = this exercise's last completed performance in a finished session.
  const { data: prev = null } = useQuery({
    queryKey: qk.lastPerformance(routineExercise.exerciseId),
    queryFn: () =>
      api<PrevSet[] | null>(`/api/exercises/${routineExercise.exerciseId}/last-performance`),
  });

  function prevFor(order: number): PrevSet | undefined {
    return prev?.find((p) => p.order === order);
  }

  const ex = routineExercise.exercise;
  const subtitleRaw = ex?.primaryMuscle || ex?.equipment;
  const subtitle = subtitleRaw ? cap(subtitleRaw) : undefined;
  const isBarbell = ex?.equipment === "barbell";
  const barType = routineExercise.barType ?? "standard";

  async function onBarTypeChange(next: BarType) {
    await api(`/api/routine-exercises/${routineExercise.id}`, {
      method: "PUT",
      body: JSON.stringify({ barType: next }),
    });
    invalidate();
  }

  const openExercise = useExerciseDetail((s) => s.open);
  function goDetails() {
    openExercise(routineExercise.exerciseId);
  }

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.routine(routineExercise.routineId) });

  async function onAddSet() {
    const last = sets[sets.length - 1];
    await api("/api/routine-sets", {
      method: "POST",
      body: JSON.stringify({
        routineExerciseId: routineExercise.id,
        order: sets.length + 1,
        targetWeight: last?.targetWeight,
        targetReps: last?.targetReps ?? 8,
      }),
    });
    invalidate();
  }

  return (
    <section
      data-rex={routineExercise.id}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 ${
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
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            aria-hidden="true"
            className="text-[var(--text-muted)]"
          >
            <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 9v4l2.5 1.5M9 2h6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {mmss(routineExercise.restSec * 1000)}
        </button>

        <HeaderMenu
          open={showMenu}
          onOpenChange={setShowMenu}
          onReplace={() => setShowReplace(true)}
          onViewDetails={goDetails}
          onSuperset={onToggleNext}
          onRemove={async () => {
            // Deleting the routine exercise cascades its prescribed sets.
            const ok = await confirm({
              title: `Remove ${routineExercise.exercise?.name ?? "this exercise"}?`,
              message: "Its prescribed sets are removed from this routine.",
              confirmLabel: "Remove exercise",
            });
            if (!ok) return;
            await api(`/api/routine-exercises/${routineExercise.id}`, { method: "DELETE" });
            invalidate();
          }}
        />
      </div>

      <ReplaceExercisePicker
        currentExerciseId={routineExercise.exerciseId}
        existingIds={existingIds}
        onReplace={async (newId) => {
          await api(`/api/routine-exercises/${routineExercise.id}/replace`, {
            method: "POST",
            body: JSON.stringify({ exerciseId: newId }),
          });
          invalidate();
        }}
        open={showReplace}
        onOpenChange={setShowReplace}
      />

      <RestSheet
        open={showRest}
        restSec={routineExercise.restSec}
        onChange={async (sec) => {
          await api(`/api/routine-exercises/${routineExercise.id}`, {
            method: "PUT",
            body: JSON.stringify({ restSec: sec }),
          });
          invalidate();
        }}
        onClose={() => setShowRest(false)}
      />

      {isBarbell && (
        <label className="flex items-center gap-2 pb-2 text-sm text-[var(--text-muted)]">
          <span className="shrink-0">Bar</span>
          <select
            value={barType}
            onChange={(e) => onBarTypeChange(e.target.value as BarType)}
            aria-label="Bar type"
            className="min-h-9 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {(Object.keys(BAR_LABELS) as BarType[]).map((b) => (
              <option key={b} value={b}>
                {BAR_LABELS[b]} · {BAR_WEIGHTS[b][unit]} {unit}
              </option>
            ))}
          </select>
        </label>
      )}

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
            routineId={routineExercise.routineId}
            prevLabel={p ? `${display(p.weight)}×${p.reps}` : undefined}
          />
        );
      })}

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--accent)] border border-dashed border-[var(--border)] text-base font-semibold"
      >
        + Add set
      </button>

      {isBarbell && (
        <PlatesPanel
          topWeight={sets.reduce((m, s) => Math.max(m, s.targetWeight ?? 0), 0)}
          barType={barType}
        />
      )}
    </section>
  );
}

/** Weight/reps display cell — a tap target that opens the slide-up editor. */
const CELL =
  "w-16 shrink-0 inline-flex items-center justify-center gap-0.5 min-h-11 text-center bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-[var(--radius-sm)] text-lg px-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

/**
 * One routine set row: target weight + reps as tap-to-edit cells (same
 * {@link SetValueSheet} interaction as the live workout), plus delete. No RPE
 * or ✓-complete — those are performance-only.
 */
function RoutineSetRow({
  data,
  routineId,
  prevLabel,
}: {
  data: RoutineSetData;
  routineId: string;
  prevLabel?: string;
}) {
  const confirm = useConfirm();
  const { unit, display, toKg } = useUnit();
  const [weight, setWeight] = useState(data.targetWeight ? String(display(data.targetWeight)) : "");
  const [reps, setReps] = useState(String(data.targetReps || ""));
  const [editing, setEditing] = useState<"weight" | "reps" | null>(null);

  // While our own write is in flight we don't overwrite local state from the
  // query echo (write→subscribe loop), mirroring the live SetRow.
  const weightWriting = useRef(false);
  const repsWriting = useRef(false);

  useEffect(() => {
    if (!weightWriting.current)
      setWeight(data.targetWeight ? String(display(data.targetWeight)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.targetWeight, unit]);
  useEffect(() => {
    if (!repsWriting.current) setReps(String(data.targetReps || ""));
  }, [data.targetReps]);

  async function commitWeight(value: number) {
    setWeight(value ? String(value) : "");
    weightWriting.current = true;
    try {
      await api(`/api/routine-sets/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({ targetWeight: value ? toKg(value) : 0 }),
      });
      queryClient.invalidateQueries({ queryKey: qk.routine(routineId) });
    } finally {
      weightWriting.current = false;
    }
  }
  async function commitReps(value: number) {
    setReps(value ? String(value) : "");
    repsWriting.current = true;
    try {
      await api(`/api/routine-sets/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({ targetReps: value }),
      });
      queryClient.invalidateQueries({ queryKey: qk.routine(routineId) });
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
        onClick={async () => {
          const ok = await confirm({
            title: "Remove this set?",
            message: "Its target weight and reps are removed from the routine.",
            confirmLabel: "Remove set",
          });
          if (!ok) return;
          await api(`/api/routine-sets/${data.id}`, { method: "DELETE" });
          queryClient.invalidateQueries({ queryKey: qk.routine(routineId) });
        }}
        aria-label="Delete set"
        className="ms-auto shrink-0 min-h-11 w-7 bg-transparent border-none text-lg text-[var(--text-muted)]"
      >
        ×
      </button>
    </div>
  );
}
