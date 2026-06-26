"use client";

import { useEffect, useRef, useState } from "react";
import { estimate1RM } from "@rackd/core";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { useTimerStore } from "./timer-store";
import { RpeSheet, rpeColor } from "./RpeSheet";
import { SetValueSheet } from "./SetValueSheet";

export interface SetRowData {
  id: string;
  order: number;
  weight: number;
  reps: number;
  completed: boolean;
  rpe?: number;
}

/** Weight/reps display cell — a tap target that opens the slide-up editor. */
const CELL =
  "w-16 shrink-0 inline-flex items-center justify-center gap-0.5 min-h-11 text-center bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-[var(--radius-sm)] text-lg px-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

/**
 * One set row: weight, reps, complete toggle. Completing a set starts the
 * global rest timer (the core interaction of the whole app). Weight and reps
 * are tap targets — tapping opens {@link SetValueSheet} to edit/step the value.
 */
export function SetRow({
  data,
  sessionId,
  restSec,
  prevLabel,
  startsRest = true,
  onCompleted,
}: {
  data: SetRowData;
  /** Owning session — used to invalidate its tree after a write. */
  sessionId: string;
  restSec: number;
  prevLabel?: string;
  /** false for a supersetted exercise that isn't last in its group — go straight to the partner. */
  startsRest?: boolean;
  /** Called after a set is successfully marked complete (not on un-complete). */
  onCompleted?: (set: SetRowData) => void;
}) {
  const startTimer = useTimerStore((s) => s.start);
  const { unit, display, toKg } = useUnit();
  const [weight, setWeight] = useState(
    data.weight ? String(display(data.weight)) : "",
  );
  const [reps, setReps] = useState(String(data.reps || ""));
  const [rpe, setRpe] = useState<number | undefined>(data.rpe);
  const [rpeOpen, setRpeOpen] = useState(false);
  // Which value's editor is open (one shared sheet serves both).
  const [editing, setEditing] = useState<"weight" | "reps" | null>(null);

  // Keep the exercise we just edited in view (#18). Opening the value sheet
  // pops the keyboard, which on mobile can drift the page; when the sheet
  // closes we re-anchor the owning card. `block: "nearest"` is a no-op if it
  // never moved, so this only corrects an actual drift.
  const rowRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) {
      wasEditing.current = true;
    } else if (wasEditing.current) {
      wasEditing.current = false;
      const card = rowRef.current?.closest<HTMLElement>("[data-sex]");
      if (card) {
        requestAnimationFrame(() =>
          card.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        );
      }
    }
  }, [editing]);

  // Off-screen input focused synchronously inside the open tap (below). Mobile
  // browsers only raise the soft keyboard for a focus() that happens within a
  // user gesture; the sheet's real input mounts a tick later, too late to
  // qualify. Warming the keyboard here lets SetValueSheet hand focus to the
  // real field without the keyboard ever closing.
  const warmupRef = useRef<HTMLInputElement>(null);

  /** Open a value editor, keeping the mobile keyboard up across the sheet mount. */
  function openEditor(field: "weight" | "reps") {
    const warm = warmupRef.current;
    if (warm) {
      warm.inputMode = field === "weight" ? "decimal" : "numeric";
      warm.focus({ preventScroll: true });
    }
    setEditing(field);
  }

  // While our own write is in flight we don't overwrite local state from the
  // query — otherwise the echo (our write coming back through the subscription)
  // could clobber the value we just committed (write→subscribe loop).
  const weightWriting = useRef(false);
  const repsWriting = useRef(false);

  // Resync local state when the persisted value changes, but only when no write
  // of ours is pending. Keeps the canonical-kg → display conversion at the edge.
  useEffect(() => {
    if (!weightWriting.current)
      setWeight(data.weight ? String(display(data.weight)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.weight, unit]);
  useEffect(() => {
    if (!repsWriting.current) setReps(String(data.reps || ""));
  }, [data.reps]);
  useEffect(() => {
    setRpe(data.rpe);
  }, [data.rpe]);

  /** Commit an edited weight (display units): optimistic local update + persist. */
  async function commitWeight(value: number) {
    setWeight(value ? String(value) : "");
    weightWriting.current = true;
    try {
      await api(`/api/set-logs/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({ weight: value ? toKg(value) : 0 }),
      });
      queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
    } finally {
      weightWriting.current = false;
    }
  }
  async function commitReps(value: number) {
    setReps(value ? String(value) : "");
    repsWriting.current = true;
    try {
      await api(`/api/set-logs/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({ reps: value }),
      });
      queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
    } finally {
      repsWriting.current = false;
    }
  }

  /**
   * Pick effort from the sheet. Tapping the already-selected value clears it.
   * Persists (incl. clearing — `updateSet` honours `rpe: undefined`) but leaves
   * the sheet open so the selected level's label stays readable; the sheet's
   * own Done/None/backdrop dismiss it.
   */
  async function chooseRpe(v: number | undefined) {
    const next = rpe === v ? undefined : v;
    setRpe(next);
    // Send explicit null to clear — `undefined` would be dropped by JSON.stringify
    // and the route keys off `"rpe" in body` to distinguish clear from untouched.
    await api(`/api/set-logs/${data.id}`, {
      method: "PUT",
      body: JSON.stringify({ rpe: next ?? null }),
    });
    queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
  }

  async function toggle() {
    const next = !data.completed;
    const kg = weight ? toKg(Number(weight)) : 0;
    const repCount = Number(reps) || 0;
    await api(`/api/set-logs/${data.id}`, {
      method: "PUT",
      body: JSON.stringify({ weight: kg, reps: repCount, completed: next }),
    });
    queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
    if (next && startsRest) startTimer(restSec);
    if (next)
      onCompleted?.({ ...data, weight: kg, reps: repCount, completed: true });
  }

  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-2 py-2 ${data.completed ? "opacity-70" : ""}`}
    >
      <span className="w-6 shrink-0 font-semibold text-[var(--text-muted)]">
        {data.order}
      </span>
      <span className="w-16 shrink-0 text-sm text-[var(--text-muted)] truncate">
        {prevLabel ?? "—"}
      </span>

      <button
        type="button"
        onClick={() => openEditor("weight")}
        aria-label={`Set ${data.order} weight${weight ? ` ${weight} ${unit}` : ""}, tap to edit`}
        aria-haspopup="dialog"
        className={CELL}
      >
        {weight ? (
          weight
        ) : (
          <span className="text-[var(--text-muted)]">{unit}</span>
        )}
      </button>

      <button
        type="button"
        onClick={() => openEditor("reps")}
        aria-label={`Set ${data.order} reps${reps ? ` ${reps}` : ""}, tap to edit`}
        aria-haspopup="dialog"
        className={CELL}
      >
        {reps ? reps : <span className="text-[var(--text-muted)]">reps</span>}
      </button>

      {/* RPE — inline after reps; tap opens the bottom-sheet picker. The chip's
          fill matches the sheet's selected tier color for the same value. */}
      <button
        type="button"
        onClick={() => setRpeOpen(true)}
        aria-label={`Set ${data.order} effort (RPE)`}
        aria-haspopup="dialog"
        className={`w-12 shrink-0 inline-flex items-center justify-center min-h-11 rounded-[var(--radius-sm)] border font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
          rpe != null
            ? "text-[var(--text-on-accent)] border-transparent text-lg"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] text-xs"
        }`}
        style={
          rpe != null
            ? { background: rpeColor(rpe) ?? "var(--accent)" }
            : undefined
        }
      >
        {rpe != null ? rpe : "RPE"}
      </button>

      {/* Hidden keyboard primer — see openEditor. Off-screen + non-interactive,
          focused only programmatically to keep the soft keyboard up on mobile. */}
      <input
        ref={warmupRef}
        tabIndex={-1}
        aria-hidden="true"
        inputMode="decimal"
        className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0"
        style={{ fontSize: 16 }}
      />

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

      <RpeSheet
        open={rpeOpen}
        value={rpe}
        onChoose={chooseRpe}
        onClose={() => setRpeOpen(false)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={data.completed ? "Mark set incomplete" : "Complete set"}
        title={
          weight && reps
            ? `est 1RM ${Math.round(estimate1RM(Number(weight), Number(reps)))} ${unit}`
            : undefined
        }
        className={`ms-auto shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded-[var(--radius-sm)] border border-[var(--border)] text-lg font-bold ${
          data.completed
            ? "bg-[var(--success)] text-[#06231a]"
            : "bg-[var(--surface-2)] text-[var(--text)]"
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={async () => {
          await api(`/api/set-logs/${data.id}`, { method: "DELETE" });
          queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
        }}
        aria-label="Delete set"
        className="shrink-0 min-h-11 w-7 bg-transparent border-none text-lg text-[var(--text-muted)]"
      >
        ×
      </button>
    </div>
  );
}
