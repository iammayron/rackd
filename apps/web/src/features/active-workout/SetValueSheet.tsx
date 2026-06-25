"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Shared slide-up editor for a single numeric set value (weight OR reps),
 * parameterized so one component serves both. Renders inside the reusable
 * {@link BottomSheet}: a big [−][input][＋] cluster plus Done.
 *
 * Works in DISPLAY units (the caller converts to canonical kg on commit). The
 * field is a real input (type directly); −/＋ step it. Opening or focusing the
 * field selects all, since users usually type a fresh value. Any dismissal
 * (Done / backdrop / Escape / drag-down) commits the final value.
 */
export function SetValueSheet({
  open,
  title,
  initial,
  step,
  min = 0,
  integer = false,
  suffix,
  inputMode,
  onClose,
  onCommit,
}: {
  open: boolean;
  title: string;
  /** Current value in display units, used to seed the field on open. */
  initial: number;
  /** Amount the −/＋ buttons add or subtract. */
  step: number;
  min?: number;
  /** Reps are integers; weight is decimal. Controls rounding + keypad. */
  integer?: boolean;
  /** Unit label shown after the value (e.g. "kg" / "lb"); omit for reps. */
  suffix?: string;
  inputMode: "decimal" | "numeric";
  onClose: () => void;
  /** Final value in display units, called once on confirm/close. */
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Latest values mirrored into refs so the stable commit callback (below) can
  // read them without changing identity — and so seeding reads the value as of
  // the moment the sheet opened, never re-seeding mid-typing.
  const textRef = useRef(text);
  textRef.current = text;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Seed the field + focus and select-all — ONCE per open. Depending only on
  // `open` means typing (which updates `text`) can never re-run this and
  // re-select, and a query echo changing `initial` can't clobber what's typed.
  useEffect(() => {
    if (!open) return;
    setText(initialRef.current ? String(initialRef.current) : "");
    // Focus synchronously: a deferred focus (rAF/timeout) lands outside the tap
    // that opened the sheet, so mobile browsers focus the field but never raise
    // the keyboard. SetRow's warm-up input keeps the keyboard up across the
    // mount; this just hands focus to the real field. Select-all is deferred a
    // frame so the seeded value (set above, not yet painted) is what highlights.
    inputRef.current?.focus({ preventScroll: true });
    const id = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(id);
  }, [open]);

  function clamp(v: number): number {
    if (!Number.isFinite(v)) return min;
    return Math.max(min, integer ? Math.round(v) : round2(v));
  }
  function nudge(dir: 1 | -1) {
    setText(String(clamp(clamp(Number(text)) + dir * step)));
  }
  // Stable identity (only `min`/`integer` matter, both constant per field) so
  // BottomSheet's `[open, onClose]` focus effect doesn't re-fire on every
  // keystroke and steal focus back into a select-all loop.
  const commitAndClose = useCallback(() => {
    onCommitRef.current(clamp(Number(textRef.current)));
    onCloseRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, integer]);

  return (
    <BottomSheet open={open} onClose={commitAndClose} title={title}>
      <div className="flex flex-col gap-4 pt-1 pb-1">
        <div className="flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label={`Decrease ${title}`}
            className="h-16 w-16 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-3xl leading-none font-bold select-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:bg-[var(--surface)]"
          >
            −
          </button>

          <div className="flex flex-1 min-w-0 items-center justify-center gap-1 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <input
              ref={inputRef}
              inputMode={inputMode}
              enterKeyHint="done"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                // Keyboard's Done/checkmark (or Enter) commits, like the button.
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAndClose();
                }
              }}
              aria-label={title}
              className="min-w-0 w-full text-center bg-transparent text-[var(--text)] text-4xl font-bold tabular-nums py-3 focus:outline-none"
            />
            {suffix && (
              <span className="shrink-0 text-lg text-[var(--text-muted)]">
                {suffix}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label={`Increase ${title}`}
            className="h-16 w-16 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-3xl leading-none font-bold select-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:bg-[var(--surface)]"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={commitAndClose}
          className="w-full min-h-12 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--text-on-accent)] text-base font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  );
}
