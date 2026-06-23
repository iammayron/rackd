"use client";

import { useState } from "react";
import { plateBreakdown, warmupSets } from "@fitnow/core";

const PLATE_COLOR: Record<number, string> = {
  25: "#e2483d",
  20: "#3a63da",
  15: "#f5b301",
  10: "#36d399",
  5: "#f4f6f8",
  2.5: "#9aa3af",
  1.25: "#6b7280",
};

function PlateChips({ weight }: { weight: number }) {
  const { perSide, leftover } = plateBreakdown(weight);
  if (perSide.length === 0) {
    return <span className="text-sm text-[var(--text-muted)]">bar only</span>;
  }
  return (
    <span className="inline-flex gap-1 flex-wrap items-center">
      {perSide.map((p, i) => (
        <span
          key={i}
          title={`${p} kg`}
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
 * Read-only helper (KISS) — shows what to load, doesn't mutate sets.
 */
export function PlatesPanel({ topWeight }: { topWeight: number }) {
  const [open, setOpen] = useState(false);
  const warmups = warmupSets(topWeight);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="min-h-9 w-full bg-transparent text-sm font-semibold text-[var(--text-muted)] text-start"
      >
        {open ? "▾" : "▸"} Plates &amp; warmup{topWeight > 0 ? ` · ${topWeight} kg` : ""}
      </button>

      {open && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3">
          {topWeight <= 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Enter a working weight to see plates.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold">Working {topWeight} kg</span>
                <PlateChips weight={topWeight} />
              </div>
              {warmups.length > 0 && (
                <div>
                  <div className="text-sm text-[var(--text-muted)] mb-1">Warmup ramp</div>
                  {warmups.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 py-0.5">
                      <span className="w-[90px]">
                        {w.weight} kg × {w.reps}
                      </span>
                      <PlateChips weight={w.weight} />
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
