"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient, startQueryPersistence } from "@/lib/query";
import { flushQueue } from "@/lib/offline-queue";
import { hydrateUnit } from "@/lib/units-store";
import { LoginScreen } from "@/components/LoginScreen";
import { ToastProvider } from "@/components/toast/ToastProvider";

/** Auth gate: spinner while resolving, login when signed out, app when signed in. */
function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    hydrateUnit();
    startQueryPersistence();
    // Replay any writes queued while offline, now and whenever we reconnect.
    void flushQueue();
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  if (loading) {
    return <div className="p-8 text-[var(--text-muted)]">Loading Rackd…</div>;
  }
  if (!user) return <LoginScreen />;
  return <>{children}</>;
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
