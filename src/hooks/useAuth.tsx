/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

const loadSupabase = () => import("@/integrations/supabase/client").then((module) => module.supabase);

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: "not ready" }),
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    const connect = async () => {
      try {
        const supabase = await loadSupabase();
        if (disposed) return;

        // Register the listener first so no auth event is missed.
        const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (disposed) return;
          setSession(nextSession);
          setLoading(false);
        });
        unsubscribe = () => sub.subscription.unsubscribe();

        const { data } = await supabase.auth.getSession();
        if (!disposed) {
          setSession(data.session);
          setLoading(false);
        }
      } catch (error) {
        console.error("Authentication initialization failed:", error);
        if (!disposed) setLoading(false);
      }
    };

    const needsAuthImmediately = window.location.pathname.startsWith("/admin") || window.location.pathname === "/signin";
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    if (needsAuthImmediately) {
      void connect();
    } else {
      // Keep auth/session hydration available on public pages without letting
      // the Supabase SDK compete with the hero's first render.
      timeoutHandle = window.setTimeout(() => {
        if (window.requestIdleCallback) {
          idleHandle = window.requestIdleCallback(() => void connect(), { timeout: 2200 });
        } else {
          void connect();
        }
      }, 2500);
    }

    return () => {
      disposed = true;
      unsubscribe?.();
      if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const supabase = await loadSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session) {
      setSession(data.session);
      setLoading(false);
    }
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const supabase = await loadSupabase();
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export const initialsFor = (user: User | null) => {
  if (!user) return "?";
  const name = (user.user_metadata?.full_name as string | undefined) || user.email || "";
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
