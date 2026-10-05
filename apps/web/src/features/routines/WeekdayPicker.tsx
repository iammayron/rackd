"use client";

/** Weekday labels indexed 0=Sun … 6=Sat (matches `Date.getDay()`). */
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Toggle which weekdays a routine is scheduled for. `value` is the current set
 * of weekday numbers; `onChange` receives the full next set on each toggle.
 */
export function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  function toggle(day: number) {
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
    onChange(next.sort((a, b) => a - b));
  }

  return (
    <div className="flex gap-2">
      {DAYS.map((label, day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={on}
            aria-label={DAY_NAMES[day]}
            className={`flex-1 min-h-10 rounded-[var(--radius-sm)] border text-sm font-bold ${
              on
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
