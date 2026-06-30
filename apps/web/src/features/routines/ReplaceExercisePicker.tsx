"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
 * "Replace" trigger that opens a bottom sheet listing the library, split into
 * two groups: "Similar" (same primaryMuscle as the current exercise) and "All
 * exercises" (the rest). Search + muscle/equipment filters narrow both groups.
 * Exercises already in the plan (`existingIds`, plus the current one) are
 * hidden so you can't replace with a duplicate. Tapping a row opens the full
 * {@link ExerciseDetailPreview}; its action swaps and closes. Single-pick
 * (unlike AddExercisePicker).
 */
export function ReplaceExercisePicker({
  currentExerciseId,
  onReplace,
  existingIds = [],
  /** Controlled open state. When provided, the component renders no built-in trigger. */
  open: openProp,
  onOpenChange,
}: {
  currentExerciseId: string;
  onReplace: (exerciseId: string) => void;
  /** Exercise ids already in the plan — hidden so a replacement can't duplicate. */
  existingIds?: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseRow[]>("/api/exercises"),
    select: (rows) => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
  });
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!controlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const current = exercises.find((e) => e.id === currentExerciseId);
  // The current exercise plus everything else already in the plan: none of these
  // are valid replacements (picking one would duplicate or no-op).
  const excluded = useMemo(
    () => new Set([currentExerciseId, ...existingIds]),
    [currentExerciseId, existingIds],
  );

  const { similar, all } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (e: ExerciseRow) =>
      !excluded.has(e.id) &&
      (!muscle || e.primaryMuscle === muscle) &&
      (!equipment || e.equipment === equipment) &&
      (!q || e.name.toLowerCase().includes(q));
    const isSimilar = (e: ExerciseRow) =>
      !!current && e.primaryMuscle === current.primaryMuscle;
    return {
      similar: exercises.filter((e) => matches(e) && isSimilar(e)),
      all: exercises.filter((e) => matches(e) && !isSimilar(e)),
    };
  }, [exercises, search, muscle, equipment, current, excluded]);

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
    onReplace(id);
    close();
  }

  function Row({ ex }: { ex: ExerciseRow }) {
    const subtitle = ex.equipment
      ? `${cap(ex.primaryMuscle)} · ${cap(ex.equipment)}`
      : cap(ex.primaryMuscle);
    return (
      <li>
        <button
          type="button"
          onClick={() => setPreviewId(ex.id)}
          aria-label={`Preview ${ex.name}`}
          className="w-full text-left flex items-center gap-3 p-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <ExerciseThumb ex={ex} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block font-bold truncate">{ex.name}</span>
            <span className="block text-sm text-[var(--text-muted)] truncate">
              {subtitle}
            </span>
          </span>
          <span className="ms-2 shrink-0 text-sm font-semibold text-[var(--accent)]">
            Preview ›
          </span>
        </button>
      </li>
    );
  }

  function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
      <p className="text-xs font-semibold tracking-wide text-[var(--text-muted)] mt-4 mb-2 first:mt-0">
        {children}
      </p>
    );
  }

  return (
    <>
      {!controlled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-sm font-semibold"
        >
          ⇄ Replace
        </button>
      )}

      <BottomSheet
        open={open}
        onClose={close}
        header={
          <>
            <div className="flex items-center gap-3">
              <h2 className="flex-1 text-[17px] font-extrabold">
                Replace exercise
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                ✕
              </button>
            </div>

            {current && (
              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <span>Replacing</span>
                <ExerciseThumb ex={current} size={26} />
                <span className="font-semibold text-[var(--text)]">
                  {current.name}
                </span>
              </div>
            )}

            <label className="sr-only" htmlFor="replace-search">
              Search the library
            </label>
            <input
              id="replace-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the library…"
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
        {similar.length === 0 && all.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4">
            {search.trim() || muscle || equipment
              ? "Nothing in the library matches those filters."
              : "No other exercises to swap in."}
          </p>
        ) : (
          <>
            {similar.length > 0 && current && (
              <>
                <SectionHeader>
                  SIMILAR · {current.primaryMuscle.toUpperCase()}
                </SectionHeader>
                <ul className="list-none p-0 m-0 flex flex-col gap-2">
                  {similar.map((ex) => (
                    <Row key={ex.id} ex={ex} />
                  ))}
                </ul>
              </>
            )}

            {all.length > 0 && (
              <>
                <SectionHeader>ALL EXERCISES</SectionHeader>
                <ul className="list-none p-0 m-0 flex flex-col gap-2">
                  {all.map((ex) => (
                    <Row key={ex.id} ex={ex} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </BottomSheet>

      {previewId && (
        <ExerciseDetailPreview
          id={previewId}
          onClose={() => setPreviewId(null)}
          onSelectExercise={setPreviewId}
          action={{
            label: previewName ? `Swap to ${previewName}` : "Swap",
            onClick: () => pick(previewId),
          }}
        />
      )}
    </>
  );
}
