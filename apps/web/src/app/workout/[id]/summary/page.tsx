"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { sessionVolume } from "@rackd/core";
import { Card, StatTile, Badge, Button } from "@rackd/ui";
import { useQuery } from "@/lib/use-query";
import { useUnit } from "@/lib/units-store";

interface SessionRow {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
}
interface SERow {
  id: string;
  exerciseId: string;
  exercise?: { name?: string } | null;
}
interface SetRow {
  id: string;
  sessionExerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
}
interface PrRow {
  id: string;
  exerciseId: string;
  type: string;
  value: number;
}

/** Format a workout duration as "52 min" / "1 h 04 min". */
function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

export default function WorkoutSummaryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const { unit, display } = useUnit();

  const { results: sessions } = useQuery<SessionRow>(
    (c) => c.query("sessions").Where("id", "=", sessionId),
    [sessionId],
  );
  const session = sessions[0];

  const { results: ses } = useQuery<SERow>(
    (c) => c.query("sessionExercises").Where("sessionId", "=", sessionId).Include("exercise"),
    [sessionId],
  );
  const seIds = useMemo(() => ses.map((s) => s.id), [ses]);
  const nameByExercise = useMemo(
    () => Object.fromEntries(ses.map((s) => [s.exerciseId, s.exercise?.name ?? "Exercise"])),
    [ses],
  );

  const { results: sets } = useQuery<SetRow>(
    (c) => c.query("setLogs").Where("sessionExerciseId", "in", seIds),
    [seIds.join(",")],
  );
  const { results: prs } = useQuery<PrRow>(
    (c) => c.query("personalRecords").Where("sessionId", "=", sessionId),
    [sessionId],
  );

  const completed = sets.filter((s) => s.completed);
  // sessionVolume sums weight×reps over the completed sets (canonical kg).
  const volumeKg = sessionVolume(completed as never);
  const durMs = session?.endedAt && session?.startedAt ? session.endedAt - session.startedAt : 0;

  return (
    <div className="flex flex-col min-h-[100dvh] p-6 pb-10">
      <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--success)]">
        Workout complete 🎉
      </div>
      <h1 className="mb-5 text-3xl font-extrabold leading-tight">{session?.name ?? "Workout"}</h1>

      <Card style={{ marginBottom: 16 }}>
        <div className="flex flex-wrap justify-between gap-4">
          <StatTile label="Duration" value={fmtDuration(durMs)} />
          <StatTile
            label="Volume"
            value={Math.round(display(volumeKg)).toLocaleString()}
            unit={unit}
          />
          <StatTile label="Sets" value={completed.length} />
          <StatTile label="PRs" value={prs.length} />
        </div>
      </Card>

      {prs.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            New personal records
          </div>
          {prs.map((pr) => (
            <div key={pr.id} className="flex items-center gap-2 py-1.5">
              <Badge tone="accent" solid>
                PR
              </Badge>
              <span className="flex-1 font-semibold">{nameByExercise[pr.exerciseId] ?? "Exercise"}</span>
              <span className="text-sm text-[var(--text-muted)] tabular-nums">
                {pr.type === "1rm"
                  ? `${Math.round(display(pr.value))} ${unit} e1RM`
                  : `${Math.round(display(pr.value))} ${unit}`}
              </span>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-auto pt-6">
        {/* TODO(phase-6): share this summary as an image + text. */}
        <Button variant="primary" size="lg" fullWidth onClick={() => router.push("/history")}>
          Done
        </Button>
      </div>
    </div>
  );
}
