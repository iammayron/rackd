"use client";

import * as React from "react";

export type SegmentedOption = string | { value: string; label: React.ReactNode };

export interface SegmentedControlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: SegmentedOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** @default "md" */
  size?: "sm" | "md";
}

/**
 * Segmented control — the kg/lb unit toggle and similar 2–3 option switches.
 * Selected segment rides a coral pill; the track is surface-2.
 */
export function SegmentedControl({ options, value, onChange, size = "md", style, ...rest }: SegmentedControlProps) {
  const h = size === "sm" ? 36 : 44;
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        padding: 4,
        gap: 4,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...rest}
    >
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(v)}
            style={{
              height: h - 8,
              padding: "0 16px",
              minWidth: 44,
              border: "none",
              borderRadius: "calc(var(--radius) - 4px)",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              color: active ? "var(--text-on-accent)" : "var(--text-muted)",
              background: active ? "var(--accent)" : "transparent",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              transition: "background var(--dur) var(--ease-out), color var(--dur) var(--ease-out)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
