"use client";

import { useState } from "react";
import { estimate1RM } from "@fitnow/core";
import { updateSet, deleteSet } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useUnit } from "@/lib/units-store";
import { useTimerStore } from "./timer-store";

export interface SetRowData {
  id: string;
  order: number;
  weight: number;
  reps: number;
  completed: boolean;
}

const CELL =
  "w-16 text-center bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md text-lg p-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

/**
 * One set row: weight, reps, complete toggle. Completing a set starts the
 * global rest timer (the core interaction of the whole app).
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
    <div className={`flex items-center gap-3 py-2 ${data.completed ? "opacity-70" : ""}`}>
      <span className="w-6 font-semibold text-[var(--text-muted)]">{data.order}</span>
      <span className="w-[88px] text-sm text-[var(--text-muted)]">{prevLabel ?? "—"}</span>
      <input
        className={CELL}
        inputMode="decimal"
        placeholder={unit}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        aria-label={`Set ${data.order} weight`}
      />
      <input
        className={CELL}
        inputMode="numeric"
        placeholder="reps"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        aria-label={`Set ${data.order} reps`}
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
        className={`ms-auto inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg border border-[var(--border)] text-lg font-bold ${
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
        className="min-h-11 w-8 bg-transparent border-none text-lg text-[var(--text-muted)]"
      >
        ×
      </button>
    </div>
  );
}
