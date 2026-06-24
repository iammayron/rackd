"use client";

import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { hydrateUnit } from "@/lib/units-store";
import { LoginScreen } from "@/components/LoginScreen";
import { ToastProvider } from "@/components/toast/ToastProvider";

/** Auth gate: spinner while resolving, login when signed out, app when signed in. */
function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useEffect(() => {
    hydrateUnit();
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
      <AuthProvider>
        <Gate>{children}</Gate>
      </AuthProvider>
    </ToastProvider>
  );
}
