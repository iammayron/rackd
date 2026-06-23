"use client";

import * as React from "react";

export type TabItem = string | { key?: string; label: React.ReactNode };

export interface TabBarProps extends Omit<React.HTMLAttributes<HTMLElement>, "onSelect"> {
  items?: TabItem[];
  /** Key of the active tab. */
  active?: string;
  onSelect?: (key: string) => void;
}

/**
 * Bottom tab bar — thumb-zone navigation across the main sections. Active tab
 * rides coral + bold. Sits sticky at the bottom; clears the home indicator.
 */
export function TabBar({ items = [], active, onSelect, style, ...rest }: TabBarProps) {
  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        borderTop: "1px solid var(--border)",
        background: "var(--bg)",
        gap: 4,
        padding: "10px 10px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...rest}
    >
      {items.map((it) => {
        const key = typeof it === "string" ? it : (it.key ?? String(it.label));
        const label = typeof it === "string" ? it : it.label;
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            style={{
              flex: 1,
              minHeight: 56,
              padding: "10px 6px",
              borderRadius: 14,
              border: "none",
              background: isActive ? "var(--accent-wash)" : "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              letterSpacing: "0.01em",
              lineHeight: 1,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              transition: "color var(--dur) var(--ease-out), background var(--dur) var(--ease-out)",
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
