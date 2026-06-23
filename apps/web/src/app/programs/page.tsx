"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProgram, deleteProgram, PROGRAM_TEMPLATES, cloneProgramTemplate } from "@rackd/db";
import { Card, Button, Badge } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";

interface ProgramRow {
  id: string;
  name: string;
  order: number;
}

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-semibold uppercase tracking-[0.06em]";

export default function ProgramsPage() {
  const router = useRouter();
  const { results: programs } = useQuery<ProgramRow>((c) =>
    c.query("programs").Order("order", "ASC"),
  );
  const { results: routines } = useQuery<{ id: string }>((c) => c.query("routines"));

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
      <main className="flex-1 px-5 pt-5 pb-24">
        <h1 className="text-2xl font-extrabold mb-5">Plans</h1>

        {/* Routines hub entry */}
        <Link href="/routines" className="no-underline block mb-5">
          <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="flex-1">
              <div className="font-bold text-[var(--text)]">Routines</div>
              <div className="text-sm text-[var(--text-muted)]">
                {routines.length} saved · build & edit your workouts
              </div>
            </div>
            <span className="text-[var(--text-muted)]">›</span>
          </Card>
        </Link>

        <div className={`${EYEBROW} mb-2`}>Programs</div>

        {programs.length === 0 && (
          <p className="text-[var(--text-muted)] mb-4">
            No programs yet. Group your routines into a weekly plan (e.g. Push / Pull / Legs).
          </p>
        )}

        <ul className="list-none p-0 m-0 flex flex-col gap-2 mb-4">
          {programs.map((p) => (
            <li key={p.id}>
              <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              </Card>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" fullWidth onClick={() => setBrowsing(true)}>
            Browse templates
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={create}
            style={{ borderStyle: "dashed", color: "var(--accent)" }}
          >
            + New program
          </Button>
        </div>
      </main>
      <Nav />

      {browsing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
          <header className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <h2 className="flex-1 text-lg font-bold">Templates</h2>
            <Button variant="secondary" size="sm" onClick={() => setBrowsing(false)}>
              Close
            </Button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {PROGRAM_TEMPLATES.map((t) => (
              <Card key={t.id} variant="feature">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold flex-1">{t.name}</h3>
                  <Badge tone="accent">{t.days.length} days</Badge>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-2">{t.description}</p>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  {t.days.map((d) => d.name).join(" · ")}
                </p>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => useTemplate(t.id)}
                  disabled={cloning}
                >
                  {cloning ? "Adding…" : "Use this program"}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
