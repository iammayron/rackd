"use client";

import { useMemo, useState } from "react";
import { suggestReplacements } from "@rackd/core";
import { useQuery } from "@/lib/use-query";
import { ExerciseThumb } from "@/components/ExerciseMedia";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  thumbnailUrl?: string;
}

/**
 * "Replace" trigger that opens a full-screen modal with two parts: a list of
 * locally-computed suggestions (same primaryMuscle and/or equipment) and a
 * search box over the full library. Picking a replacement closes the modal and
 * calls onReplace(newExerciseId). Single-pick (unlike AddExercisePicker).
 */
export function ReplaceExercisePicker({
  currentExerciseId,
  onReplace,
}: {
  currentExerciseId: string;
  onReplace: (exerciseId: string) => void;
}) {
  const { results: exercises } = useQuery<ExerciseRow>((c) =>
    c.query("exercises").Order("name", "ASC"),
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const current = exercises.find((e) => e.id === currentExerciseId);

  const suggestions = useMemo(
    () => (current ? suggestReplacements(exercises, current) : []),
    [exercises, current],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return exercises.filter(
      (e) =>
        e.id !== currentExerciseId &&
        (e.name.toLowerCase().includes(q) ||
          e.primaryMuscle.toLowerCase().includes(q) ||
          e.equipment.toLowerCase().includes(q)),
    );
  }, [exercises, search, currentExerciseId]);

  function close() {
    setOpen(false);
    setSearch("");
  }

  function pick(id: string) {
    onReplace(id);
    close();
  }

  function Row({ ex }: { ex: ExerciseRow }) {
    return (
      <li>
        <button
          type="button"
          onClick={() => pick(ex.id)}
          className="w-full text-left flex items-center gap-3 min-h-12 py-2 px-3 mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
        >
          <ExerciseThumb ex={ex} size={40} />
          <span className="font-semibold">{ex.name}</span>
          <span className="ms-auto text-sm text-[var(--text-muted)]">
            {ex.primaryMuscle} · {ex.equipment}
          </span>
        </button>
      </li>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-9 px-3 rounded-lg bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-sm font-semibold"
      >
        ⇄ Replace
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
          <header className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the library…"
              className="flex-1 min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={close}
              className="min-h-11 px-4 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg font-semibold"
            >
              Cancel
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            {search.trim() ? (
              <>
                <p className="text-sm font-semibold text-[var(--text-muted)] mb-2">
                  {matches.length ? "Search results" : "No matches"}
                </p>
                {matches.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">
                    Nothing in the library matches “{search.trim()}”.
                  </p>
                ) : (
                  <ul className="list-none p-0 m-0">
                    {matches.map((ex) => (
                      <Row key={ex.id} ex={ex} />
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--text-muted)] mb-2">
                  Suggested
                </p>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">
                    No similar exercises — search the full library above.
                  </p>
                ) : (
                  <ul className="list-none p-0 m-0">
                    {suggestions.map((ex) => (
                      <Row key={ex.id} ex={ex} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
