"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import { BottomSheet } from "@/components/BottomSheet";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  thumbnailUrl?: string;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * "+ Add exercise" trigger that opens a bottom sheet with search. Multi-add:
 * stays open after a pick and flashes the chosen row, calling onPick(exerciseId)
 * each time. Used by the routine editor and active workout. (Sibling of
 * {@link ReplaceExercisePicker}, which is single-pick.) Renders inside the
 * shared {@link BottomSheet} so it sits above the keyboard and clears the
 * status-bar safe area instead of taking over the whole screen.
 */
export function AddExercisePicker({
  onPick,
}: {
  onPick: (exerciseId: string) => void;
}) {
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

  function close() {
    setOpen(false);
    setSearch("");
  }

  function pick(id: string) {
    onPick(id);
    setAdded(id);
    setTimeout(() => setAdded((cur) => (cur === id ? null : cur)), 600);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        onClick={() => setOpen(true)}
        style={{
          background: "var(--surface-2)",
          color: "var(--accent)",
          borderStyle: "dashed",
        }}
      >
        + Add exercise
      </Button>

      <BottomSheet open={open} onClose={close}>
        {/* Sticky header (title + close + search) so the list scrolls under it. */}
        <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 bg-[var(--bg)]">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 text-[17px] font-extrabold">Add exercise</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Done"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              ✕
            </button>
          </div>

          <label className="sr-only" htmlFor="add-search">
            Search the library
          </label>
          <input
            id="add-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="mt-3 w-full min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4">
            {search.trim()
              ? `Nothing in the library matches “${search.trim()}”.`
              : "No exercises in the library yet."}
          </p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {filtered.map((ex) => {
              const on = added === ex.id;
              const subtitle = ex.equipment
                ? `${cap(ex.primaryMuscle)} · ${cap(ex.equipment)}`
                : cap(ex.primaryMuscle);
              return (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => pick(ex.id)}
                    aria-label={`Add ${ex.name}`}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-[var(--radius)] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                      on
                        ? "bg-[var(--success)] text-[#06231a] border-[var(--success)]"
                        : "bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                    }`}
                  >
                    <ExerciseThumb ex={ex} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold truncate">
                        {ex.name}
                      </span>
                      <span
                        className={`block text-sm truncate ${on ? "text-[#06231a]" : "text-[var(--text-muted)]"}`}
                      >
                        {subtitle}
                      </span>
                    </span>
                    <span
                      className={`ms-2 shrink-0 text-sm font-semibold ${on ? "text-[#06231a]" : "text-[var(--accent)]"}`}
                    >
                      {on ? "Added ✓" : "Add"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
