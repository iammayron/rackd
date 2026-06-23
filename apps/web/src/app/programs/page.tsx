"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProgram, deleteProgram, PROGRAM_TEMPLATES, cloneProgramTemplate } from "@myfit/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";

interface ProgramRow {
  id: string;
  name: string;
  order: number;
}

export default function ProgramsPage() {
  const router = useRouter();
  const { results: programs } = useQuery<ProgramRow>((c) =>
    c.query("programs").Order("order", "ASC"),
  );

  const [browsing, setBrowsing] = useState(false);
  const [cloning, setCloning] = useState(false);

  async function create() {
    const p = await createProgram(getClient(), {
      ownerId: getCurrentUserId(),
      name: "New Program",
      order: programs.length,
    });
    router.push(`/programs/${p.id}`);
  }

  async function useTemplate(templateId: string) {
    if (cloning) return;
    const tpl = PROGRAM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setCloning(true);
    const id = await cloneProgramTemplate(getClient(), tpl, getCurrentUserId());
    router.push(`/programs/${id}`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">Programs</h1>

        {programs.length === 0 && (
          <p className="text-[var(--text-muted)] mb-4">
            No programs yet. Group your routines into a weekly plan (e.g. Push / Pull / Legs).
          </p>
        )}

        <ul className="list-none p-0 m-0">
          {programs.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg py-3 px-4 mb-2"
            >
              <Link href={`/programs/${p.id}`} className="flex-1 font-semibold text-[var(--text)] no-underline">
                {p.name}
              </Link>
              <button
                type="button"
                onClick={() => deleteProgram(getClient(), p.id)}
                aria-label="Delete program"
                className="min-h-10 w-9 bg-transparent border-none text-lg text-[var(--text-muted)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setBrowsing(true)}
          className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--accent)] text-white border-none text-lg font-bold hover:bg-[var(--accent-press)]"
        >
          Browse templates
        </button>
        <button
          type="button"
          onClick={create}
          className="mt-2 min-h-[52px] w-full rounded-2xl bg-[var(--surface-2)] text-[var(--accent)] border border-dashed border-[var(--border)] text-lg font-bold"
        >
          + New program
        </button>
      </main>
      <Nav />

      {browsing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
          <header className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <h2 className="flex-1 text-lg font-bold">Templates</h2>
            <button
              type="button"
              onClick={() => setBrowsing(false)}
              className="min-h-11 px-4 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg font-semibold"
            >
              Close
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {PROGRAM_TEMPLATES.map((t) => (
              <section
                key={t.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4"
              >
                <h3 className="text-lg font-bold">{t.name}</h3>
                <p className="text-sm text-[var(--text-muted)] mb-2">{t.description}</p>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  {t.days.length} days · {t.days.map((d) => d.name).join(" · ")}
                </p>
                <button
                  type="button"
                  onClick={() => useTemplate(t.id)}
                  disabled={cloning}
                  className="min-h-11 w-full rounded-lg bg-[var(--accent)] text-white font-bold disabled:opacity-60"
                >
                  {cloning ? "Adding…" : "Use this program"}
                </button>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
