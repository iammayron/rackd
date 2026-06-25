"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { mmss } from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
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
  const { data: active } = useQuery({
    queryKey: qk.activeSession,
    queryFn: () => api<ActiveSessionRow | null>("/api/sessions/active"),
  });

  const status = useTimerStore((s) => s.state.status);
  // subscribe to `now` so the countdown re-renders each tick
  useTimerStore((s) => s.now);
  const remaining = useTimerStore((s) => s.remaining());
  const fired = useTimerStore((s) => s.fired);

  if (!active) return null;
  if (pathname?.startsWith("/workout/")) return null;

  const resting = status !== "idle";
  // Eyebrow above the name: live rest state when resting, else a steady label.
  const statusText = resting
    ? fired
      ? "Rest over"
      : `Resting · ${mmss(remaining)}`
    : "Workout in progress";

  return (
    <Link
      href={`/workout/${active.id}`}
      aria-label={`Resume ${active.name}`}
      // Accent fill (matches the "Today's workout" card + Start buttons) so the
      // active workout reads as the loudest thing on screen, not a faint bar.
      className="fixed left-1/2 -translate-x-1/2 z-30 bottom-[calc(64px+var(--safe-bottom))] w-[min(440px,calc(100%_-_24px_-_var(--safe-left)_-_var(--safe-right)))] flex items-center gap-3 px-4 py-3 rounded-2xl no-underline text-white bg-[var(--accent)] shadow-[var(--shadow-lg)]"
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${fired ? "bg-[var(--success)]" : "bg-white"}`}
      />
      <span className="min-w-0 flex-1 flex flex-col leading-tight">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/75 tabular-nums">
          {statusText}
        </span>
        <span className="font-extrabold truncate">{active.name}</span>
      </span>
      <span className="shrink-0 inline-flex items-center h-9 px-3.5 rounded-full bg-white text-[var(--accent)] text-sm font-extrabold">
        Resume ›
      </span>
    </Link>
  );
}
