"use client";

import { create } from "zustand";
import { fromKg, toKg as coreToKg, type Unit } from "@myfit/core";

const KEY = "myfit.unit";

interface UnitState {
  unit: Unit;
  setUnit: (u: Unit) => void;
}

export const useUnitStore = create<UnitState>((set) => ({
  unit: "kg",
  setUnit: (u) => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, u);
    set({ unit: u });
  },
}));

/** Load persisted unit on the client (call once at startup). */
export function hydrateUnit() {
  if (typeof window === "undefined") return;
  const u = window.localStorage.getItem(KEY);
  if (u === "kg" || u === "lb") useUnitStore.setState({ unit: u });
}

function round(n: number, decimals = 1): number {
  return Number(n.toFixed(decimals));
}

/**
 * Single conversion edge (DRY). Storage is always canonical kg; this converts
 * to/from the user's display unit. `display` returns a number for input values;
 * `fmt` returns a labelled string.
 */
export function useUnit() {
  const unit = useUnitStore((s) => s.unit);
  return {
    unit,
    /** kg → display unit (number). */
    display: (kg: number, decimals = 1) => round(fromKg(kg, unit), decimals),
    /** entered display-unit value → canonical kg. */
    toKg: (value: number) => coreToKg(value, unit),
    /** kg → "x kg" / "y lb". */
    fmt: (kg: number, decimals = 1) => `${round(fromKg(kg, unit), decimals)} ${unit}`,
  };
}
