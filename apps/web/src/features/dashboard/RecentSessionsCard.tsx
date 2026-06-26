"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";

interface SessionRow {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
}

interface PersonalRecordRow {
  sessionId: string;
}

const RECENT_LIMIT = 3;

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Dashboard "Recent sessions" card — the last few finished workouts, each
 * flagged with how many PRs it set. "View all" leads to the Progress page.
 * The streak moved to {@link ThisWeekCard}; this card is purely the log.
 */
export function RecentSessionsCard() {
  const { data: sessions = [] } = useQuery({
    queryKey: qk.sessions,
    queryFn: () => api<SessionRow[]>("/api/sessions"),
  });
  const { data: records = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<PersonalRecordRow[]>("/api/personal-records"),
  });

  // PRs per session — each personal record carries the session that set it.
  const prCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      counts.set(r.sessionId, (counts.get(r.sessionId) ?? 0) + 1);
    }
    return counts;
  }, [records]);

  const recent = useMemo(
    () => sessions.slice(0, RECENT_LIMIT),
    [sessions],
  );

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Recent sessions
        </h2>
        {sessions.length > 0 && (
          <Link
            href="/history"
            className="text-sm font-semibold text-[var(--accent)] no-underline"
          >
            View all
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          No finished workouts yet — your streak starts here.
        </p>
      ) : (
        <ul className="list-none p-0 m-0">
          {recent.map((s) => {
            const prs = prCounts.get(s.id) ?? 0;
            return (
              <li key={s.id}>
                <Link
                  href={`/history/${s.id}`}
                  className="flex items-center gap-3 py-2 text-[var(--text)] no-underline"
                >
                  <span className="truncate font-semibold">{s.name}</span>
                  {prs > 0 && (
                    <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                      {prs} PR
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-sm text-[var(--text-muted)]">
                    {fmtDate(s.startedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
