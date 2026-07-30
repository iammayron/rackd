"use client";

import { Fragment, useMemo } from "react";
import { dayIndex } from "@/lib/day";
import {
  programDayKinds,
  programWeekProgress,
  rotationBlockProgress,
  sessionCountsForProgram,
  workoutsSinceLayoff,
} from "@rackd/core";

interface ProgramLike {
  id?: string;
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
  programId?: string | null;
  startedAt: number;
  endedAt?: number | null;
}

/**
 * The active program's progress card body. With a `blockWeeks` length set it
 * renders a segmented bar, a divider dot between segments that turns to 🔥 once
 * that segment is complete. What a segment *is* differs by mode, because the two
 * schedules mean different things:
 *
 *  - **weekly**: days are pinned to weekdays, so a segment is a calendar week of
 *    7 notches. A completed workout or a rest day fills one; a skipped workout
 *    leaves a gap.
 *  - **rotation**: the calendar is irrelevant, so a segment is one full pass
 *    through the rotation and a notch is a workout. Rest slots aren't counted —
 *    in a rotation a rest is a position you pass through, not something you
 *    complete. Progress only moves when you train, and it restarts with the
 *    rotation after a layoff.
 *
 * Programs with no block length fall back to the simple "Day X of N" bar.
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
    () => new Set(programDays.map((d) => d.routineId).filter((id): id is string => Boolean(id))),
    [programDays],
  );

  // Count a session toward this program by its durable programId stamp (set at
  // start, survives routine forks/re-points), falling back to the routine match
  // for legacy sessions. Pure logic lives in @rackd/core, unit-tested there.
  const belongsToProgram = useMemo(
    () => (s: SessionLike) => sessionCountsForProgram(s, program.id, programRoutineIds),
    [program.id, programRoutineIds],
  );

  // --- Week-block bar (blockWeeks set) -------------------------------------
  const week = useMemo(() => {
    if (blockWeeks <= 0) return null;
    const programSessions = finished.filter(belongsToProgram);
    const mode = program.scheduleMode ?? "rotation";

    if (mode === "rotation") {
      // A rotation ignores the calendar, so its block is measured in workouts,
      // one segment per full pass through the rotation. `activatedAt` bounds the
      // block so re-activating doesn't inherit the previous one's workouts, and
      // `workoutsSinceLayoff` drops everything before the last long gap — the
      // rotation restarts at day 1 after a layoff, so the block restarts with it
      // rather than crediting workouts from before a month off.
      const cycleWorkouts = programDays.filter((d) => d.routineId).length;
      if (cycleWorkouts === 0) return null;
      const blockStart = program.activatedAt ?? 0;
      const completedWorkouts = workoutsSinceLayoff(
        programSessions
          .filter((s) => s.endedAt != null && s.endedAt >= blockStart)
          .map((s) => dayIndex(s.endedAt!)),
        dayIndex(Date.now()),
      );
      const progress = rotationBlockProgress({
        blockWeeks,
        cycleWorkouts,
        completedWorkouts,
      });
      return {
        blockWeeks: progress.blockWeeks,
        currentWeek: progress.currentWeek,
        filledDays: progress.completedWorkouts,
        totalDays: progress.totalWorkouts,
        weekFill: progress.weekFill,
        weekDone: progress.weekDone,
        unit: "workouts" as const,
      };
    }

    // Weekly mode really is calendar-based — days are pinned to weekdays — so
    // the bar anchors on activation and classifies each elapsed calendar day.
    const now = Date.now();
    // Anchor day 1: program activation, falling back to the first logged
    // workout, then today, so pre-existing programs still render sensibly.
    const anchorMs =
      program.activatedAt ??
      (programSessions.length ? Math.min(...programSessions.map((s) => s.startedAt)) : now);
    const anchorDay = dayIndex(anchorMs);
    const todayOffset = dayIndex(now) - anchorDay;

    // Day offsets (since the anchor) carrying a completed program workout.
    const completedOffsets = programSessions
      .filter((s) => s.endedAt != null)
      .map((s) => dayIndex(s.endedAt!) - anchorDay);

    const dayKinds = programDayKinds({
      blockWeeks,
      anchorWeekday: new Date(anchorMs).getDay(),
      todayOffset,
      completedOffsets,
      schedule: {
        workoutWeekdays: programDays
          .filter((d) => d.routineId && d.weekday != null)
          .map((d) => d.weekday!),
      },
    });

    const progress = programWeekProgress(blockWeeks, dayKinds);
    const currentWeek = Math.min(Math.max(Math.floor(todayOffset / 7) + 1, 1), blockWeeks);
    return { ...progress, currentWeek, unit: "days" as const };
  }, [blockWeeks, finished, program, programDays, belongsToProgram]);

  // --- Legacy rotation bar (no block length) -------------------------------
  const legacy = useMemo(() => {
    if (blockWeeks > 0) return null;
    const blockLen = programDays.length;
    if (blockLen === 0) return null;
    const done = finished.filter(belongsToProgram).length;
    const doneInCycle = done % blockLen;
    return {
      blockLen,
      done,
      doneInCycle,
      pct: Math.round((doneInCycle / blockLen) * 100),
    };
  }, [blockWeeks, finished, programDays, belongsToProgram]);

  if (week) {
    return (
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[var(--text-muted)] tabular-nums">
          <span>
            Week {week.currentWeek} of {week.blockWeeks}
          </span>
          <span>
            {week.filledDays} of {week.totalDays} {week.unit}
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
                  <span className="shrink-0 text-[11px] leading-none" aria-hidden="true">
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
