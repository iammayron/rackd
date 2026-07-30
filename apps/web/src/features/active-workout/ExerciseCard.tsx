"use client";

import { useEffect, useState } from "react";
import type { PointerEvent } from "react";
import { nextWeight } from "@rackd/core";
import type { BarType } from "@rackd/core";
import { mmss } from "@rackd/ui";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { useToast } from "@/components/toast/ToastProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  ExerciseThumb,
  type ExerciseMediaData,
} from "@/components/ExerciseMedia";
import { ReplaceExercisePicker } from "@/features/routines/ReplaceExercisePicker";
import { useExerciseDetail } from "@/features/exercise/exercise-detail-store";
import { SetRow, type SetRowData } from "./SetRow";
import { copyTargets } from "./copy-targets";
import { PlatesPanel } from "./PlatesPanel";
import { RestSheet } from "./RestSheet";

interface PrevSet {
  order: number;
  weight: number;
  reps: number;
}

const cap = (s: string) =>
  !s
    ? s
    : s.toLowerCase() === "fullbody"
      ? "Full body"
      : s.charAt(0).toUpperCase() + s.slice(1);

interface SessionExerciseRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  restSec: number;
  barType?: BarType;
  exercise?: ExerciseMediaData | null;
  sets?: SetRowData[];
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
  existingIds,
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
  /** Every exercise id in the session — so Replace can't swap in a duplicate. */
  existingIds?: string[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { unit, display } = useUnit();
  const [showRest, setShowRest] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  // Sets come down from the session tree the page loads; keep them ordered.
  const sets = [...(sessionExercise.sets ?? [])].sort(
    (a, b) => a.order - b.order,
  );

  // "prev" = this exercise's last completed performance in a finished session.
  const [prev, setPrev] = useState<PrevSet[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<PrevSet[] | null>(
      `/api/exercises/${sessionExercise.exerciseId}/last-performance?excludeSessionId=${sessionExercise.sessionId}`,
    ).then((p) => {
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
  const prevTop = prev?.reduce(
    (b, s) => (s.weight > b.weight ? s : b),
    prev[0]!,
  );
  const suggestedWeight = prevTop
    ? nextWeight(prevTop.weight, prevTop.reps, prevTop.reps)
    : undefined;
  const noneCompleted = sets.every((s) => !s.completed);

  const ex = sessionExercise.exercise;
  const subtitleRaw = ex?.primaryMuscle || ex?.equipment;
  const subtitle = subtitleRaw ? cap(subtitleRaw) : undefined;

  const openExercise = useExerciseDetail((s) => s.open);
  function goDetails() {
    openExercise(sessionExercise.exerciseId);
  }

  /**
   * After a set is completed, offer to copy its weight/reps to any LATER sets
   * (higher `order`) in this exercise that aren't done yet AND don't already
   * match — no point prompting to copy onto identical values. Non-blocking
   * toast with a "Copy" action; ignored = auto-dismiss, no change.
   *
   * "Match" is judged at display precision, not raw kg. Storage is canonical kg
   * while the lifter reads a rounded lb/kg value, so two sets can differ in the
   * 4th decimal and be indistinguishable on screen — prompting to copy 93.7 lb
   * onto 93.7 lb reads as a bug. Comparing what's actually shown also absorbs
   * rows that already drifted before the write path stopped rewriting them.
   */
  function onSetCompleted(set: SetRowData) {
    const targets = copyTargets(sets, set, display);
    if (targets.length === 0) return;
    toast.info(
      `Copy ${display(set.weight)} ${unit} × ${set.reps} to remaining sets?`,
      {
        action: {
          label: "Copy",
          onClick: async () => {
            await Promise.all(
              targets.map((t) =>
                api(`/api/set-logs/${t.id}`, {
                  method: "PUT",
                  body: JSON.stringify({ weight: set.weight, reps: set.reps }),
                }),
              ),
            );
            queryClient.invalidateQueries({
              queryKey: qk.session(sessionExercise.sessionId),
            });
            toast.success(
              `Copied to ${targets.length} set${targets.length === 1 ? "" : "s"}`,
            );
          },
        },
      },
    );
  }

  async function onAddSet() {
    const order = sets.length + 1;
    const last = sets[sets.length - 1];
    const fallback = prevFor(order) ?? prev?.[prev.length - 1];
    // first set of the session → suggest the progressive-overload weight
    const firstWeight = suggestedWeight ?? fallback?.weight ?? 0;
    await api("/api/set-logs", {
      method: "POST",
      body: JSON.stringify({
        sessionExerciseId: sessionExercise.id,
        order,
        weight: last?.weight ?? firstWeight,
        reps: last?.reps ?? prevTop?.reps ?? fallback?.reps ?? 0,
      }),
    });
    queryClient.invalidateQueries({
      queryKey: qk.session(sessionExercise.sessionId),
    });
  }

  return (
    <section
      data-sex={sessionExercise.id}
      // scroll-margin so auto-scroll (#18) lands the card below the sticky header
      style={{ scrollMarginTop: "calc(var(--safe-top) + 72px)" }}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 ${
        inGroup ? "" : "mb-4"
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
          <ExerciseThumb
            ex={sessionExercise.exercise}
            size={40}
            onClick={goDetails}
          />
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
            <span className="block text-sm text-[var(--text-muted)] truncate">
              {subtitle}
            </span>
          )}
        </button>

        {inGroup && !startsRest && (
          <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
            no rest →
          </span>
        )}

        {/* In a superset, only the last exercise rests, so the rest control
            lives on the resting member; the others go straight to the partner. */}
        {startsRest && (
          <button
            type="button"
            onClick={() => setShowRest(true)}
            aria-label={`Rest ${mmss(sessionExercise.restSec * 1000)} — edit`}
            className="inline-flex shrink-0 items-center gap-1.5 min-h-9 px-3 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden="true"
              className="text-[var(--text-muted)]"
            >
              <circle
                cx="12"
                cy="13"
                r="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 9v4l2.5 1.5M9 2h6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {mmss(sessionExercise.restSec * 1000)}
          </button>
        )}

        <HeaderMenu
          open={showMenu}
          onOpenChange={setShowMenu}
          onReplace={() => setShowReplace(true)}
          onViewDetails={goDetails}
          onSuperset={() => toast.info("Supersets are coming soon")}
          onRemove={async () => {
            // Highest-stakes destructive action in the app: the API cascades,
            // so every set already logged against this exercise goes with it.
            const logged = (sessionExercise.sets ?? []).filter(
              (x) => x.completed,
            ).length;
            const ok = await confirm({
              title: `Remove ${sessionExercise.exercise?.name ?? "this exercise"}?`,
              message: logged
                ? `${logged} completed ${logged === 1 ? "set" : "sets"} logged for it will be deleted too.`
                : "It will be removed from this workout.",
              confirmLabel: "Remove exercise",
            });
            if (!ok) return;
            await api(`/api/session-exercises/${sessionExercise.id}`, {
              method: "DELETE",
            });
            queryClient.invalidateQueries({
              queryKey: qk.session(sessionExercise.sessionId),
            });
          }}
        />
      </div>

      <ReplaceExercisePicker
        currentExerciseId={sessionExercise.exerciseId}
        existingIds={existingIds}
        onReplace={async (newId) => {
          await api(`/api/session-exercises/${sessionExercise.id}/replace`, {
            method: "POST",
            body: JSON.stringify({ exerciseId: newId }),
          });
          queryClient.invalidateQueries({
            queryKey: qk.session(sessionExercise.sessionId),
          });
        }}
        open={showReplace}
        onOpenChange={setShowReplace}
      />

      <RestSheet
        open={showRest}
        restSec={sessionExercise.restSec}
        onChange={async (sec) => {
          await api(`/api/session-exercises/${sessionExercise.id}`, {
            method: "PUT",
            body: JSON.stringify({ restSec: sec }),
          });
          queryClient.invalidateQueries({
            queryKey: qk.session(sessionExercise.sessionId),
          });
        }}
        onClose={() => setShowRest(false)}
      />

      {prevTop && suggestedWeight !== undefined && noneCompleted && (
        <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] py-2 px-3 mb-3 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-[var(--accent)]"
              aria-hidden="true"
            >
              <path d="M3 3v16a2 2 0 0 0 2 2h16" />
              <path d="m7 13 3-3 3 3 5-5" />
            </svg>
            Try
          </span>
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
            sessionId={sessionExercise.sessionId}
            restSec={sessionExercise.restSec}
            startsRest={startsRest}
            prevLabel={p ? `${display(p.weight)}×${p.reps}` : undefined}
            onCompleted={onSetCompleted}
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

      {sessionExercise.exercise?.equipment === "barbell" && (
        <PlatesPanel
          topWeight={sets.reduce((m, s) => Math.max(m, s.weight), 0)}
          barType={sessionExercise.barType}
        />
      )}
    </section>
  );
}

/**
 * The header "…" overflow menu: a popover anchored to the trigger with the
 * exercise actions. Closes on item pick, backdrop tap, or Escape.
 */
export function HeaderMenu({
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
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onReplace)}
              className={item}
            >
              Replace exercise
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onViewDetails)}
              className={item}
            >
              View details
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onSuperset)}
              className={item}
            >
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
