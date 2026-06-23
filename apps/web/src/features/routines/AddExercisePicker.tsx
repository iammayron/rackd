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
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[52px] w-full rounded-2xl bg-[var(--accent)] text-white border-none text-lg font-bold hover:bg-[var(--accent-press)]"
      >
        + Add exercise
      </button>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3">
      <div className="flex gap-2 mb-2">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="flex-1 min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] rounded-lg"
        >
          Done
        </button>
      </div>
      <ul className="list-none p-0 m-0 max-h-[280px] overflow-y-auto">
        {filtered.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => onPick(ex.id)}
              className="w-full text-left flex gap-2 min-h-11 py-2 px-3 bg-transparent text-[var(--text)] border-none border-b border-[var(--border)]"
            >
              <span className="font-semibold">{ex.name}</span>
              <span className="ms-auto text-sm text-[var(--text-muted)]">{ex.primaryMuscle}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
