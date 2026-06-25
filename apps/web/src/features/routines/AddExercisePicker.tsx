"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { ExerciseThumb } from "@/components/ExerciseMedia";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  thumbnailUrl?: string;
}

/**
 * "+ Add exercise" trigger that opens a full-screen modal with search.
 * Stays open after a pick (multi-add) and flashes the chosen row; calls
 * onPick(exerciseId) each time. Used by the routine editor and active workout.
 */
export function AddExercisePicker({ onPick }: { onPick: (exerciseId: string) => void }) {
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseRow[]>("/api/exercises"),
    select: (rows) => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.primaryMuscle.includes(q),
    );
  }, [exercises, search]);

  function pick(id: string) {
    onPick(id);
    setAdded(id);
    setTimeout(() => setAdded((cur) => (cur === id ? null : cur)), 600);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[52px] w-full rounded-2xl bg-[var(--accent)] text-white border-none text-lg font-bold hover:bg-[var(--accent-press)]"
      >
        + Add exercise
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
          <header className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises…"
              className="flex-1 min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearch("");
              }}
              className="min-h-11 px-4 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg font-semibold"
            >
              Done
            </button>
          </header>

          <ul className="list-none p-4 m-0 flex-1 overflow-y-auto">
            {filtered.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => pick(ex.id)}
                  className={`w-full text-left flex items-center gap-3 min-h-12 py-2 px-3 mb-2 rounded-lg border border-[var(--border)] ${
                    added === ex.id ? "bg-[var(--success)] text-[#06231a]" : "bg-[var(--surface)] text-[var(--text)]"
                  }`}
                >
                  <ExerciseThumb ex={ex} size={40} />
                  <span className="font-semibold">{ex.name}</span>
                  <span className="ms-auto text-sm text-[var(--text-muted)]">
                    {added === ex.id ? "added ✓" : `${ex.primaryMuscle} · ${ex.equipment}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
