"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Wordmark } from "@/components/wordmark";
import { Button, Input, Notice, Spinner, cx } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

/**
 * The proctoring console: sign-in gate and the page beneath it.
 *
 * This is where sittings are run and watched. Making the content that
 * candidates sit — exams, papers, questions — happens in the studio, which is
 * deliberately not linked from here.
 */
export function ConsoleShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { ready, session, signOut } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (session?.role !== "EXAMINER") return <ExaminerLogin />;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex h-14 items-center justify-between gap-4 px-5">
          <Link href="/admin">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12px] text-ink-3 sm:block">Examiner console</span>
            <Button variant="quiet" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <main className="min-w-0 flex-1 px-5 py-7">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl tracking-tight text-ink">{title}</h1>
                {description ? (
                  <p className="mt-1 max-w-2xl text-[13.5px] text-ink-2">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Examiners share one username and password rather than a personal account:
 * the console has to open on whatever device is to hand, and more than one
 * person may be invigilating the same room at the same time.
 */
export function ExaminerLogin() {
  const { signInAsExaminer, session } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signInAsExaminer(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/">
            <Wordmark />
          </Link>
          <span className="text-[13px] text-ink-3">Examiner console</span>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-16">
        <h1 className="font-display text-2xl tracking-tight text-ink">Sign in to invigilate</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
          Use the shared examiner credentials. Several examiners can be signed in at once, on
          different devices.
        </p>

        <div className="mt-7 space-y-3">
          <label className="block">
            <span className="eyebrow block">Username</span>
            <Input
              value={username}
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              className="mt-1.5"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <label className="block">
            <span className="eyebrow block">Password</span>
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              className="mt-1.5"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <Button
            variant="primary"
            className="h-10 w-full"
            disabled={busy || !username.trim() || !password}
            onClick={submit}
          >
            {busy ? <Spinner /> : null}
            Sign in
          </Button>
        </div>

        {error ? (
          <div className="mt-4">
            <Notice tone="bad">{error}</Notice>
          </div>
        ) : null}

        {session ? (
          <div className="mt-4">
            <Notice>
              You are signed in as {session.email}, which is a candidate account. Signing in above
              opens the examiner console instead.
            </Notice>
          </div>
        ) : null}

        <p className="mt-8 text-[12.5px] text-ink-3">
          Candidates do not sign in here —{" "}
          <Link href="/" className="underline underline-offset-4 hover:text-ink-2">
            {APP_NAME} home
          </Link>{" "}
          uses Google.
        </p>
      </main>
    </div>
  );
}
