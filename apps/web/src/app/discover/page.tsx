"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cloneSharedRoutine, type SharedRoutineRow } from "@rackd/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { BackButton } from "@/components/BackButton";

interface SharedRow extends SharedRoutineRow {
  createdAt: number;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { results: shared } = useQuery<SharedRow>((c) =>
    c.query("sharedRoutines").Order("createdAt", "DESC"),
  );
  const [cloning, setCloning] = useState(false);

  async function clone(s: SharedRow) {
    if (cloning) return;
    setCloning(true);
    const id = await cloneSharedRoutine(getClient(), { shared: s, ownerId: getCurrentUserId() });
    router.push(`/routines/${id}?from=routines`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <BackButton onClick={() => router.push("/routines")} />
        <h1 className="text-lg font-bold">Discover</h1>
      </header>

      <main className="flex-1 p-4">
        {shared.length === 0 && (
          <p className="text-[var(--text-muted)]">
            No shared routines yet. Publish one from the routine editor.
          </p>
        )}
        {shared.map((s) => (
          <section
            key={s.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-3"
          >
            <h2 className="text-lg font-bold">{s.name}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              by {s.authorName} · {s.exerciseCount} exercises
            </p>
            <button
              type="button"
              onClick={() => clone(s)}
              disabled={cloning}
              className="min-h-11 w-full rounded-lg bg-[var(--accent)] text-white font-bold disabled:opacity-60"
            >
              {cloning ? "Adding…" : "Clone to my routines"}
            </button>
          </section>
        ))}
      </main>
    </div>
  );
}
