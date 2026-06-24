"use client";

import { useEffect, useRef, useState } from "react";
import { estimate1RM } from "@rackd/core";
import { updateSet, deleteSet } from "@rackd/db";
import { getClient } from "@/lib/triplit";
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
  "w-16 shrink-0 inline-flex items-center justify-center gap-0.5 min-h-11 text-center bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md text-lg px-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

/**
 * One set row: weight, reps, complete toggle. Completing a set starts the
 * global rest timer (the core interaction of the whole app). Weight and reps
 * are tap targets — tapping opens {@link SetValueSheet} to edit/step the value.
 */
export function SetRow({
  data,
  restSec,
  prevLabel,
  startsRest = true,
}: {
  data: SetRowData;
  restSec: number;
  prevLabel?: string;
  /** false for a supersetted exercise that isn't last in its group — go straight to the partner. */
  startsRest?: boolean;
}) {
  const startTimer = useTimerStore((s) => s.start);
  const { unit, display, toKg } = useUnit();
  const [weight, setWeight] = useState(data.weight ? String(display(data.weight)) : "");
  const [reps, setReps] = useState(String(data.reps || ""));
  const [rpe, setRpe] = useState<number | undefined>(data.rpe);
  const [rpeOpen, setRpeOpen] = useState(false);
  // Which value's editor is open (one shared sheet serves both).
  const [editing, setEditing] = useState<"weight" | "reps" | null>(null);

  // While our own write is in flight we don't overwrite local state from the
  // query — otherwise the echo (our write coming back through the subscription)
  // could clobber the value we just committed (write→subscribe loop).
  const weightWriting = useRef(false);
  const repsWriting = useRef(false);

  // Resync local state when the persisted value changes, but only when no write
  // of ours is pending. Keeps the canonical-kg → display conversion at the edge.
  useEffect(() => {
    if (!weightWriting.current) setWeight(data.weight ? String(display(data.weight)) : "");
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
      await updateSet(getClient(), data.id, { weight: value ? toKg(value) : 0 });
    } finally {
      weightWriting.current = false;
    }
  }
  async function commitReps(value: number) {
    setReps(value ? String(value) : "");
    repsWriting.current = true;
    try {
      await updateSet(getClient(), data.id, { reps: value });
    } finally {
      repsWriting.current = false;
    }
  }

  /**
   * Pick effort from the sheet. Tapping the already-selected value clears it.
   * Persists (incl. clearing — `updateSet` honours `rpe: undefined`) and closes.
   */
  async function chooseRpe(v: number | undefined) {
    const next = rpe === v ? undefined : v;
    setRpe(next);
    setRpeOpen(false);
    await updateSet(getClient(), data.id, { rpe: next });
  }

  async function toggle() {
    const client = getClient();
    const next = !data.completed;
    await updateSet(client, data.id, {
      weight: weight ? toKg(Number(weight)) : 0,
      reps: Number(reps) || 0,
      completed: next,
    });
    if (next && startsRest) startTimer(restSec);
  }

  return (
    <div className={`flex items-center gap-2 py-2 ${data.completed ? "opacity-70" : ""}`}>
      <span className="w-6 shrink-0 font-semibold text-[var(--text-muted)]">{data.order}</span>
      <span className="w-16 shrink-0 text-sm text-[var(--text-muted)] truncate">
        {prevLabel ?? "—"}
      </span>

      <button
        type="button"
        onClick={() => setEditing("weight")}
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
        onClick={() => setEditing("reps")}
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
        className={`w-12 shrink-0 inline-flex items-center justify-center min-h-11 rounded-md border font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
          rpe != null
            ? "text-[var(--text-on-accent)] border-transparent text-lg"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] text-xs"
        }`}
        style={rpe != null ? { background: rpeColor(rpe) ?? "var(--accent)" } : undefined}
      >
        {rpe != null ? rpe : "RPE"}
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
        className={`ms-auto shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg border border-[var(--border)] text-lg font-bold ${
          data.completed
            ? "bg-[var(--success)] text-[#06231a]"
            : "bg-[var(--surface-2)] text-[var(--text)]"
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={() => deleteSet(getClient(), data.id)}
        aria-label="Delete set"
        className="shrink-0 min-h-11 w-7 bg-transparent border-none text-lg text-[var(--text-muted)]"
      >
        ×
      </button>
    </div>
  );
}
