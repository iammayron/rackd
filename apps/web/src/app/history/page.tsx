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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <main style={{ flex: 1, padding: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
          History
        </h1>

        {sessions.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>No finished workouts yet.</p>
        )}

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/history/${s.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "var(--space-3) var(--space-4)",
                  marginBottom: "var(--space-2)",
                  color: "var(--text)",
                  textDecoration: "none",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                    {fmtDate(s.startedAt)}
                  </div>
                </div>
                {s.endedAt && (
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
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
