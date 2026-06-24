"use client";

import { useEffect, useState } from "react";
import type { PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { nextWeight } from "@rackd/core";
import { Badge, mmss } from "@rackd/ui";
import {
  addSet,
  lastPerformance,
  removeSessionExercise,
  replaceSessionExercise,
  updateSessionExercise,
  type PrevSet,
} from "@rackd/db";
import { getClient } from "@/lib/triplit";
import { useUnit } from "@/lib/units-store";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/components/toast/ToastProvider";
import { ExerciseThumb, type ExerciseMediaData } from "@/components/ExerciseMedia";
import { ReplaceExercisePicker } from "@/features/routines/ReplaceExercisePicker";
import { SetRow, type SetRowData } from "./SetRow";
import { PlatesPanel } from "./PlatesPanel";
import { RestSheet } from "./RestSheet";

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

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
  inGroup = false,
  startsRest = true,
  dragging = false,
  onDragHandleDown,
}: {
  sessionExercise: SessionExerciseRow;
  index: number;
  total: number;
  /** Still passed by the parent (kept for API stability); reordering is via the drag handle. */
  onMove: (dir: -1 | 1) => void;
  inGroup?: boolean;
  startsRest?: boolean;
  dragging?: boolean;
  onDragHandleDown?: (e: PointerEvent) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { unit, display } = useUnit();
  const [showRest, setShowRest] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
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

  const ex = sessionExercise.exercise;
  const subtitleRaw = ex?.primaryMuscle || ex?.equipment;
  const subtitle = subtitleRaw ? cap(subtitleRaw) : undefined;

  function goDetails() {
    router.push(`/exercise/${sessionExercise.exerciseId}`);
  }

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
      data-sex={sessionExercise.id}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 ${
        startsRest ? "mb-4" : "mb-1"
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
        {sessionExercise.exercise && (
          <ExerciseThumb ex={sessionExercise.exercise} size={40} onClick={goDetails} />
        )}

        <button
          type="button"
          onClick={goDetails}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
        >
          <span className="flex items-center gap-1">
            <span className="text-lg font-bold truncate">
              {sessionExercise.exercise?.name ?? "Exercise"}
            </span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ›
            </span>
          </span>
          {subtitle && (
            <span className="block text-sm text-[var(--text-muted)] truncate">{subtitle}</span>
          )}
        </button>

        {inGroup && (
          <Badge tone="accent">{startsRest ? "Superset" : "Superset · no rest"}</Badge>
        )}

        <button
          type="button"
          onClick={() => setShowRest(true)}
          aria-label={`Rest ${mmss(sessionExercise.restSec * 1000)} — edit`}
          className="inline-flex shrink-0 items-center gap-1.5 min-h-9 px-3 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" className="text-[var(--text-muted)]">
            <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 9v4l2.5 1.5M9 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {mmss(sessionExercise.restSec * 1000)}
        </button>

        <HeaderMenu
          open={showMenu}
          onOpenChange={setShowMenu}
          onReplace={() => setShowReplace(true)}
          onViewDetails={goDetails}
          onSuperset={() => toast.info("Supersets are coming soon")}
          onRemove={() => removeSessionExercise(getClient(), sessionExercise.id)}
        />
      </div>

      <ReplaceExercisePicker
        currentExerciseId={sessionExercise.exerciseId}
        onReplace={(newId) => replaceSessionExercise(getClient(), sessionExercise.id, newId)}
        open={showReplace}
        onOpenChange={setShowReplace}
      />

      <RestSheet
        open={showRest}
        restSec={sessionExercise.restSec}
        onChange={(sec) => updateSessionExercise(getClient(), sessionExercise.id, { restSec: sec })}
        onClose={() => setShowRest(false)}
      />

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

      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] pb-1">
        <span className="w-6 shrink-0">#</span>
        <span className="w-16 shrink-0">prev</span>
        <span className="w-16 shrink-0 text-center">{unit}</span>
        <span className="w-16 shrink-0 text-center">reps</span>
        <span className="w-12 shrink-0 text-center">RPE</span>
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
    </section>
  );
}

/**
 * The header "…" overflow menu: a popover anchored to the trigger with the
 * exercise actions. Closes on item pick, backdrop tap, or Escape.
 */
function HeaderMenu({
  open,
  onOpenChange,
  onReplace,
  onViewDetails,
  onSuperset,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplace: () => void;
  onViewDetails: () => void;
  onSuperset: () => void;
  onRemove: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  const item =
    "w-full text-left min-h-11 px-4 flex items-center text-[15px] text-[var(--text)] hover:bg-[var(--surface-2)] focus:outline-none focus-visible:bg-[var(--surface-2)]";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Exercise options"
        className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        ⋯
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40"
          />
          <div
            role="menu"
            aria-label="Exercise options"
            className="absolute right-0 top-full mt-1 z-50 min-w-[220px] py-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] overflow-hidden"
          >
            <button type="button" role="menuitem" onClick={() => run(onReplace)} className={item}>
              Replace exercise
            </button>
            <button type="button" role="menuitem" onClick={() => run(onViewDetails)} className={item}>
              View details
            </button>
            <button type="button" role="menuitem" onClick={() => run(onSuperset)} className={item}>
              {/* TODO: #16 superset — stubbed until grouping logic lands */}
              Make superset with next
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onRemove)}
              className={`${item} text-[var(--danger)]`}
            >
              Remove exercise
            </button>
          </div>
        </>
      )}
    </div>
  );
}
