"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onIdTokenChanged, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth, signInWithGoogle, signOutUser } from "@/lib/firebase-client";
import { setTokenProvider } from "@/lib/api-client";
import type { SessionUser } from "@/lib/types";

type AuthState = {
  /** True once we know whether somebody is signed in. */
  ready: boolean;
  /** False when this deployment has no Firebase config (candidates cannot sign in). */
  configured: boolean;
  firebaseUser: FirebaseUser | null;
  session: SessionUser | null;
  error: string | null;
  /** Candidates: Google. */
  signIn: () => Promise<void>;
  /** Examiners: shared username and password. */
  signInAsExaminer: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<() => Promise<string | null>>(async () => null);

  /**
   * Asks the server who we are. Identity can come from a Firebase ID token
   * (candidate) or from the examiner session cookie, which travels
   * automatically — so this is called even when nobody is signed into Firebase.
   */
  const refresh = useCallback(async () => {
    try {
      const token = await tokenRef.current();
      const res = await fetch("/api/session", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 401) {
        setSession(null);
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sign-in failed.");
      setSession(body as SessionUser);
      setError(null);
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const auth = await firebaseAuth();
      if (cancelled) return;

      if (auth) {
        const provider = () => auth.currentUser?.getIdToken() ?? Promise.resolve(null);
        tokenRef.current = provider;
        setTokenProvider(provider);
        unsubscribe = onIdTokenChanged(auth, async (user) => {
          setFirebaseUser(user);
          await refresh();
          setReady(true);
        });
      } else {
        setConfigured(false);
        await refresh();
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [refresh]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
    }
  }, []);

  const signInAsExaminer = useCallback(
    async (username: string, password: string) => {
      setError(null);
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sign-in failed.");
      setSession(body as SessionUser);
      setReady(true);
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (session?.role === "EXAMINER") {
      await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    }
    await signOutUser().catch(() => {});
    setSession(null);
  }, [session?.role]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      configured,
      firebaseUser,
      session,
      error,
      signIn,
      signInAsExaminer,
      signOut,
    }),
    [ready, configured, firebaseUser, session, error, signIn, signInAsExaminer, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
