"use client";

import { useRouter } from "next/navigation";

/**
 * The single source of truth for a page's "Back"/"Up" affordance — a 44×44
 * chevron button matching the program editor header. Pass `href` for an
 * intent-based destination (navigates with `router.replace`, since back/up
 * actions replace rather than push), or `onClick` for custom behavior such as
 * `router.back()`. Always renders the same chevron so back arrows stay
 * visually consistent system-wide.
 */
export function BackButton({
  href,
  onClick,
  ariaLabel = "Go back",
  className,
}: {
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={href ? () => router.replace(href) : onClick}
      aria-label={ariaLabel}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[var(--text)] transition-colors hover:bg-[var(--surface)]${
        className ? ` ${className}` : ""
      }`}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
