"use client";

import { mmss } from "@rackd/ui";
import { BottomSheet } from "@/components/BottomSheet";

const STEP = 15;

/**
 * Slide-up rest-time editor rendered inside the reusable {@link BottomSheet}: a
 * [−][m:ss][+] stepper (15s steps, min 0). Pure UI — persistence stays with the
 * caller's `onChange`, which fires on every step so the chip stays live.
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
  function nudge(dir: 1 | -1) {
    onChange(Math.max(0, restSec + dir * STEP));
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Rest for this exercise">
      <div className="flex flex-col gap-4 pt-1 pb-1">
        <div className="flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Decrease rest"
            disabled={restSec <= 0}
            className="h-16 w-16 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-3xl leading-none font-bold select-none disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:bg-[var(--surface)]"
          >
            −
          </button>

          <div className="flex flex-1 min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)]">
            <span className="text-4xl font-bold tabular-nums text-[var(--text)]" aria-live="polite">
              {mmss(restSec * 1000)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Increase rest"
            className="h-16 w-16 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-3xl leading-none font-bold select-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:bg-[var(--surface)]"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-12 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--text-on-accent)] text-base font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  );
}
