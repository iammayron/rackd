"use client";

import { useEffect, useState } from "react";
import { seedExercises } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { hydrateUnit } from "@/lib/units-store";

/**
 * Boots the local-first client and seeds the exercise library once.
 * Renders children only after the client is ready so queries never race seeding.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hydrateUnit();
    (async () => {
      try {
        await seedExercises(getClient());
      } catch (e) {
        console.error("[fitnow] seed failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div className="p-8 text-[var(--text-muted)]">Loading FitNow…</div>;
  }
  return <>{children}</>;
}
