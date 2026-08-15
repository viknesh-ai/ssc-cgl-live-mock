"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { SitePage } from "@/components/site/site-chrome";
import { GoogleMark } from "@/components/google-mark";
import { Button, EmptyState, Input, Notice, Panel, PanelHeader, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useCatalogue } from "@/lib/catalogue";

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

/** Where a signed-in candidate lands: their papers, and the ways to start another. */
export default function DashboardPage() {
  const { ready, session, signIn } = useAuth();
  const router = useRouter();
  const exams = useCatalogue();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api<{ attempts: AttemptRow[] }>("/api/attempts")
      .then((data) => setAttempts(data.attempts))
      .catch(() => setAttempts([]));
  }, [session]);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setBusy("join");
    setError(null);
    try {
      await api(`/api/rooms/${trimmed}/join`, { method: "POST" });
      router.push(`/exam/${trimmed}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join that session.");
      setBusy(null);
    }
  };

  const practise = async (paperId: number) => {
    setBusy(`paper-${paperId}`);
    setError(null);
    try {
      const { state } = await api<{ state: { attemptId: number } }>("/api/practice", {
        method: "POST",
        body: { paperId },
      });
      router.push(`/practice/${state.attemptId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start that paper.");
      setBusy(null);
    }
  };

  if (!ready) {
    return (
      <SitePage>
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      </SitePage>
    );
  }

  if (!session) {
    return (
      <SitePage>
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <h1 className="font-display text-2xl tracking-tight text-ink">Sign in to continue</h1>
          <p className="mt-2 text-[14px] text-ink-2">
            Your papers and results are kept against your Google account.
          </p>
          <div className="mt-6">
            <Button variant="primary" onClick={() => void signIn()}>
              <GoogleMark />
              Continue with Google
            </Button>
          </div>
        </div>
      </SitePage>
    );
  }

  return (
    <SitePage>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-3xl tracking-tight text-ink">
          {session.name.split(" ")[0]}&apos;s papers
        </h1>
        <p className="mt-1.5 text-[16px] text-ink-2">
          Start a paper, or join a session with its code.
        </p>

        {error ? (
          <div className="mt-5 max-w-lg">
            <Notice tone="bad">{error}</Notice>
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <h2 className="font-display text-[22px] tracking-tight text-ink">Mock tests</h2>
            <div className="mt-3 border-t-2 border-ink">
              {exams === null ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : exams.length === 0 ? (
                <p className="py-6 text-[13px] text-ink-2">No papers are available yet.</p>
              ) : (
                exams.flatMap((exam) =>
                  exam.papers.map((paper) => (
                    <div
                      key={paper.id}
                      className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-4"
                    >
                      <div className="min-w-0 max-w-md">
                        <h3 className="font-display text-lg tracking-tight text-ink">
                          {exam.name}
                        </h3>
                        <p className="mt-0.5 text-[14px] text-ink-2">{paper.name}</p>
                        <p className="mt-1.5 text-[14px] text-ink-3">
                          {paper.questions} questions · {paper.minutes} min · {paper.maxScore} marks
                        </p>
                      </div>
                      <Button disabled={busy !== null} onClick={() => practise(paper.id)}>
                        {busy === `paper-${paper.id}` ? <Spinner /> : null}
                        Start
                      </Button>
                    </div>
                  )),
                )
              )}
            </div>

            <Panel className="mt-8">
              <PanelHeader
                title="Join a supervised session"
                meta="Your camera stays with the examiner."
              />
              <div className="flex flex-wrap items-end gap-3 px-5 py-4">
                <label className="min-w-45 flex-1">
                  <span className="eyebrow block">Session code</span>
                  <Input
                    value={code}
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="KX4M2P"
                    className="mt-1.5 font-mono text-base uppercase tracking-[0.25em]"
                    maxLength={8}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && join()}
                  />
                </label>
                <Button variant="primary" disabled={busy !== null || !code.trim()} onClick={join}>
                  {busy === "join" ? <Spinner /> : null}
                  Join
                </Button>
              </div>
            </Panel>
          </div>

          <Panel className="h-fit">
            <PanelHeader title="History" />
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
                        {a.roomCode ? `Session ${a.roomCode}` : "Practice paper"}
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
                        {a.totalScore?.toFixed(1)} marks
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
      </div>
    </SitePage>
  );
}
