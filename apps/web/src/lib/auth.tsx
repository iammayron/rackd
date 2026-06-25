"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

/**
 * Module-level cache of the current user id so the synchronous `getCurrentUserId()`
 * (used in write paths) stays simple. Kept in sync by AuthProvider.
 */
let currentUserId = "";
export function getCurrentUserId(): string {
  return currentUserId;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();

    // Just track the Supabase session: the API client reads the access token per
    // request, and the exercise library is seeded once server-side (not per login).
    function apply(session: Session | null) {
      currentUserId = session?.user?.id ?? "";
      setUser(session?.user ?? null);
    }

    sb.auth.getSession().then(({ data }) => {
      apply(data.session);
      setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    user,
    loading,
    signIn: async (email, password) => {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    signUp: async (email, password) => {
      const { error } = await getSupabase().auth.signUp({ email, password });
      return { error: error?.message };
    },
    signOut: async () => {
      await getSupabase().auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
