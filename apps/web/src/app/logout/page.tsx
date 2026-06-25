"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * /logout — sign out, then bounce to the root. Clearing the session flips the
 * auth gate (providers.tsx) to the login screen on its own; replacing the URL
 * with "/" just keeps "/logout" out of history so a back-tap doesn't re-trigger.
 */
export default function LogoutPage() {
  const { signOut } = useAuth();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // run once — signOut identity is unstable
    ran.current = true;
    void signOut().finally(() => router.replace("/"));
  }, [signOut, router]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center text-[var(--text-muted)]">
      Signing you out…
    </div>
  );
}
