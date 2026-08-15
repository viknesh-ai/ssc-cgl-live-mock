"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { AppHeader } from "@/components/app-header";
import { ExamRunner } from "@/components/exam/exam-runner";
import { Button, Notice, Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { AttemptState } from "@/lib/types";

/**
 * Loads (or creates) the paper for this page, then hands over to the runner.
 * Sign-in is required first: the paper is drawn per candidate.
 */
export function AttemptLoader({
  load,
  roomCode,
  signInPrompt,
}: {
  load: () => Promise<AttemptState>;
  roomCode?: string;
  signInPrompt: string;
}) {
  const { ready, session, signIn } = useAuth();
  const [state, setState] = useState<AttemptState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    load()
      .then((s) => active && setState(s))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Could not open this paper."));
    return () => {
      active = false;
    };
    // `load` is recreated per render by the page; the room code identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, roomCode]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-full">
        <AppHeader />
        <main className="mx-auto max-w-md px-5 py-20 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in to continue</h1>
          <p className="mt-2 text-[14px] text-ink-2">{signInPrompt}</p>
          <div className="mt-6">
            <Button variant="primary" onClick={() => void signIn()}>
              Continue with Google
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full">
        <AppHeader />
        <main className="mx-auto max-w-md px-5 py-20">
          <Notice tone="bad">{error}</Notice>
          <div className="mt-5">
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <ExamRunner initialState={state} roomCode={roomCode} />;
}
