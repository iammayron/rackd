"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isAuthConfigured } from "./supabase";
import { api } from "./api";

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
  /**
   * Change the signed-in user's password. Verifies `currentPassword` first by
   * re-authenticating (Supabase lets a live session set a new password without
   * the old one — we require it so a borrowed/unlocked session can't).
   */
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
  /** Permanently delete the account (data + auth user), then sign out. */
  deleteAccount: () => Promise<{ error?: string }>;
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
    if (!isAuthConfigured()) {
      try {
        const saved = localStorage.getItem("rackd.demo_user");
        if (saved) {
          const u = JSON.parse(saved);
          currentUserId = u.id;
          setUser(u);
        } else {
          // Auto sign in as demo lifter so preview works instantly
          const demoUser = {
            id: "demo-user-id",
            email: "demo@rackd.test",
            app_metadata: {},
            user_metadata: { name: "Demo Lifter" },
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as User;
          currentUserId = demoUser.id;
          setUser(demoUser);
          localStorage.setItem("rackd.demo_user", JSON.stringify(demoUser));
        }
      } catch {
        const fallback = {
          id: "demo-user-id",
          email: "demo@rackd.test",
          app_metadata: {},
          user_metadata: { name: "Demo Lifter" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User;
        currentUserId = fallback.id;
        setUser(fallback);
      }
      setLoading(false);
      return;
    }

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
      if (!isAuthConfigured()) {
        const demoUser = {
          id: "demo-user-id",
          email: email || "demo@rackd.test",
          app_metadata: {},
          user_metadata: { name: "Demo Lifter" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User;
        currentUserId = demoUser.id;
        setUser(demoUser);
        localStorage.setItem("rackd.demo_user", JSON.stringify(demoUser));
        return {};
      }
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    signUp: async (email, password) => {
      if (!isAuthConfigured()) {
        const demoUser = {
          id: "demo-user-id",
          email: email || "demo@rackd.test",
          app_metadata: {},
          user_metadata: { name: "Demo Lifter" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User;
        currentUserId = demoUser.id;
        setUser(demoUser);
        localStorage.setItem("rackd.demo_user", JSON.stringify(demoUser));
        return {};
      }
      const { error } = await getSupabase().auth.signUp({ email, password });
      return { error: error?.message };
    },
    signOut: async () => {
      if (!isAuthConfigured()) {
        currentUserId = "";
        setUser(null);
        localStorage.removeItem("rackd.demo_user");
        return;
      }
      await getSupabase().auth.signOut();
    },
    updatePassword: async (currentPassword, newPassword) => {
      if (!isAuthConfigured()) {
        return {};
      }
      const sb = getSupabase();
      const email = user?.email;
      if (!email) return { error: "You must be signed in." };
      // Re-authenticate to prove the current password before changing it.
      const { error: reauth } = await sb.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauth) return { error: "Current password is incorrect." };
      const { error } = await sb.auth.updateUser({ password: newPassword });
      return { error: error?.message };
    },
    deleteAccount: async () => {
      try {
        await api("/api/account", { method: "DELETE" });
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Couldn't delete account." };
      }
      if (!isAuthConfigured()) {
        currentUserId = "";
        setUser(null);
        localStorage.removeItem("rackd.demo_user");
        return {};
      }
      await getSupabase().auth.signOut();
      return {};
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
