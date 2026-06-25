"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { suggestReplacements } from "@rackd/core";
import { Card, Badge, MuscleVisualizer, exerciseGradient } from "@rackd/ui";
import { useQuery } from "@/lib/use-query";
import { BackButton } from "@/components/BackButton";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[] | Set<string>;
  equipment: string;
  category: string;
  instructions?: string;
  thumbnailUrl?: string;
  clipUrl?: string;
  clipUrlWebm?: string;
}

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

/** Instructions are a single string; split into steps on newlines, else one block. */
function steps(instructions?: string): string[] {
  if (!instructions) return [];
  const lines = instructions
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return lines.length ? lines : [instructions.trim()];
}

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { results: matches } = useQuery<ExerciseRow>(
    (c) => c.query("exercises").Where("id", "=", id),
    [id],
  );
  const ex = matches[0];

  const { results: all } = useQuery<ExerciseRow>((c) => c.query("exercises").Order("name", "ASC"));

  if (!ex) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <Header title="Exercise" onBack={() => router.back()} />
        <p className="p-6 text-[var(--text-muted)]">Exercise not found.</p>
      </div>
    );
  }

  const secondary = [...(ex.secondaryMuscles ?? [])];
  const initials = ex.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const instructionSteps = steps(ex.instructions);
  const similar = suggestReplacements(all, {
    id: ex.id,
    primaryMuscle: ex.primaryMuscle,
    equipment: ex.equipment,
  }).slice(0, 5);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Header
        title={ex.name}
        onBack={() => router.back()}
        action={<Badge tone="neutral">{cap(ex.category)}</Badge>}
      />

      <main className="flex-1 pb-24">
        {/* Hero media — real clip/thumbnail when present, else a tinted placeholder. */}
        <div
          className="relative h-[200px] flex items-center justify-center"
          style={{ background: exerciseGradient(ex.primaryMuscle) }}
        >
          {ex.clipUrl ? (
            <video
              src={ex.clipUrl}
              poster={ex.thumbnailUrl}
              muted
              loop
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : ex.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ex.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <span
                aria-hidden="true"
                className="text-[64px] font-extrabold tracking-tight"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {initials}
              </span>
              <span
                className="absolute left-4 bottom-3.5 text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.78)", whiteSpace: "nowrap" }}
              >
                Photo placeholder
              </span>
            </>
          )}
        </div>

        <div className="px-5 pt-4 flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            <Badge tone="accent">{cap(ex.primaryMuscle)}</Badge>
            <Badge tone="neutral">{cap(ex.equipment)}</Badge>
          </div>

          <Card>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Muscles worked
            </div>
            <MuscleVisualizer primary={ex.primaryMuscle} secondary={secondary} />
          </Card>

          {instructionSteps.length > 0 && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                How to perform
              </div>
              <ol className="m-0 p-0 list-none flex flex-col gap-3">
                {instructionSteps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-extrabold mt-px"
                      style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[14.5px] leading-normal">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {similar.length > 0 && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Similar exercises
              </div>
              <ul className="m-0 p-0 list-none flex flex-col gap-1">
                {similar.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/exercise/${s.id}`}
                      className="flex items-center gap-3 min-h-11 py-2 no-underline text-[var(--text)]"
                    >
                      <span className="font-semibold">{s.name}</span>
                      <span className="ms-auto text-sm text-[var(--text-muted)]">
                        {cap(s.primaryMuscle)} · {cap(s.equipment)}
                      </span>
                      <span className="text-[var(--text-muted)]">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function Header({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-3 py-3.5 px-5 bg-[var(--bg)] border-b border-[var(--border)]">
      <BackButton onClick={onBack} className="-ms-2" />
      <h1 className="m-0 text-lg font-bold flex-1 truncate">{title}</h1>
      {action}
    </header>
  );
}
