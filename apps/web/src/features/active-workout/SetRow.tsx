"use client";

import { useState } from "react";
import { estimate1RM } from "@fitnow/core";
import { updateSet, deleteSet } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useTimerStore } from "./timer-store";

export interface SetRowData {
  id: string;
  order: number;
  weight: number;
  reps: number;
  completed: boolean;
}

const cell: React.CSSProperties = {
  width: 64,
  textAlign: "center",
  background: "var(--surface-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--text-lg)",
  padding: "var(--space-2)",
};

/**
 * One set row: weight, reps, complete toggle. Completing a set starts the
 * global rest timer (the core interaction of the whole app).
 */
export function SetRow({
  data,
  restSec,
  prevLabel,
}: {
  data: SetRowData;
  restSec: number;
  prevLabel?: string;
}) {
  const startTimer = useTimerStore((s) => s.start);
  const [weight, setWeight] = useState(String(data.weight || ""));
  const [reps, setReps] = useState(String(data.reps || ""));

  async function toggle() {
    const client = getClient();
    const next = !data.completed;
    await updateSet(client, data.id, {
      weight: Number(weight) || 0,
      reps: Number(reps) || 0,
      completed: next,
    });
    if (next) startTimer(restSec);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) 0",
        opacity: data.completed ? 0.7 : 1,
      }}
    >
      <span style={{ width: 24, color: "var(--text-muted)", fontWeight: 600 }}>
        {data.order}
      </span>
      <span style={{ width: 88, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
        {prevLabel ?? "—"}
      </span>
      <input
        style={cell}
        inputMode="decimal"
        placeholder="kg"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        aria-label={`Set ${data.order} weight`}
      />
      <input
        style={cell}
        inputMode="numeric"
        placeholder="reps"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        aria-label={`Set ${data.order} reps`}
      />
      <button
        onClick={toggle}
        aria-label={data.completed ? "Mark set incomplete" : "Complete set"}
        title={
          weight && reps
            ? `est 1RM ${Math.round(estimate1RM(Number(weight), Number(reps)))} kg`
            : undefined
        }
        style={{
          minHeight: "var(--tap-min)",
          minWidth: "var(--tap-min)",
          marginLeft: "auto",
          background: data.completed ? "var(--success)" : "var(--surface-2)",
          color: data.completed ? "#06231a" : "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          fontSize: "var(--text-lg)",
          fontWeight: 700,
        }}
      >
        ✓
      </button>
      <button
        onClick={() => deleteSet(getClient(), data.id)}
        aria-label="Delete set"
        style={{
          minHeight: "var(--tap-min)",
          width: 32,
          background: "transparent",
          color: "var(--text-muted)",
          border: "none",
          fontSize: "var(--text-lg)",
        }}
      >
        ×
      </button>
    </div>
  );
}
