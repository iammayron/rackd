"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Input } from "@rackd/ui";
import { useQuery } from "@tanstack/react-query";
import { useUnit } from "@/lib/units-store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { BackButton } from "@/components/BackButton";

interface PRRow {
  id: string;
  exerciseId: string;
  type: string;
  value: number;
  achievedAt: number;
}
interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
}

/** Best record per exercise, derived from all of the user's personalRecords. */
interface BestPR {
  exerciseId: string;
  name: string;
  muscle: string;
  type: string;
  value: number;
  achievedAt: number;
  fresh: boolean;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Midnight on the Monday of the current week (local). */
function startOfWeek(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const sinceMon = (d.getDay() + 6) % 7; // 0=Sun → 6, 1=Mon → 0
  d.setDate(d.getDate() - sinceMon);
  return d.getTime();
}

export default function PRsPage() {
  const router = useRouter();
  const { unit, display } = useUnit();
  const [search, setSearch] = useState("");

  // Owner-scoped server-side; newest first (the API orders by achievedAt desc).
  const { data: prs = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<PRRow[]>("/api/personal-records"),
  });
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseRow[]>("/api/exercises"),
  });

  const rows = useMemo<BestPR[]>(() => {
    const exMap = new Map(exercises.map((e) => [e.id, e]));
    const weekStart = startOfWeek(Date.now());
    // One row per exercise: prefer the best estimated-1RM, else the top value.
    const best = new Map<string, BestPR>();
    for (const pr of prs) {
      const ex = exMap.get(pr.exerciseId);
      if (!ex) continue;
      const cur = best.get(pr.exerciseId);
      const prefer =
        !cur ||
        (pr.type === "1rm" && cur.type !== "1rm") ||
        (pr.type === cur.type && pr.value > cur.value);
      if (prefer) {
        best.set(pr.exerciseId, {
          exerciseId: pr.exerciseId,
          name: ex.name,
          muscle: ex.primaryMuscle,
          type: pr.type,
          value: pr.value,
          achievedAt: pr.achievedAt,
          fresh: pr.achievedAt >= weekStart,
        });
      }
    }
    return [...best.values()].sort((a, b) => b.achievedAt - a.achievedAt);
  }, [prs, exercises]);

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
                <Link
                  key={p.exerciseId}
                  href={`/exercise/${p.exerciseId}`}
                  className="block no-underline text-[var(--text)]"
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
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
