"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Workout" },
  { href: "/routines", label: "Routines" },
  { href: "/history", label: "History" },
  { href: "/stats", label: "Stats" },
];

/** Bottom tab bar — thumb-zone navigation across the main sections. */
export function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 flex border-t border-[var(--border)] bg-[var(--bg)]">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex-1 text-center py-3 min-h-11 text-sm no-underline ${
              active ? "text-[var(--accent)] font-bold" : "text-[var(--text-muted)] font-medium"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
