"use client";

import { updateProgramDay, removeProgramDay } from "@rackd/db";
import { Card } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { AdvancedSelect, type SelectOption } from "@/components/AdvancedSelect";

interface DayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
  weekday?: number;
}

/** Mon-first display; values follow Date.getDay() (0=Sun…6=Sat). */
const WEEKDAYS: SelectOption[] = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export function ProgramDayRow({
  day,
  routineOptions,
  mode,
  onStart,
}: {
  day: DayRow;
  routineOptions: SelectOption[];
  mode: "rotation" | "weekly";
  onStart: (routineId: string) => void;
}) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <div className="flex items-center gap-2 mb-3">
        <input
          defaultValue={day.name}
          onBlur={(e) =>
            e.target.value.trim() &&
            updateProgramDay(getClient(), day.id, { name: e.target.value.trim() })
          }
          aria-label="Day name"
          className="flex-1 bg-transparent border-none text-lg font-bold text-[var(--text)] focus:outline-none"
        />
        {!day.routineId && (
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.06em]">
            Rest
          </span>
        )}
        <button
          type="button"
          onClick={() => removeProgramDay(getClient(), day.id)}
          aria-label="Remove day"
          className="bg-transparent border-none text-lg text-[var(--text-muted)] min-h-11 w-9"
        >
          ×
        </button>
      </div>

      {mode === "weekly" && (
        <div className="mb-2">
          <AdvancedSelect
            value={day.weekday != null ? String(day.weekday) : ""}
            options={WEEKDAYS}
            placeholder="Pick weekday…"
            onChange={(wd) => updateProgramDay(getClient(), day.id, { weekday: Number(wd) })}
          />
        </div>
      )}

      {routineOptions.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Create a routine first to assign it here.</p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <AdvancedSelect
              value={day.routineId ?? ""}
              options={routineOptions}
              placeholder="Rest day — pick a routine…"
              onChange={(routineId) => updateProgramDay(getClient(), day.id, { routineId })}
            />
          </div>
          <button
            type="button"
            onClick={() => day.routineId && onStart(day.routineId)}
            disabled={!day.routineId}
            className={`inline-flex items-center min-h-11 px-4 rounded-lg font-bold ${
              day.routineId
                ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                : "bg-[var(--surface-2)] text-[var(--text-muted)]"
            }`}
          >
            Start
          </button>
        </div>
      )}
    </Card>
  );
}
