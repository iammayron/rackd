"use client";

import { create } from "zustand";
import {
  idleTimer,
  startTimer,
  addTime,
  remainingMs,
  isFired,
  type TimerState,
} from "@myfit/core";

/**
 * Global rest timer — one instance for the whole app, survives navigation.
 * Wall-clock based (core FSM); a single interval ticks `now` for re-renders.
 * On fire: vibrate + a notification. (Service-worker scheduled notification
 * for true background firing is a Phase 2 hardening step.)
 */
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

function fireEffects() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Rest over", { body: "Time for your next set." });
  }
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  state: idleTimer(),
  now: 0,
  fired: false,

  start: (durationSec) => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const now = Date.now();
    set({ state: startTimer(durationSec, now), now, fired: false });

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      const now = Date.now();
      const { state, fired } = get();
      if (!fired && isFired(state, now)) {
        fireEffects();
        set({ now, fired: true });
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        return;
      }
      set({ now });
    }, 250);
  },

  add: (deltaSec) => set((s) => ({ state: addTime(s.state, deltaSec) })),

  skip: () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    set({ state: idleTimer(), fired: false });
  },

  remaining: () => {
    const { state, now } = get();
    return remainingMs(state, now);
  },
}));
