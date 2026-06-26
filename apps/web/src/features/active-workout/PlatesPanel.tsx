"use client";

import { useState } from "react";
import { plateBreakdown, warmupSets } from "@rackd/core";
import { useUnit } from "@/lib/units-store";

const PLATE_COLOR: Record<number, string> = {
  // kg
  25: "#e2483d",
  20: "#3a63da",
  15: "#f5b301",
  10: "#36d399",
  5: "#f4f6f8",
  2.5: "#9aa3af",
  1.25: "#6b7280",
  // lb
  45: "#3a63da",
  35: "#f5b301",
};

const BARS = { kg: 20, lb: 45 } as const;
const PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
} as const;
const STEP = { kg: 2.5, lb: 5 } as const;

function PlateChips({ value, unit }: { value: number; unit: "kg" | "lb" }) {
  const { perSide, leftover } = plateBreakdown(value, BARS[unit], [...PLATES[unit]]);
  if (perSide.length === 0) {
    return <span className="text-sm text-[var(--text-muted)]">bar only</span>;
  }
  return (
    <span className="inline-flex gap-1 flex-wrap items-center">
      {perSide.map((p, i) => (
        <span
          key={i}
          title={`${p} ${unit}`}
          className="rounded px-1.5 py-px text-sm font-bold"
          style={{ background: PLATE_COLOR[p] ?? "var(--surface-2)", color: p === 5 ? "#06231a" : "#fff" }}
        >
          {p}
        </span>
      ))}
      {leftover > 0 && <span className="text-sm text-[var(--warning)]">+{leftover}?</span>}
      <span className="text-sm text-[var(--text-muted)]">/side</span>
    </span>
  );
}

/**
 * Plate breakdown + warmup ramp for an exercise's top working weight.
 * `topWeight` is canonical kg; rendered in the user's unit with unit-correct
 * bars/plates. Read-only (KISS) — shows what to load, doesn't mutate sets.
 */
export function PlatesPanel({ topWeight }: { topWeight: number }) {
  const { unit, display } = useUnit();
  const [open, setOpen] = useState(false);
  const top = display(topWeight, unit === "kg" ? 1 : 0);
  const warmups = warmupSets(top, BARS[unit], STEP[unit]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="min-h-9 w-full bg-transparent text-sm font-semibold text-[var(--text-muted)] text-start"
      >
        {open ? "▾" : "▸"} Plates &amp; warmup{top > 0 ? ` · ${top} ${unit}` : ""}
      </button>

      {open && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3">
          {top <= 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Enter a working weight to see plates.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold">
                  Working {top} {unit}
                </span>
                <PlateChips value={top} unit={unit} />
              </div>
              {warmups.length > 0 && (
                <div>
                  <div className="text-sm text-[var(--text-muted)] mb-1">Warmup ramp</div>
                  {warmups.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 py-0.5">
                      <span className="w-[90px]">
                        {w.weight} {unit} × {w.reps}
                      </span>
                      <PlateChips value={w.weight} unit={unit} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
