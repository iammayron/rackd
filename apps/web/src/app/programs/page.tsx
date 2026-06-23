"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProgram, deleteProgram } from "@fitnow/db";
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

  async function create() {
    const p = await createProgram(getClient(), {
      ownerId: getCurrentUserId(),
      name: "New Program",
      order: programs.length,
    });
    router.push(`/programs/${p.id}`);
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
          onClick={create}
          className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--surface-2)] text-[var(--accent)] border border-dashed border-[var(--border)] text-lg font-bold"
        >
          + New program
        </button>
      </main>
      <Nav />
    </div>
  );
}
