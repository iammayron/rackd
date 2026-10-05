"use client";

import type { PointerEvent } from "react";

interface DayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
  weekday?: number;
}

/** Mon-first short labels; index follows Date.getDay() (0=Sun…6=Sat). */
const WEEKDAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * One compact program-day row: a `::` drag handle, a muted DAY/weekday label,
 * the assigned routine name (or "Rest"), and a squircle delete button. The row
 * body is the tap target that opens the assignment sheet; the grip (a sibling,
 * not nested in the body button) is the drag handle for reordering. Pointer
 * events are used so it works on iOS touch as well as mouse — `touch-action:
 * none` keeps the page from scrolling while dragging from the grip.
 */
export function ProgramDayRow({
  day,
  dayNumber,
  mode,
  routineName,
  dragging,
  onOpen,
  onRemove,
  onGripPointerDown,
  onGripPointerMove,
  onGripPointerUp,
}: {
  day: DayRow;
  dayNumber: number;
  mode: "rotation" | "weekly";
  routineName?: string;
  dragging?: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onGripPointerDown: (e: PointerEvent) => void;
  onGripPointerMove: (e: PointerEvent) => void;
  onGripPointerUp: (e: PointerEvent) => void;
}) {
  const label =
    mode === "weekly" && day.weekday != null ? WEEKDAY_ABBR[day.weekday] : `DAY ${dayNumber}`;

  return (
    <div
      data-day-id={day.id}
      className="rk-squircle-corners mb-2.5 flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
      style={{
        position: "relative",
        zIndex: dragging ? 2 : undefined,
        boxShadow: dragging ? "var(--shadow-lg)" : undefined,
        borderColor: dragging ? "var(--accent)" : undefined,
        transform: dragging ? "scale(1.01)" : undefined,
        touchAction: dragging ? "none" : undefined,
      }}
    >
      <span
        role="button"
        tabIndex={-1}
        aria-label={`Drag to reorder ${label}`}
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={onGripPointerUp}
        onPointerCancel={onGripPointerUp}
        style={{ touchAction: "none" }}
        className="flex h-11 w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center text-base leading-none tracking-tighter text-[var(--text-muted)] active:cursor-grabbing"
      >
        ::
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pe-2 text-left"
      >
        <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
          {label}
        </span>
        <span className="min-w-0 flex-1 truncate font-bold text-[var(--text)]">
          {routineName ?? "Rest"}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="rk-squircle-corners me-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-xl leading-none text-[var(--danger)]"
      >
        ×
      </button>
    </div>
  );
}
