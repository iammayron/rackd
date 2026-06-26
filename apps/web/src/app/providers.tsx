"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient, startQueryPersistence } from "@/lib/query";
import { flushQueue } from "@/lib/offline-queue";
import { hydrateUnit, useSyncUnitFromProfile } from "@/lib/units-store";
import { LoginScreen } from "@/components/LoginScreen";
import { ToastProvider } from "@/components/toast/ToastProvider";
import { InstallWall, useIsInstalled } from "@/components/InstallWall";
import { ExerciseDetailSheet } from "@/features/exercise/ExerciseDetailSheet";

/** Signed-in shell: seeds runtime state that depends on an authed session. */
function AppShell({ children }: { children: React.ReactNode }) {
  useSyncUnitFromProfile();
  return (
    <>
      {children}
      <ExerciseDetailSheet />
    </>
  );
}

/** Auth gate: spinner while resolving, login when signed out, app when signed in. */
function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const installed = useIsInstalled();

  useEffect(() => {
    hydrateUnit();
    startQueryPersistence();
    // Replay any writes queued while offline, now and whenever we reconnect.
    void flushQueue();
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Install gate first: Rackd is install-only, so anyone in a plain browser tab
  // sees the "Add to Home Screen" wall before any auth UI. `null` = still detecting.
  if (installed === null) {
    return <div className="p-8 text-[var(--text-muted)]">Loading Rackd…</div>;
  }
  if (!installed) return <InstallWall />;

  if (loading) {
    return <div className="p-8 text-[var(--text-muted)]">Loading Rackd…</div>;
  }
  if (!user) return <LoginScreen />;
  return <AppShell>{children}</AppShell>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Gate>{children}</Gate>
        </AuthProvider>
      </QueryClientProvider>
    </ToastProvider>
  );
}
