"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { fromKg, toKg as coreToKg, type Unit, type UserProfile } from "@rackd/core";
import { api } from "./api";
import { qk } from "./query";

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

/**
 * Seed the display unit from the durable server profile on first load. The
 * Zustand default ("kg") and localStorage are only offline-first placeholders;
 * the account's `unitPreference` is the cross-device source of truth, so without
 * this the home screen renders kg until Settings is opened. Applied once per
 * mount so a refetch never clobbers an unsaved Settings toggle.
 */
export function useSyncUnitFromProfile() {
  const { data } = useQuery({
    queryKey: qk.profile,
    queryFn: () => api<UserProfile>("/api/profile"),
  });
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !data) return;
    applied.current = true;
    useUnitStore.getState().setUnit(data.unitPreference === "imperial" ? "lb" : "kg");
  }, [data]);
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
