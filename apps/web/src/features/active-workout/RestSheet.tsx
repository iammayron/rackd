"use client";

import { useEffect, useRef, useState } from "react";
import { mmss } from "@rackd/ui";
import { BottomSheet } from "@/components/BottomSheet";

const STEP = 15;

/** Seconds → right-anchored digit string for the mask (e.g. 90 → "130", 45 → "45"). */
function secToDigits(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}${String(s).padStart(2, "0")}` : String(s);
}

/** Digit string → "M:SS" (last 2 digits are seconds, the rest are minutes). */
function formatDigits(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(-4);
  if (!d) return "0:00";
  const padded = d.padStart(3, "0");
  return `${Number(padded.slice(0, -2))}:${padded.slice(-2)}`;
}

/** Digit string → total seconds. A typed seconds field > 59 rolls into minutes. */
function digitsToSec(digits: string): number {
  const d = digits.replace(/\D/g, "").slice(-4);
  if (!d) return 0;
  const padded = d.padStart(3, "0");
  return Number(padded.slice(0, -2)) * 60 + Number(padded.slice(-2));
}

/**
 * Slide-up rest-time editor inside the reusable {@link BottomSheet}: a
 * [−15][m:ss][+15] stepper plus tap-to-type with an M:SS mask. Holds its own
 * optimistic value so steps/typing land instantly (the caller's `onChange`
 * persists async — re-reading the prop would lag a network round-trip).
 */
export function RestSheet({
  open,
  restSec,
  onChange,
  onClose,
}: {
  open: boolean;
  restSec: number;
  onChange: (sec: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(restSec);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reseed from the prop each time the sheet opens; while open we own the value.
  useEffect(() => {
    if (open) {
      setValue(restSec);
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(next: number) {
    const v = Math.max(0, Math.round(next));
    setValue(v);
    onChange(v);
    return v;
  }

  /** Current value, folding in an in-progress edit so steppers compose with typing. */
  function base(): number {
    return editing ? digitsToSec(draft) : value;
  }

  function nudge(dir: 1 | -1) {
    const v = commit(base() + dir * STEP);
    setEditing(false);
    return v;
  }

  function startEdit() {
    setDraft(secToDigits(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function commitEdit() {
    commit(digitsToSec(draft));
    setEditing(false);
  }

  const atZero = base() <= 0;

  return (
    <BottomSheet open={open} onClose={onClose} title="Rest for this exercise">
      <div className="flex flex-col gap-4 pt-1 pb-1">
        <div className="flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label={`Decrease rest by ${STEP} seconds`}
            disabled={atZero}
            className="h-16 w-16 shrink-0 inline-flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] select-none disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:bg-[var(--surface)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-semibold leading-none tabular-nums text-[var(--text-muted)]">
              {STEP}s
            </span>
          </button>

          <div className="flex flex-1 min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)]">
            {editing ? (
              <input
                ref={inputRef}
                inputMode="numeric"
                value={formatDigits(draft)}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(-4))}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  }
                }}
                aria-label="Rest time (minutes and seconds)"
                className="w-full bg-transparent text-center text-4xl font-bold tabular-nums text-[var(--text)] focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={startEdit}
                aria-label="Edit rest time"
                className="w-full py-4 text-4xl font-bold tabular-nums text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-md)]"
              >
                <span aria-live="polite">{mmss(value * 1000)}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label={`Increase rest by ${STEP} seconds`}
            className="h-16 w-16 shrink-0 inline-flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] select-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:bg-[var(--surface)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="5"
                x2="12"
                y2="19"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-semibold leading-none tabular-nums text-[var(--text-muted)]">
              {STEP}s
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (editing) commitEdit();
            onClose();
          }}
          className="w-full min-h-12 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--text-on-accent)] text-base font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  );
}
