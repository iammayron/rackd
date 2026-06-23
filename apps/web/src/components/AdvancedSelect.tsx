"use client";

import { useEffect, useRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

type PrelineWindow = Window & {
  HSStaticMethods?: { autoInit: (collection?: string | string[]) => void };
};

/**
 * React wrapper around Preline's advanced select (data-hs-select).
 *
 * Preline 4 exposes only `window.HSStaticMethods` (not `HSSelect`), so we
 * enhance via `autoInit("select")` once the options have rendered. Preline
 * mirrors the choice onto the underlying native <select> and dispatches a
 * native `change`, which our onChange picks up — no Preline instance needed.
 */
export function AdvancedSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  const optKey = options.map((o) => o.value).join("|");

  useEffect(() => {
    if (!ref.current || options.length === 0) return;
    let cancelled = false;
    (async () => {
      await import("preline");
      if (cancelled) return;
      requestAnimationFrame(() => {
        (window as PrelineWindow).HSStaticMethods?.autoInit("select");
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optKey]);

  const config = {
    placeholder,
    toggleTag: '<button type="button" aria-expanded="false"></button>',
    toggleClasses:
      "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-[var(--surface)] border border-[var(--border)] rounded-lg text-start text-base text-[var(--text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]",
    dropdownClasses:
      "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden overflow-y-auto",
    optionClasses:
      "py-2 px-4 w-full text-base text-[var(--text)] cursor-pointer hover:bg-[var(--surface-2)] rounded-lg focus:outline-hidden focus:bg-[var(--surface-2)]",
    optionTemplate:
      '<div class="flex justify-between items-center w-full"><span data-title></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-4 text-[var(--accent)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  };

  return (
    <select
      ref={ref}
      data-hs-select={JSON.stringify(config)}
      defaultValue={value}
      onChange={(e) => onChange(e.target.value)}
      className="hidden"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
