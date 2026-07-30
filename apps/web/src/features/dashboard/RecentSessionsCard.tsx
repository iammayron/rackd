"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { ShareWorkoutSheet } from "@/features/share/ShareWorkoutSheet";

interface SessionRow {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
}

interface PersonalRecordRow {
  sessionId: string;
}

interface SessionVolumeRow {
  sessionId: string;
  volume: number;
}

const RECENT_LIMIT = 4;

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * "Recent sessions" card — the last few finished workouts, each flagged with how
 * many PRs it set and its training volume. The arrow opens the share sheet for
 * that workout; "View all" leads to the Progress page.
 */
export function RecentSessionsCard({ showViewAll = true }: { showViewAll?: boolean } = {}) {
  const { unit, display } = useUnit();
  const [shareId, setShareId] = useState<string | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: qk.sessions,
    queryFn: () => api<SessionRow[]>("/api/sessions"),
  });
  const { data: records = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<PersonalRecordRow[]>("/api/personal-records"),
  });
  const { data: volumes = [] } = useQuery({
    queryKey: qk.sessionVolumes,
    queryFn: () => api<SessionVolumeRow[]>("/api/stats/session-volumes"),
  });

  // PRs per session — each personal record carries the session that set it.
  const prCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) counts.set(r.sessionId, (counts.get(r.sessionId) ?? 0) + 1);
    return counts;
  }, [records]);

  const volumeBySession = useMemo(
    () => new Map(volumes.map((v) => [v.sessionId, v.volume])),
    [volumes],
  );

  const recent = useMemo(() => sessions.slice(0, RECENT_LIMIT), [sessions]);

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Recent sessions
        </h2>
        {showViewAll && sessions.length > 0 && (
          <Link href="/history" className="text-sm font-semibold text-[var(--accent)] no-underline">
            View all
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          No finished workouts yet — your streak starts here.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col">
          {recent.map((s) => {
            const prs = prCounts.get(s.id) ?? 0;
            const vol = volumeBySession.get(s.id);
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b border-[var(--border)] py-3 last:border-b-0"
              >
                <Link
                  href={`/history/${s.id}`}
                  className="min-w-0 flex-1 text-[var(--text)] no-underline"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{s.name}</span>
                    {prs > 0 && (
                      <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                        {prs} PR
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-[var(--text-muted)]">
                    {fmtDate(s.startedAt)}
                  </div>
                </Link>

                {vol !== undefined && vol > 0 && (
                  <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums">
                      {Math.round(display(vol)).toLocaleString()}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{unit}</div>
                  </div>
                )}

                <button
                  type="button"
                  aria-label={`Share ${s.name}`}
                  onClick={() => setShareId(s.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-muted)] active:scale-95"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[18px] w-[18px]"
                    aria-hidden="true"
                  >
                    <path d="M12 15V3" />
                    <path d="m8 7 4-4 4 4" />
                    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {shareId && (
        <ShareWorkoutSheet
          sessionId={shareId}
          open={Boolean(shareId)}
          onClose={() => setShareId(null)}
        />
      )}
    </section>
  );
}
