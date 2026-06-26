"use client";

import { create } from "zustand";

/**
 * Open state for the global exercise-detail sheet. Any list (PRs, similar
 * exercises, …) calls `open(id)` to slide the detail up; the single
 * `<ExerciseDetailSheet />` mounted in the app shell renders it. Keeping this in
 * a tiny store (not prop-drilled context) lets deep, unrelated lists trigger it.
 */
interface ExerciseDetailState {
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useExerciseDetail = create<ExerciseDetailState>((set) => ({
  openId: null,
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
}));
