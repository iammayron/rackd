"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  renameProgram,
  addProgramDay,
  startSessionFromRoutine,
  setProgramActive,
  setProgramSchedule,
} from "@rackd/db";
import { Badge, Button, SegmentedControl } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { ProgramDayRow } from "@/features/programs/ProgramDayRow";

interface ProgramRow {
  id: string;
  name: string;
  active?: boolean;
  scheduleMode?: "rotation" | "weekly";
  rotationCursor?: number;
}
interface DayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
  weekday?: number;
}
interface RoutineRow {
  id: string;
  name: string;
}

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-semibold uppercase tracking-[0.06em]";

export default function ProgramEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const programId = params.id;

  const { results: program } = useQuery<ProgramRow>(
    (c) => c.query("programs").Where("id", "=", programId),
    [programId],
  );
  const p = program[0];
  const name = p?.name ?? "";
  const mode = p?.scheduleMode ?? "rotation";

  const { results: days } = useQuery<DayRow>(
    (c) => c.query("programDays").Where("programId", "=", programId).Order("order", "ASC"),
    [programId],
  );
  const { results: routines } = useQuery<RoutineRow>((c) => c.query("routines").Order("name", "ASC"));
  const routineOptions = routines.map((r) => ({ value: r.id, label: r.name }));

  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  async function addDay() {
    await addProgramDay(getClient(), { programId, order: days.length + 1 });
  }

  async function start(routineId: string) {
    const s = await startSessionFromRoutine(getClient(), {
      routineId,
      ownerId: getCurrentUserId(),
      now: Date.now(),
    });
    router.push(`/workout/${s.id}`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => router.push("/programs")}
          aria-label="Back"
          className="bg-transparent border-none text-[22px] leading-none text-[var(--text-muted)]"
        >
          ←
        </button>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => draftName.trim() && renameProgram(getClient(), programId, draftName.trim())}
          aria-label="Program name"
          className="flex-1 bg-transparent border-none text-lg font-bold text-[var(--text)] focus:outline-none"
        />
        {p?.active && (
          <Badge tone="accent" solid>
            Active
          </Badge>
        )}
      </header>

      <main className="flex-1 px-5 pt-4 pb-24">
        {/* Make this the program that drives the dashboard's "today". */}
        {!p?.active && (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setProgramActive(getClient(), { programId, ownerId: getCurrentUserId() })}
            style={{ marginBottom: 16, color: "var(--accent)" }}
          >
            Set as active program
          </Button>
        )}

        {/* Schedule mode */}
        <div className={`${EYEBROW} mb-2`}>Schedule</div>
        <SegmentedControl
          value={mode}
          options={[
            { value: "rotation", label: "Rotation" },
            { value: "weekly", label: "Weekly" },
          ]}
          onChange={(m) =>
            setProgramSchedule(getClient(), programId, {
              scheduleMode: m as "rotation" | "weekly",
            })
          }
          style={{ marginBottom: 8 }}
        />
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {mode === "rotation"
            ? "Days cycle in order regardless of the calendar. A day with no routine is a rest day."
            : "Each day maps to a weekday. Days with no routine are rest days."}
        </p>

        {days.map((d) => (
          <ProgramDayRow
            key={d.id}
            day={d}
            routineOptions={routineOptions}
            mode={mode}
            onStart={start}
          />
        ))}

        <Button variant="secondary" size="lg" fullWidth onClick={addDay} style={{ borderStyle: "dashed", color: "var(--accent)" }}>
          + Add day
        </Button>
      </main>
    </div>
  );
}
