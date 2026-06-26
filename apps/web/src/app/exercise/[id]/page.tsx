"use client";

import { useParams, useRouter } from "next/navigation";
import { Badge } from "@rackd/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { BackButton } from "@/components/BackButton";
import { ExerciseDetail } from "@/features/exercise/ExerciseDetail";

interface ExerciseRow {
  name: string;
  category: string;
}

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Deep-link / full-page fallback for the exercise detail. In-app navigation
 * opens the slide-up sheet ({@link useExerciseDetail}); this route exists so a
 * shared/bookmarked `/exercise/[id]` URL still resolves. Same body, page chrome.
 */
export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: ex } = useQuery({
    queryKey: qk.exercise(id),
    queryFn: () => api<ExerciseRow>(`/api/exercises/${id}`),
    enabled: Boolean(id),
  });

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-3 py-3.5 px-5 bg-[var(--bg)] border-b border-[var(--border)]">
        <BackButton onClick={() => router.back()} className="-ms-2" />
        <h1 className="m-0 text-lg font-bold flex-1 truncate">{ex?.name ?? "Exercise"}</h1>
        {ex?.category && <Badge tone="neutral">{cap(ex.category)}</Badge>}
      </header>

      <main className="flex-1 px-4 pt-2 pb-24">
        <ExerciseDetail
          id={id}
          onSelectExercise={(next) => router.push(`/exercise/${next}`)}
        />
      </main>
    </div>
  );
}
