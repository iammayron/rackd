"use client";

import { Fragment, useMemo } from "react";
import { programDayKinds, programWeekProgress } from "@rackd/core";

interface ProgramLike {
  scheduleMode?: "rotation" | "weekly";
  rotationCursor?: number;
  blockWeeks?: number;
  activatedAt?: number;
}

interface ProgramDayLike {
  order: number;
  routineId?: string;
  weekday?: number;
}

interface SessionLike {
  routineId?: string | null;
  startedAt: number;
  endedAt?: number | null;
}

const DAY_MS = 86_400_000;

/** Local-midnight day index for an epoch ms — consecutive days differ by 1. */
export function dayIndex(ms: number): number {
  return Math.floor(new Date(ms).setHours(0, 0, 0, 0) / DAY_MS);
}

/**
 * The active program's progress card body. With a `blockWeeks` length set it
 * renders a week-segmented bar (one segment per week, a divider dot between
 * weeks that turns to 🔥 once that week's 7 day-notches are filled). Each
 * completed workout and each rest day fills a notch; a scheduled workout you
 * skipped leaves a gap. Programs with no block length fall back to the simple
 * "Day X of N" rotation bar.
 */
export function ProgramProgress({
  program,
  programDays,
  finished,
}: {
  program: ProgramLike;
  programDays: ProgramDayLike[];
  finished: SessionLike[];
}) {
  const blockWeeks = program.blockWeeks ?? 0;

  const programRoutineIds = useMemo(
    () =>
      new Set(
        programDays
          .map((d) => d.routineId)
          .filter((id): id is string => Boolean(id)),
      ),
    [programDays],
  );

  // --- Week-block bar (blockWeeks set) -------------------------------------
  const week = useMemo(() => {
    if (blockWeeks <= 0) return null;
    const now = Date.now();
    // Anchor day 1: program activation, falling back to the first logged
    // workout, then today, so pre-existing programs still render sensibly.
    const programSessions = finished.filter(
      (s) => s.routineId && programRoutineIds.has(s.routineId),
    );
    const anchorMs =
      program.activatedAt ??
      (programSessions.length
        ? Math.min(...programSessions.map((s) => s.startedAt))
        : now);
    const anchorDay = dayIndex(anchorMs);
    const todayOffset = dayIndex(now) - anchorDay;

    // Day offsets (since the anchor) carrying a completed program workout.
    const completedOffsets = programSessions
      .filter((s) => s.endedAt != null)
      .map((s) => dayIndex(s.endedAt!) - anchorDay);

    // Reduce the schedule to "which days are rest" for the core classifier.
    const mode = program.scheduleMode ?? "rotation";
    const schedule =
      mode === "weekly"
        ? {
            mode: "weekly" as const,
            workoutWeekdays: programDays
              .filter((d) => d.routineId && d.weekday != null)
              .map((d) => d.weekday!),
          }
        : {
            mode: "rotation" as const,
            restByOrder: [...programDays]
              .sort((a, b) => a.order - b.order)
              .map((d) => !d.routineId),
          };

    const dayKinds = programDayKinds({
      blockWeeks,
      anchorWeekday: new Date(anchorMs).getDay(),
      todayOffset,
      completedOffsets,
      schedule,
    });

    const progress = programWeekProgress(blockWeeks, dayKinds);
    const currentWeek = Math.min(
      Math.max(Math.floor(todayOffset / 7) + 1, 1),
      blockWeeks,
    );
    return { ...progress, currentWeek };
  }, [blockWeeks, finished, program, programDays, programRoutineIds]);

  // --- Legacy rotation bar (no block length) -------------------------------
  const legacy = useMemo(() => {
    if (blockWeeks > 0) return null;
    const blockLen = programDays.length;
    if (blockLen === 0) return null;
    const done = finished.filter(
      (s) => s.routineId && programRoutineIds.has(s.routineId),
    ).length;
    const doneInCycle = done % blockLen;
    return {
      blockLen,
      done,
      doneInCycle,
      pct: Math.round((doneInCycle / blockLen) * 100),
    };
  }, [blockWeeks, finished, programDays, programRoutineIds]);

  if (week) {
    return (
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[var(--text-muted)] tabular-nums">
          <span>
            Week {week.currentWeek} of {week.blockWeeks}
          </span>
          <span>
            {week.filledDays} of {week.totalDays} days
          </span>
        </div>
        <div
          className="flex items-center gap-1"
          role="progressbar"
          aria-valuenow={week.filledDays}
          aria-valuemin={0}
          aria-valuemax={week.totalDays}
          aria-label="Progress through program block"
        >
          {week.weekFill.map((f, w) => (
            <Fragment key={w}>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                  style={{ width: `${Math.round(f * 100)}%` }}
                />
              </div>
              {w < week.weekFill.length - 1 &&
                (week.weekDone[w] ? (
                  <span
                    className="shrink-0 text-[11px] leading-none"
                    aria-hidden="true"
                  >
                    🔥
                  </span>
                ) : (
                  <span
                    className="block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]/40"
                    aria-hidden="true"
                  />
                ))}
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  if (legacy) {
    return (
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[var(--text-muted)] tabular-nums">
          <span>
            Day {legacy.doneInCycle + 1} of {legacy.blockLen}
          </span>
          <span>
            {legacy.done} {legacy.done === 1 ? "workout" : "workouts"} done
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={legacy.doneInCycle}
          aria-valuemin={0}
          aria-valuemax={legacy.blockLen}
          aria-label="Progress through current block"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${legacy.pct}%` }}
          />
        </div>
      </div>
    );
  }

  return null;
}
