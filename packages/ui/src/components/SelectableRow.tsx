"use client";

import * as React from "react";

export interface SelectableRowProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "title"
> {
  title: React.ReactNode;
  /** Trailing meta (muscle · equipment). */
  meta?: React.ReactNode;
  /** @default false */
  selected?: boolean;
}

/**
 * Selectable list row — used for the exercise picker / quick-workout list.
 * Selected = coral fill. Shows a title with optional trailing meta (muscle ·
 * equipment). 44px+ tap target, full width.
 */
export function SelectableRow({
  title,
  meta,
  selected = false,
  onClick,
  style,
  ...rest
}: SelectableRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: "var(--tap-min)",
        padding: "12px 16px",
        textAlign: "left",
        fontFamily: "var(--font-sans)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        cursor: "pointer",
        background: selected ? "var(--accent)" : "var(--surface)",
        color: selected ? "var(--text-on-accent)" : "var(--text)",
        transition: "background var(--dur) var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
      {meta && <span style={{ marginLeft: "auto", fontSize: 13, opacity: 0.8 }}>{meta}</span>}
    </button>
  );
}
