"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onIdTokenChanged, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth, signInWithGoogle, signOutUser } from "@/lib/firebase-client";
import { setTokenProvider } from "@/lib/api-client";
import type { SessionUser } from "@/lib/types";

type AuthState = {
  /** True once we know whether somebody is signed in. */
  ready: boolean;
  configured: boolean;
  firebaseUser: FirebaseUser | null;
  session: SessionUser | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void firebaseAuth().then((auth) => {
      if (cancelled) return;
      if (!auth) {
        setConfigured(false);
        setReady(true);
        return;
      }
      setTokenProvider(() => auth.currentUser?.getIdToken() ?? Promise.resolve(null));

      unsubscribe = onIdTokenChanged(auth, async (user) => {
        setFirebaseUser(user);
        if (!user) {
          setSession(null);
          setReady(true);
          return;
        }
        try {
          // The server decides who is an examiner; the client only presents a token.
          const res = await fetch("/api/session", {
            method: "POST",
            headers: { authorization: `Bearer ${await user.getIdToken()}` },
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "Sign-in failed.");
          setSession(body as SessionUser);
          setError(null);
        } catch (err) {
          setSession(null);
          setError(err instanceof Error ? err.message : "Sign-in failed.");
        } finally {
          setReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, configured, firebaseUser, session, error, signIn, signOut }),
    [ready, configured, firebaseUser, session, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
