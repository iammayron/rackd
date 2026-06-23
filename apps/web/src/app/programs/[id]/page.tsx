"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { renameProgram, addProgramDay, startSessionFromRoutine } from "@myfit/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { ProgramDayRow } from "@/features/programs/ProgramDayRow";

interface DayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
}
interface RoutineRow {
  id: string;
  name: string;
}

export default function ProgramEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const programId = params.id;

  const { results: program } = useQuery<{ id: string; name: string }>(
    (c) => c.query("programs").Where("id", "=", programId),
    [programId],
  );
  const name = program[0]?.name ?? "";

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
          className="bg-transparent border-none text-lg text-[var(--text-muted)]"
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
      </header>

      <main className="flex-1 p-4">
        {days.map((d) => (
          <ProgramDayRow key={d.id} day={d} routineOptions={routineOptions} onStart={start} />
        ))}
        <button
          type="button"
          onClick={addDay}
          className="min-h-[52px] w-full rounded-2xl bg-[var(--accent)] text-white border-none text-lg font-bold hover:bg-[var(--accent-press)]"
        >
          + Add day
        </button>
      </main>
    </div>
  );
}
