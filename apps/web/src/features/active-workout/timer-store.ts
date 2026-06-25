"use client";

import { create } from "zustand";
import {
  idleTimer,
  startTimer,
  addTime,
  remainingMs,
  isFired,
  type TimerState,
} from "@rackd/core";
import {
  requestNotifyPermission,
  showLocalNotification,
  scheduleRestPush,
  rescheduleRestPush,
  cancelRestPush,
} from "@/lib/push";

/**
 * Global rest timer — one instance for the whole app, survives navigation.
 * Wall-clock based (core FSM); a single interval ticks `now` for re-renders.
 * On fire: vibrate + an (iOS-safe, SW-routed) notification, then auto-close
 * back to idle after a brief green "rest over" state. True background firing
 * (locked iPhone) needs a server-side Web Push — see lib/push.ts.
 */

/** How long the green "Rest over" state lingers before auto-dismissing. */
const FIRED_AUTOCLOSE_MS = 2000;

interface TimerStore {
  state: TimerState;
  now: number;
  fired: boolean;
  start: (durationSec: number) => void;
  add: (deltaSec: number) => void;
  skip: () => void;
  remaining: () => number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let fireTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (fireTimeoutId) {
    clearTimeout(fireTimeoutId);
    fireTimeoutId = null;
  }
}

function fireEffects() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
  void showLocalNotification("Rest over", { body: "Time for your next set." });
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  state: idleTimer(),
  now: 0,
  fired: false,

  start: (durationSec) => {
    void requestNotifyPermission();
    clearTimers();
    const now = Date.now();
    const state = startTimer(durationSec, now);
    set({ state, now, fired: false });
    // Queue a server-side push for endAt so a backgrounded/locked phone still
    // gets alerted (its JS is suspended and can't fire the local notif below).
    if (state.endAt !== undefined) void scheduleRestPush(state.endAt);

    intervalId = setInterval(() => {
      const now = Date.now();
      const { state, fired } = get();
      if (!fired && isFired(state, now)) {
        // How far past endAt this tick is. A foreground interval fires within a
        // tick (~250ms); a large lag means the app was suspended (backgrounded)
        // and is only now catching up — in which case the server Web Push has
        // ALREADY alerted, so a local notif here would be the second one.
        const lateMs = state.endAt !== undefined ? now - state.endAt : 0;
        if (lateMs <= 1000) fireEffects();
        // Cancel the server push (no-op if it already fired) to avoid a dupe.
        void cancelRestPush();
        set({ now, fired: true });
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        // Linger on the green "rest over" state, then auto-dismiss. A manual
        // skip()/start() clears this timeout, so the two never fight.
        fireTimeoutId = setTimeout(() => {
          fireTimeoutId = null;
          get().skip();
        }, FIRED_AUTOCLOSE_MS);
        return;
      }
      set({ now });
    }, 250);
  },

  add: (deltaSec) => {
    set((s) => ({ state: addTime(s.state, deltaSec) }));
    const { state } = get();
    if (state.status === "running" && state.endAt !== undefined) {
      void rescheduleRestPush(state.endAt);
    }
  },

  skip: () => {
    clearTimers();
    void cancelRestPush();
    set({ state: idleTimer(), fired: false });
  },

  remaining: () => {
    const { state, now } = get();
    return remainingMs(state, now);
  },
}));
