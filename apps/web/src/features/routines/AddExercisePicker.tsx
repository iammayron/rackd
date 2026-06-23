"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/lib/use-query";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
}

/** Inline searchable list to add an exercise. Calls onPick with the id. */
export function AddExercisePicker({ onPick }: { onPick: (exerciseId: string) => void }) {
  const { results: exercises } = useQuery<ExerciseRow>((c) =>
    c.query("exercises").Order("name", "ASC"),
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.primaryMuscle.includes(q),
    );
  }, [exercises, search]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          minHeight: 52,
          width: "100%",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-lg)",
          fontSize: "var(--text-lg)",
          fontWeight: 700,
        }}
      >
        + Add exercise
      </button>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-3)",
      }}
    >
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            flex: 1,
            minHeight: "var(--tap-min)",
            padding: "0 var(--space-3)",
            background: "var(--surface-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}
        />
        <button
          onClick={() => setOpen(false)}
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 var(--space-3)",
            background: "var(--surface-2)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          Done
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 280, overflowY: "auto" }}>
        {filtered.map((ex) => (
          <li key={ex.id}>
            <button
              onClick={() => onPick(ex.id)}
              style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                gap: "var(--space-2)",
                minHeight: "var(--tap-min)",
                padding: "var(--space-2) var(--space-3)",
                background: "transparent",
                color: "var(--text)",
                border: "none",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontWeight: 600 }}>{ex.name}</span>
              <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                {ex.primaryMuscle}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
