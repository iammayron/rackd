"use client";

import { updateProgramDay, removeProgramDay } from "@rackd/db";
import { getClient } from "@/lib/triplit";
import { AdvancedSelect, type SelectOption } from "@/components/AdvancedSelect";

interface DayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
}

export function ProgramDayRow({
  day,
  routineOptions,
  onStart,
}: {
  day: DayRow;
  routineOptions: SelectOption[];
  onStart: (routineId: string) => void;
}) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4">
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
        <button
          type="button"
          onClick={() => removeProgramDay(getClient(), day.id)}
          aria-label="Remove day"
          className="bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ×
        </button>
      </div>

      {routineOptions.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Create a routine first to assign it here.</p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <AdvancedSelect
              value={day.routineId ?? ""}
              options={routineOptions}
              placeholder="Pick routine…"
              onChange={(routineId) => updateProgramDay(getClient(), day.id, { routineId })}
            />
          </div>
          <button
            type="button"
            onClick={() => day.routineId && onStart(day.routineId)}
            disabled={!day.routineId}
            className={`inline-flex items-center min-h-11 px-4 rounded-lg font-bold ${
              day.routineId ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-[var(--text-muted)]"
            }`}
          >
            Start
          </button>
        </div>
      )}
    </section>
  );
}
