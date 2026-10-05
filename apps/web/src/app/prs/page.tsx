"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Input } from "@rackd/ui";
import { useQuery } from "@tanstack/react-query";
import { useUnit } from "@/lib/units-store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { BackButton } from "@/components/BackButton";
import { useExerciseDetail } from "@/features/exercise/exercise-detail-store";
import { bestPrsByExercise, type PRRowLite, type ExerciseLite } from "@/features/prs/bestPrs";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PRsPage() {
  const router = useRouter();
  const { unit, display } = useUnit();
  const openExercise = useExerciseDetail((s) => s.open);
  const [search, setSearch] = useState("");

  // Owner-scoped server-side; newest first (the API orders by achievedAt desc).
  const { data: prs = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<PRRowLite[]>("/api/personal-records"),
  });
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseLite[]>("/api/exercises"),
  });

  const rows = useMemo(() => bestPrsByExercise(prs, exercises, Date.now()), [prs, exercises]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.muscle.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const hasAny = rows.length > 0;

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-3 py-3.5 px-5 bg-[var(--bg)] border-b border-[var(--border)]">
        <BackButton onClick={() => router.back()} />
        <h1 className="m-0 text-lg font-bold">Personal records</h1>
      </header>

      <main className="flex-1 px-5 pt-3 pb-24">
        {hasAny && (
          <div className="mb-3.5">
            <Input
              placeholder="Search exercises…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {!hasAny ? (
          <p className="text-center text-[var(--text-muted)] text-sm pt-12">
            No PRs yet — your first one’s coming.
          </p>
        ) : list.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] text-sm pt-8">
            No records match “{search}”.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {list.map((p) => {
              const is1rm = p.type === "1rm";
              return (
                <button
                  key={p.exerciseId}
                  type="button"
                  onClick={() => openExercise(p.exerciseId)}
                  className="block w-full text-left text-[var(--text)]"
                >
                  <Card padding={16}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-[var(--text)] whitespace-nowrap">
                            {p.name}
                          </span>
                          {p.fresh && (
                            <Badge tone="accent" solid>
                              PR
                            </Badge>
                          )}
                        </div>
                        <div className="text-[13px] text-[var(--text-muted)] mt-0.5">
                          {cap(p.muscle)} · {fmtDate(p.achievedAt)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-lg tabular-nums whitespace-nowrap text-[var(--text)]">
                          {display(p.value)} {unit}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                          {is1rm ? "est 1RM" : "top weight"}
                        </div>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
