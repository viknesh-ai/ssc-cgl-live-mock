"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { AppHeader } from "@/components/app-header";
import { GoogleMark } from "@/components/google-mark";
import { Button, EmptyState, Input, Label, Notice, Panel, PanelHeader, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { MAX_SCORE, TOTAL_QUESTIONS } from "@/lib/exam";

type AttemptRow = {
  id: number;
  mode: "LIVE" | "SOLO";
  status: "WAITING" | "IN_PROGRESS" | "SUBMITTED";
  totalScore: number | null;
  joinedAt: string;
  submittedAt: string | null;
  roomCode: string | null;
  roomTitle: string | null;
};

export default function HomePage() {
  const { ready, configured, session, signIn, error } = useAuth();

  if (!configured) return <SetupNeeded />;

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        {!ready ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : !session ? (
          <SignIn onSignIn={signIn} error={error} />
        ) : session.role === "EXAMINER" ? (
          <ExaminerHome />
        ) : (
          <CandidateHome />
        )}
      </main>
    </div>
  );
}

function SignIn({ onSignIn, error }: { onSignIn: () => Promise<void>; error: string | null }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-md pt-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in to continue</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        {TOTAL_QUESTIONS} questions across four sections, 15 minutes each, marked out of {MAX_SCORE}.
        Live sessions are invigilated over camera; practice papers are not.
      </p>

      <div className="mt-7">
        <Button
          variant="secondary"
          className="h-11 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSignIn();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <GoogleMark />}
          Continue with Google
        </Button>
        {error ? (
          <div className="mt-4">
            <Notice tone="bad">{error}</Notice>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ExaminerHome() {
  return (
    <div className="mx-auto max-w-2xl pt-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Examiner</h1>
      <p className="mt-2 text-[14px] text-ink-2">
        Create a room, share its code, and invigilate candidates as they write.
      </p>
      <div className="mt-6">
        <Link href="/admin">
          <Button variant="primary">Open the examiner console</Button>
        </Link>
      </div>
    </div>
  );
}

function CandidateHome() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"join" | "practice" | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);

  useEffect(() => {
    api<{ attempts: AttemptRow[] }>("/api/attempts")
      .then((data) => setAttempts(data.attempts))
      .catch(() => setAttempts([]));
  }, []);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setBusy("join");
    setJoinError(null);
    try {
      await api(`/api/rooms/${trimmed}/join`, { method: "POST" });
      router.push(`/exam/${trimmed}`);
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : "Could not join that room.");
      setBusy(null);
    }
  };

  const practice = async () => {
    setBusy("practice");
    try {
      const { state } = await api<{ state: { attemptId: number } }>("/api/practice", { method: "POST" });
      router.push(`/practice/${state.attemptId}`);
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : "Could not start a practice paper.");
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Take a paper</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-2">
          Join the room your examiner gave you, or write a practice paper on your own. Both draw{" "}
          {TOTAL_QUESTIONS} questions — 25 each from Reasoning, General Awareness, Quantitative
          Aptitude and English — with +2 for a correct answer and &minus;0.5 for a wrong one.
        </p>

        <Panel className="mt-6">
          <PanelHeader title="Join a live room" meta="Invigilated: your camera stays on for the examiner." />
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-45 flex-1">
                <Label>Room code</Label>
                <Input
                  value={code}
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="e.g. KX4M2P"
                  className="mt-1.5 font-mono tracking-[0.2em] uppercase"
                  maxLength={8}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                />
              </div>
              <Button variant="primary" disabled={busy !== null || !code.trim()} onClick={join}>
                {busy === "join" ? <Spinner /> : null}
                Join room
              </Button>
            </div>
            {joinError ? (
              <div className="mt-3">
                <Notice tone="bad">{joinError}</Notice>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="mt-4">
          <PanelHeader title="Practice on your own" meta="No examiner, no camera. Same paper format and timing." />
          <div className="px-5 py-4">
            <Button disabled={busy !== null} onClick={practice}>
              {busy === "practice" ? <Spinner /> : null}
              Start a practice paper
            </Button>
          </div>
        </Panel>
      </div>

      <Panel className="h-fit">
        <PanelHeader title="Your papers" />
        {attempts === null ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : attempts.length === 0 ? (
          <EmptyState title="Nothing yet" hint="Papers you write will be listed here." />
        ) : (
          <ul className="divide-y divide-line">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">
                    {a.roomCode ? `Room ${a.roomCode}` : "Practice paper"}
                  </div>
                  <div className="text-[12px] text-ink-3">
                    {new Date(a.joinedAt).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {a.status === "SUBMITTED" ? (
                  <Link
                    href={`/results/${a.id}`}
                    className="tabular shrink-0 text-[13px] font-medium text-accent hover:underline"
                  >
                    {a.totalScore?.toFixed(1)} / {MAX_SCORE}
                  </Link>
                ) : (
                  <Link
                    href={a.roomCode ? `/exam/${a.roomCode}` : `/practice/${a.id}`}
                    className="shrink-0 text-[13px] font-medium text-accent hover:underline"
                  >
                    Resume
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-xl px-5 py-20">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Configuration needed</h1>
      <p className="mt-2 text-[14px] text-ink-2">
        Firebase sign-in is not configured on this deployment. Set{" "}
        <code className="font-mono text-[13px]">NEXT_PUBLIC_FIREBASE_API_KEY</code>,{" "}
        <code className="font-mono text-[13px]">NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</code>,{" "}
        <code className="font-mono text-[13px]">NEXT_PUBLIC_FIREBASE_PROJECT_ID</code> and{" "}
        <code className="font-mono text-[13px]">NEXT_PUBLIC_FIREBASE_APP_ID</code> in the Railway
        service variables, then redeploy.
      </p>
    </div>
  );
}
