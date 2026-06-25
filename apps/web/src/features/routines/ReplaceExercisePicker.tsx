"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/lib/use-query";
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
 * "Replace" trigger that opens a bottom sheet listing the library, split into
 * two groups: "Similar" (same primaryMuscle as the current exercise) and "All
 * exercises" (the rest). A live, case-insensitive name search filters both
 * groups. Picking a replacement closes the sheet and calls onReplace(newId).
 * Single-pick (unlike AddExercisePicker).
 */
export function ReplaceExercisePicker({
  currentExerciseId,
  onReplace,
  /** Controlled open state. When provided, the component renders no built-in trigger. */
  open: openProp,
  onOpenChange,
}: {
  currentExerciseId: string;
  onReplace: (exerciseId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { results: exercises } = useQuery<ExerciseRow>((c) =>
    c.query("exercises").Order("name", "ASC"),
  );
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!controlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [search, setSearch] = useState("");

  const current = exercises.find((e) => e.id === currentExerciseId);

  const { similar, all } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchName = (e: ExerciseRow) => !q || e.name.toLowerCase().includes(q);
    const isSimilar = (e: ExerciseRow) =>
      !!current && e.id !== currentExerciseId && e.primaryMuscle === current.primaryMuscle;
    return {
      similar: exercises.filter((e) => isSimilar(e) && matchName(e)),
      all: exercises.filter(
        (e) => e.id !== currentExerciseId && !isSimilar(e) && matchName(e),
      ),
    };
  }, [exercises, search, current, currentExerciseId]);

  function close() {
    setOpen(false);
    setSearch("");
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
          onClick={() => pick(ex.id)}
          aria-label={`Replace with ${ex.name}`}
          className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <ExerciseThumb ex={ex} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block font-bold truncate">{ex.name}</span>
            <span className="block text-sm text-[var(--text-muted)] truncate">
              {subtitle}
            </span>
          </span>
          <span className="ms-2 shrink-0 text-sm font-semibold text-[var(--accent)]">
            Swap
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
          className="min-h-9 px-3 rounded-lg bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-sm font-semibold"
        >
          ⇄ Replace
        </button>
      )}

      <BottomSheet open={open} onClose={close}>
        <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 bg-[var(--bg)]">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 text-[17px] font-extrabold">Replace exercise</h2>
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
              <span className="font-semibold text-[var(--text)]">{current.name}</span>
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
            className="mt-3 w-full min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        {similar.length === 0 && all.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4">
            {search.trim()
              ? `Nothing in the library matches “${search.trim()}”.`
              : "No exercises in the library yet."}
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
    </>
  );
}
