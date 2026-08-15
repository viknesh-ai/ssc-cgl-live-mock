"use client";

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from "firebase/auth";

/**
 * Firebase is used for one thing: proving which Google account someone is.
 *
 * The config is read from the build-time NEXT_PUBLIC_* variables when they are
 * present, and otherwise fetched from /api/config, so a deployment that had its
 * Firebase variables added later still works after a restart.
 */
const buildTimeConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

const isComplete = (config: FirebaseOptions) =>
  Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let authPromise: Promise<Auth | null> | null = null;

/** Resolves the auth instance, or null when this deployment has no Firebase config. */
export function firebaseAuth(): Promise<Auth | null> {
  authPromise ??= (async () => {
    let config = buildTimeConfig;
    if (!isComplete(config)) {
      try {
        const res = await fetch("/api/config");
        const runtime = (await res.json()) as Record<string, string | null>;
        config = {
          apiKey: runtime.apiKey ?? undefined,
          authDomain: runtime.authDomain ?? undefined,
          projectId: runtime.projectId ?? undefined,
          appId: runtime.appId ?? undefined,
          messagingSenderId: runtime.messagingSenderId ?? undefined,
        };
      } catch {
        return null;
      }
    }
    if (!isComplete(config)) return null;
    // Sign in through our own domain (next.config.ts proxies /__/auth to
    // Firebase), so the flow is first-party and works on phones too.
    const app = getApps().length
      ? getApp()
      : initializeApp({ ...config, authDomain: window.location.host });
    return getAuth(app);
  })();
  return authPromise;
}

/**
 * Google sign-in. A popup is the better experience, but some browsers block it
 * outright, so fall back to a full-page redirect rather than failing.
 */
export async function signInWithGoogle() {
  const auth = await firebaseAuth();
  if (!auth) throw new Error("Sign-in is not configured on this deployment.");
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    throw err;
  }
}

export async function signOutUser() {
  const auth = await firebaseAuth();
  if (auth) await signOut(auth);
}
