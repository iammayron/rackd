"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { sessionVolume } from "@rackd/core";
import { Card, StatTile, Badge, Button } from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { ShareWorkoutSheet } from "@/features/share/ShareWorkoutSheet";
import { fmtDuration } from "@/features/share/buildShareCardData";

interface SetRow {
  id: string;
  sessionExerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
}
interface SERow {
  id: string;
  exerciseId: string;
  exercise?: { name?: string } | null;
  sets: SetRow[];
}
interface SessionTree {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  exercises: SERow[];
}
interface PrRow {
  id: string;
  exerciseId: string;
  type: string;
  value: number;
  sessionId: string;
}

export default function WorkoutSummaryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const { unit, display } = useUnit();

  const { data: session } = useQuery({
    queryKey: qk.session(sessionId),
    queryFn: () => api<SessionTree>(`/api/sessions/${sessionId}`),
  });
  const ses = useMemo(() => session?.exercises ?? [], [session]);

  const nameByExercise = useMemo(
    () => Object.fromEntries(ses.map((s) => [s.exerciseId, s.exercise?.name ?? "Exercise"])),
    [ses],
  );

  const sets = useMemo(() => ses.flatMap((s) => s.sets ?? []), [ses]);

  const { data: allPrs = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<PrRow[]>("/api/personal-records"),
  });
  const prs = useMemo(
    () => allPrs.filter((pr) => pr.sessionId === sessionId),
    [allPrs, sessionId],
  );

  const completed = sets.filter((s) => s.completed);
  // sessionVolume sums weight×reps over the completed sets (canonical kg).
  const volumeKg = sessionVolume(completed as never);
  const durMs = session?.endedAt && session?.startedAt ? session.endedAt - session.startedAt : 0;

  const [shareOpen, setShareOpen] = useState(false);

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

      <div className="mt-auto pt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => setShareOpen(true)}
          style={{ boxShadow: "var(--shadow-accent)" }}
        >
          Share workout
        </Button>
        <Button variant="ghost" fullWidth onClick={() => router.push("/history")} style={{ marginTop: 10 }}>
          Back to progress
        </Button>
      </div>

      <ShareWorkoutSheet sessionId={sessionId} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
