"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { useExerciseDetail } from "@/features/exercise/exercise-detail-store";
import { bestPrsByExercise, type PRRowLite, type ExerciseLite } from "@/features/prs/bestPrs";

const TOP_LIMIT = 3;

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Progress-page "Personal records" summary — the user's most recent best lifts.
 * Tapping a row opens the exercise-detail sheet; "View all" leads to the full
 * searchable PR page. Ranking is shared with that page via {@link bestPrsByExercise}.
 */
export function PersonalRecordsCard() {
  const { unit, display } = useUnit();
  const openExercise = useExerciseDetail((s) => s.open);

  const { data: prs = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<PRRowLite[]>("/api/personal-records"),
  });
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseLite[]>("/api/exercises"),
  });

  const top = useMemo(
    () => bestPrsByExercise(prs, exercises, Date.now()).slice(0, TOP_LIMIT),
    [prs, exercises],
  );

  if (top.length === 0) return null;

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Personal records
        </h2>
        <Link href="/prs" className="text-sm font-semibold text-[var(--accent)] no-underline">
          View all
        </Link>
      </div>

      <ul className="list-none p-0 m-0 flex flex-col">
        {top.map((p) => (
          <li
            key={p.exerciseId}
            className="border-b border-[var(--border)] last:border-b-0"
          >
            <button
              type="button"
              onClick={() => openExercise(p.exerciseId)}
              className="flex w-full items-center gap-3 py-3 text-left text-[var(--text)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{p.name}</span>
                  {p.fresh && (
                    <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-white">
                      PR
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">{fmtDate(p.achievedAt)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-extrabold tabular-nums">
                  {display(p.value)} {unit}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {p.type === "1rm" ? "est 1RM" : "top weight"}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
