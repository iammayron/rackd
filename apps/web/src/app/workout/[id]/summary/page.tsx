"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { useQuery } from "@tanstack/react-query";
import { sessionVolume } from "@rackd/core";
import {
  Card,
  StatTile,
  Badge,
  Button,
  ShareCard,
  SegmentedControl,
  type ShareCardTheme,
} from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";

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

/** Format a workout duration as "52 min" / "1 h 04 min". */
function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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
  const exerciseBySe = useMemo(
    () => Object.fromEntries(ses.map((s) => [s.id, s.exerciseId])),
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

  // Top set = heaviest completed lift, as a shareable headline.
  const topSet = useMemo(() => {
    if (completed.length === 0) return undefined;
    const top = completed.reduce((b, s) => (s.weight > b.weight ? s : b));
    const name = nameByExercise[exerciseBySe[top.sessionExerciseId] ?? ""] ?? "Exercise";
    return `${name} · ${Math.round(display(top.weight))}${unit} × ${top.reps}`;
  }, [completed, nameByExercise, exerciseBySe, display, unit]);

  const cardData = {
    name: session?.name ?? "Workout",
    date: session ? fmtDate(session.startedAt) : "",
    volume: Math.round(display(volumeKg)).toLocaleString(),
    volumeUnit: unit,
    duration: fmtDuration(durMs).replace(/ min$/, "m").replace(/ h /, "h "),
    sets: completed.length,
    prCount: prs.length,
    topSet,
  };

  const [theme, setTheme] = useState<ShareCardTheme>("accent");
  const [busy, setBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const shareText = `${cardData.name} — ${cardData.volume} ${unit} volume · ${cardData.sets} sets · ${cardData.duration}${
    prs.length ? ` · ${prs.length} PR${prs.length === 1 ? "" : "s"} 💪` : ""
  } — tracked with Rackd`;

  async function onShare() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    setShareMsg(null);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "rackd-workout.png", { type: "image/png" });

      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: shareText, title: "Rackd workout" });
      } else {
        // Fallback: download the image + copy the text summary.
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "rackd-workout.png";
        a.click();
        try {
          await navigator.clipboard?.writeText(shareText);
          setShareMsg("Image saved · summary copied");
        } catch {
          setShareMsg("Image saved");
        }
      }
    } catch (e) {
      // User-cancelled share is not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setShareMsg("Couldn’t share — try saving the image.");
      }
    } finally {
      setBusy(false);
    }
  }

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

      {/* Shareable card preview — this exact node is what gets rasterized. */}
      <div className="mt-2 mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
        Share
      </div>
      <div className="mx-auto mb-3 w-full max-w-[300px]">
        <div ref={cardRef}>
          <ShareCard data={cardData} theme={theme} />
        </div>
      </div>
      <div className="mb-4 flex justify-center">
        <SegmentedControl
          size="sm"
          value={theme}
          onChange={(v) => setTheme(v as ShareCardTheme)}
          options={[
            { value: "accent", label: "Coral" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
      </div>
      {shareMsg && (
        <p className="mb-2 text-center text-sm text-[var(--text-muted)]">{shareMsg}</p>
      )}

      <div className="mt-auto pt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={busy}
          onClick={onShare}
          style={{ boxShadow: "var(--shadow-accent)" }}
        >
          {busy ? "Preparing…" : "Share workout"}
        </Button>
        <Button variant="ghost" fullWidth onClick={() => router.push("/history")} style={{ marginTop: 10 }}>
          Back to progress
        </Button>
      </div>
    </div>
  );
}
