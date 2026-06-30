"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import { ExerciseFilters } from "@/components/ExerciseFilters";
import { ExerciseDetailPreview } from "@/features/exercise/ExerciseDetailPreview";
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
 * "+ Add exercise" trigger that opens a bottom sheet with search + muscle and
 * equipment filters. Multi-add: stays open after a pick and flashes the chosen
 * row, calling onPick(exerciseId) each time. Exercises already in the
 * routine/workout (`existingIds`) are hidden, not listed. Tapping a row's
 * thumbnail opens the full {@link ExerciseDetailPreview}. (Sibling of
 * {@link ReplaceExercisePicker}, which is single-pick.)
 */
export function AddExercisePicker({
  onPick,
  existingIds = [],
}: {
  onPick: (exerciseId: string) => void;
  /** Exercise ids already in the routine/workout — hidden from the list. */
  existingIds?: string[];
}) {
  const existing = useMemo(() => new Set(existingIds), [existingIds]);
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseRow[]>("/api/exercises"),
    select: (rows) => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        !existing.has(e.id) &&
        (!muscle || e.primaryMuscle === muscle) &&
        (!equipment || e.equipment === equipment) &&
        (!q || e.name.toLowerCase().includes(q) || e.primaryMuscle.includes(q)),
    );
  }, [exercises, search, muscle, equipment, existing]);

  const previewName = previewId
    ? exercises.find((e) => e.id === previewId)?.name
    : undefined;

  function close() {
    setOpen(false);
    setSearch("");
    setMuscle(null);
    setEquipment(null);
    setPreviewId(null);
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

      <BottomSheet
        open={open}
        onClose={close}
        header={
          <>
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

            <ExerciseFilters
              exercises={exercises}
              muscle={muscle}
              equipment={equipment}
              onMuscle={setMuscle}
              onEquipment={setEquipment}
            />
          </>
        }
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4">
            {search.trim() || muscle || equipment
              ? "Nothing in the library matches those filters."
              : "Every library exercise is already in this list."}
          </p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {filtered.map((ex) => {
              const on = added === ex.id;
              const subtitle = ex.equipment
                ? `${cap(ex.primaryMuscle)} · ${cap(ex.equipment)}`
                : cap(ex.primaryMuscle);
              return (
                <li
                  key={ex.id}
                  className={`flex items-center gap-3 p-3 rounded-[var(--radius)] border ${
                    on
                      ? "bg-[var(--success)] text-[#06231a] border-[var(--success)]"
                      : "bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                  }`}
                >
                  <ExerciseThumb ex={ex} size={44} onClick={() => setPreviewId(ex.id)} />
                  <button
                    type="button"
                    onClick={() => pick(ex.id)}
                    aria-label={`Add ${ex.name}`}
                    className="min-w-0 flex-1 flex items-center text-left gap-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-[var(--radius-sm)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold truncate">{ex.name}</span>
                      <span
                        className={`block text-sm truncate ${on ? "text-[#06231a]" : "text-[var(--text-muted)]"}`}
                      >
                        {subtitle}
                      </span>
                    </span>
                    <span
                      className={`ms-2 shrink-0 text-sm font-semibold ${
                        on ? "text-[#06231a]" : "text-[var(--accent)]"
                      }`}
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

      {previewId && (
        <ExerciseDetailPreview
          id={previewId}
          onClose={() => setPreviewId(null)}
          onSelectExercise={setPreviewId}
          action={{
            label: previewName ? `Add ${previewName}` : "Add",
            onClick: () => {
              pick(previewId);
              setPreviewId(null);
            },
          }}
        />
      )}
    </>
  );
}
