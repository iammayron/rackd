"use client";

import { BottomSheet } from "@/components/BottomSheet";

interface DayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
  weekday?: number;
}

export interface RoutineChoice {
  id: string;
  name: string;
  exCount: number;
}

const exLabel = (n: number) => `${n} exercise${n === 1 ? "" : "s"}`;

/**
 * Bottom sheet for assigning a routine to a program day (rotation) or a weekday
 * (fixed-weekly). Lists every routine (name + exercise count) plus a Rest
 * option; the current assignment is highlighted in accent. Picking one assigns
 * it and closes. `day` may be null in weekly mode when the weekday has no
 * program day yet (Rest is then the selected state). When a routine is assigned,
 * footer actions cover the edit flows the old inline row carried.
 */
export function ProgramDaySheet({
  open,
  onClose,
  day,
  title,
  routines,
  onAssign,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  day: DayRow | null;
  title: string;
  routines: RoutineChoice[];
  /** `undefined` clears the routine (makes the slot a Rest day). */
  onAssign: (routineId: string | undefined) => void;
  /** Edit the assigned routine — scope (everywhere vs fork) is decided upstream. */
  onEdit: (routineId: string) => void;
}) {
  const currentRoutineId = day?.routineId;

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {routines.map((r) => (
          <OptionRow
            key={r.id}
            title={r.name}
            meta={exLabel(r.exCount)}
            selected={currentRoutineId === r.id}
            onClick={() => onAssign(r.id)}
          />
        ))}
        <OptionRow
          title="Rest"
          meta="Recovery"
          selected={!currentRoutineId}
          onClick={() => onAssign(undefined)}
        />
      </ul>

      {currentRoutineId && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => onEdit(currentRoutineId)}
            className="text-sm font-semibold text-[var(--accent)]"
          >
            Edit routine ›
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

function OptionRow({
  title,
  meta,
  selected,
  onClick,
}: {
  title: string;
  meta: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`rk-squircle-corners flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3.5 text-left ${
          selected
            ? "border-transparent bg-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface)]"
        }`}
      >
        <span
          className="min-w-0 truncate font-bold"
          style={{ color: selected ? "var(--text-on-accent)" : "var(--text)" }}
        >
          {title}
        </span>
        <span
          className="shrink-0 text-sm"
          style={
            selected
              ? { color: "var(--text-on-accent)", opacity: 0.85 }
              : { color: "var(--text-muted)" }
          }
        >
          {meta}
        </span>
      </button>
    </li>
  );
}
