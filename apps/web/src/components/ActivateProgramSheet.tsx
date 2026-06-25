"use client";

import { BottomSheet } from "@/components/BottomSheet";

export interface ProgramChoice {
  id: string;
  name: string;
  /** Optional one-line meta (e.g. schedule mode, day count). */
  meta?: string;
}

/**
 * Bottom-sheet picker for choosing which program to activate. Shared by the Home
 * "no active program" prompt (Rule 1) and the editor's delete-active flow
 * (Rule 3). Selecting a row calls `onSelect` and closes; dismissing leaves the
 * current selection untouched.
 */
export function ActivateProgramSheet({
  open,
  onClose,
  programs,
  activeId,
  onSelect,
  title = "Activate a program",
}: {
  open: boolean;
  onClose: () => void;
  programs: ProgramChoice[];
  activeId?: string;
  onSelect: (programId: string) => void;
  title?: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {programs.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-[var(--text-muted)]">
          No programs to activate.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {programs.map((p) => {
            const selected = p.id === activeId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-pressed={selected}
                  className={`rk-squircle-corners flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3.5 text-left ${
                    selected
                      ? "border-transparent bg-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <span className="min-w-0">
                    <span
                      className="block truncate font-bold"
                      style={{ color: selected ? "var(--text-on-accent)" : "var(--text)" }}
                    >
                      {p.name}
                    </span>
                    {p.meta && (
                      <span
                        className="block truncate text-sm"
                        style={
                          selected
                            ? { color: "var(--text-on-accent)", opacity: 0.85 }
                            : { color: "var(--text-muted)" }
                        }
                      >
                        {p.meta}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <span
                      className="shrink-0 text-sm font-bold"
                      style={{ color: "var(--text-on-accent)" }}
                    >
                      Active
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
