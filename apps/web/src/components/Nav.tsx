"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 4-tab IA: Home / Plans / Exercises / Progress. Settings lives behind the
// dashboard header avatar, not the tab bar. Plans is the hub for programs +
// routines + templates; Exercises is the standalone library (browse + detail);
// Progress is the hub for history + PRs/weight.
const items = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  {
    href: "/programs",
    label: "Plans",
    match: (p: string) => p.startsWith("/programs") || p.startsWith("/routines"),
  },
  { href: "/exercises", label: "Exercises", match: (p: string) => p.startsWith("/exercise") },
  { href: "/history", label: "Progress", match: (p: string) => p.startsWith("/history") },
];

/** Bottom tab bar — thumb-zone navigation. Mirrors the @rackd/ui TabBar visual
 *  (active = coral pill on accent-wash) but stays Link-based for App Router. */
export function Nav() {
  const path = usePathname();
  return (
    <nav
      className="sticky bottom-0 flex gap-1 border-t border-[var(--border)] bg-[var(--bg)] px-2.5 pt-2.5"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      {items.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex-1 min-h-14 flex items-center justify-center rounded-[var(--radius)] text-center text-[13px] no-underline transition-colors ${
              active
                ? "bg-[var(--accent-wash)] text-[var(--accent)] font-bold"
                : "text-[var(--text-muted)] font-medium"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
