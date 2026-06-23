"use client";

import Link from "next/link";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";

interface SessionRow {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDuration(start: number, end: number): string {
  const min = Math.round((end - start) / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function HistoryPage() {
  // finished sessions only, newest first
  const { results: sessions } = useQuery<SessionRow>((c) =>
    c.query("sessions").Where("endedAt", "isDefined", true).Order("startedAt", "DESC"),
  );

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">History</h1>

        {sessions.length === 0 && (
          <p className="text-[var(--text-muted)]">No finished workouts yet.</p>
        )}

        <ul className="list-none p-0 m-0">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/history/${s.id}`}
                className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg py-3 px-4 mb-2 text-[var(--text)] no-underline"
              >
                <div className="flex-1">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">{fmtDate(s.startedAt)}</div>
                </div>
                {s.endedAt && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {fmtDuration(s.startedAt, s.endedAt)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Nav />
    </div>
  );
}
