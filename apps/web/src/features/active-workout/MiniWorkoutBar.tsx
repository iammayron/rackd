"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mmss } from "@rackd/ui";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { useTimerStore } from "./timer-store";

interface ActiveSessionRow {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
}

/**
 * Persistent "a workout is running" bar. Leaving the live workout screen
 * (without finishing) minimizes it — the session stays in-progress locally —
 * and this bar surfaces on the other tabs with live rest state + a resume link.
 * Renders nothing when no session is in progress or when already on /workout.
 */
export function MiniWorkoutBar() {
  const pathname = usePathname();
  const { results } = useQuery<ActiveSessionRow>((c) =>
    c
      .query("sessions")
      .Where("ownerId", "=", getCurrentUserId())
      .Where("endedAt", "isDefined", false)
      .Order("startedAt", "DESC"),
  );
  const active = results[0];

  const status = useTimerStore((s) => s.state.status);
  // subscribe to `now` so the countdown re-renders each tick
  useTimerStore((s) => s.now);
  const remaining = useTimerStore((s) => s.remaining());
  const fired = useTimerStore((s) => s.fired);

  if (!active) return null;
  if (pathname?.startsWith("/workout/")) return null;

  const resting = status !== "idle";
  const statusText = resting ? (fired ? "Rest over" : mmss(remaining)) : "In progress";

  return (
    <Link
      href={`/workout/${active.id}`}
      className="fixed left-1/2 -translate-x-1/2 z-30 bottom-[calc(64px+var(--safe-bottom))] w-[min(440px,calc(100%-24px))] flex items-center gap-3 px-4 py-3 rounded-2xl no-underline text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-lg)]"
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${fired ? "bg-[var(--success)]" : "bg-[var(--accent)]"}`}
      />
      <span className="font-bold truncate">{active.name}</span>
      <span className="ms-auto text-sm font-semibold tabular-nums text-[var(--text-muted)]">
        {statusText}
      </span>
      <span className="text-sm font-bold text-[var(--accent)]">Resume ›</span>
    </Link>
  );
}
