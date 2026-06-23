"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Workout" },
  { href: "/routines", label: "Routines" },
  { href: "/history", label: "History" },
];

/** Bottom tab bar — thumb-zone navigation across the main sections. */
export function Nav() {
  const path = usePathname();
  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        borderTop: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "var(--space-3) 0",
              minHeight: "var(--tap-min)",
              color: active ? "var(--accent)" : "var(--text-muted)",
              fontWeight: active ? 700 : 500,
              fontSize: "var(--text-sm)",
              textDecoration: "none",
            }}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
