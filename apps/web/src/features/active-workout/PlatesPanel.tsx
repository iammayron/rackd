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
    return <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>bar only</span>;
  }
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {perSide.map((p, i) => (
        <span
          key={i}
          title={`${p} kg`}
          style={{
            background: PLATE_COLOR[p] ?? "var(--surface-2)",
            color: p === 5 ? "#06231a" : "#fff",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
          }}
        >
          {p}
        </span>
      ))}
      {leftover > 0 && (
        <span style={{ color: "var(--warning)", fontSize: "var(--text-sm)" }}>+{leftover}?</span>
      )}
      <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>/side</span>
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
    <div style={{ marginTop: "var(--space-2)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          minHeight: 36,
          width: "100%",
          background: "transparent",
          color: "var(--text-muted)",
          border: "none",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        {open ? "▾" : "▸"} Plates &amp; warmup{topWeight > 0 ? ` · ${topWeight} kg` : ""}
      </button>

      {open && (
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "var(--space-3)",
          }}
        >
          {topWeight <= 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
              Enter a working weight to see plates.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                <span style={{ fontWeight: 700 }}>Working {topWeight} kg</span>
                <PlateChips weight={topWeight} />
              </div>
              {warmups.length > 0 && (
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: 4 }}>
                    Warmup ramp
                  </div>
                  {warmups.map((w, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "2px 0" }}
                    >
                      <span style={{ width: 90 }}>
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
