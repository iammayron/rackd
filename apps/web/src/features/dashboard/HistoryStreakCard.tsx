"use client";

import { useMemo } from "react";
import Link from "next/link";
import { currentStreak } from "@rackd/core";
import { useQuery } from "@/lib/use-query";

interface SessionRow {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
}

const DAY_MS = 86_400_000;

/** Local-midnight day index for an epoch ms — consecutive days differ by 1. */
function dayIndex(ms: number): number {
  return Math.floor(new Date(ms).setHours(0, 0, 0, 0) / DAY_MS);
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Dashboard card: recent completed workouts + current day streak. */
export function HistoryStreakCard() {
  const { results: sessions } = useQuery<SessionRow>((c) =>
    c.query("sessions").Where("endedAt", "isDefined", true).Order("startedAt", "DESC"),
  );

  const streak = useMemo(
    () => currentStreak(sessions.map((s) => dayIndex(s.startedAt)), dayIndex(Date.now())),
    [sessions],
  );
  const recent = useMemo(() => sessions.slice(0, 5), [sessions]);

  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          History
        </h2>
        {sessions.length > 0 && (
          <Link href="/history" className="text-sm font-semibold text-[var(--accent)] no-underline">
            View all
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-[var(--text-muted)]">No finished workouts yet — your streak starts here.</p>
      ) : (
        <>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--accent)]">{streak}</span>
            <span className="text-[var(--text-muted)]">
              day{streak === 1 ? "" : "s"} streak {streak > 0 ? "🔥" : ""}
            </span>
          </div>

          <ul className="list-none p-0 m-0">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/history/${s.id}`}
                  className="flex items-center gap-3 py-2 text-[var(--text)] no-underline"
                >
                  <span className="flex-1 truncate font-semibold">{s.name}</span>
                  <span className="text-sm text-[var(--text-muted)]">{fmtDate(s.startedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
