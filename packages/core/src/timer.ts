/**
 * Rest timer as a wall-clock finite state machine (platform-agnostic).
 * Tick-counting drifts when a PWA tab sleeps — so we store an absolute
 * `endAt` and recompute remaining on demand. Platform layer schedules the
 * service-worker notification + vibration for `endAt`.
 */

export type TimerStatus = "idle" | "running" | "paused" | "fired";

export interface TimerState {
  status: TimerStatus;
  /** Configured duration, ms. */
  durationMs: number;
  /** Absolute fire time (epoch ms) while running. */
  endAt?: number;
  /** Remaining captured at pause, ms. */
  pausedRemainingMs?: number;
}

export function idleTimer(): TimerState {
  return { status: "idle", durationMs: 0 };
}

export function startTimer(durationSec: number, now: number): TimerState {
  const durationMs = durationSec * 1000;
  return { status: "running", durationMs, endAt: now + durationMs };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "running" || state.endAt === undefined) return state;
  return {
    ...state,
    status: "paused",
    pausedRemainingMs: Math.max(0, state.endAt - now),
  };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "paused" || state.pausedRemainingMs === undefined) return state;
  return {
    ...state,
    status: "running",
    endAt: now + state.pausedRemainingMs,
    pausedRemainingMs: undefined,
  };
}

export function addTime(state: TimerState, deltaSec: number): TimerState {
  const deltaMs = deltaSec * 1000;
  if (state.status === "running" && state.endAt !== undefined) {
    return { ...state, endAt: state.endAt + deltaMs };
  }
  if (state.status === "paused" && state.pausedRemainingMs !== undefined) {
    return {
      ...state,
      pausedRemainingMs: Math.max(0, state.pausedRemainingMs + deltaMs),
    };
  }
  return state;
}

/** Remaining ms right now. Also flips to `fired` when it hits zero. */
export function remainingMs(state: TimerState, now: number): number {
  if (state.status === "paused") return state.pausedRemainingMs ?? 0;
  if (state.status === "running" && state.endAt !== undefined) {
    return Math.max(0, state.endAt - now);
  }
  return 0;
}

export function isFired(state: TimerState, now: number): boolean {
  return state.status === "running" && remainingMs(state, now) <= 0;
}
