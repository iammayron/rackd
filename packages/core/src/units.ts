import type { Unit } from "./types";

const KG_PER_LB = 0.45359237;

/** Store canonical (kg). Convert only at the display edge (DRY: one place). */
export function toKg(value: number, unit: Unit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

export function fromKg(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}

export function formatWeight(kg: number, unit: Unit, decimals = 1): string {
  const v = fromKg(kg, unit);
  const rounded = Number(v.toFixed(decimals));
  return `${rounded} ${unit}`;
}
