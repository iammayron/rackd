"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { ExerciseDetail } from "./ExerciseDetail";

interface ExerciseHeadRow {
  name: string;
  category?: string;
}

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Full-detail exercise preview shown above a picker sheet. Renders the same rich
 * {@link ExerciseDetail} body the rest of the app uses (hero media, how-to,
 * form cues, muscle visualizer, history charts) plus a pinned primary action
 * ("Swap to…" / "Add…"). Sits at z-[110] so it clears the picker's z-[100]
 * BottomSheet. Tapping a "Similar exercise" swaps the preview in place via
 * `onSelectExercise`.
 */
export function ExerciseDetailPreview({
  id,
  onClose,
  onSelectExercise,
  action,
}: {
  id: string;
  onClose: () => void;
  onSelectExercise: (id: string) => void;
  /** Pinned primary action; `onClick` receives nothing — caller closes over `id`. */
  action: { label: string; onClick: () => void };
}) {
  const { data: ex } = useQuery({
    queryKey: qk.exercise(id),
    queryFn: () => api<ExerciseHeadRow>(`/api/exercises/${id}`),
    enabled: Boolean(id),
  });

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="rk-squircle-corners w-[min(440px,100%)] max-h-[88vh] flex flex-col overflow-hidden bg-[var(--bg)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-3 px-4 pt-4 pb-2 shrink-0">
          <h2 className="flex-1 min-w-0 truncate text-[17px] font-extrabold">
            {ex?.name ?? "Preview"}
          </h2>
          {ex?.category && (
            <span className="text-[13px] text-[var(--text-muted)]">{cap(ex.category)}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-lg text-[var(--text-muted)]"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-4 pt-2 pb-3 flex-1">
          <ExerciseDetail id={id} onSelectExercise={onSelectExercise} />
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={action.onClick}
            className="w-full min-h-11 rounded-[var(--radius)] bg-[var(--accent)] text-white font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {action.label}
          </button>
        </div>
      </div>
    </div>
  );
}
