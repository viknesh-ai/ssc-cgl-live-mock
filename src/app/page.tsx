"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { AppHeader } from "@/components/app-header";
import { GoogleMark } from "@/components/google-mark";
import { Wordmark } from "@/components/wordmark";
import { Button, EmptyState, Input, Notice, Panel, PanelHeader, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

type CataloguePaper = {
  id: number;
  name: string;
  description: string | null;
  examName: string;
  examDescription: string | null;
  correctMark: number;
  wrongMark: number;
  questions: number;
  minutes: number;
  maxScore: number;
  sections: { name: string; shortName: string; questionCount: number; minutes: number }[];
};

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

/** The papers on offer, straight from the database rather than hardcoded. */
function useCatalogue() {
  const [papers, setPapers] = useState<CataloguePaper[] | null>(null);
  useEffect(() => {
    fetch("/api/catalogue")
      .then((r) => r.json())
      .then((d) => setPapers(d.papers ?? []))
      .catch(() => setPapers([]));
  }, []);
  return papers;
}

export default function HomePage() {
  const { ready, session } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session) return <Landing />;

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-9">
        {session.role === "EXAMINER" ? <ExaminerHome /> : <CandidateHome />}
      </main>
    </div>
  );
}

/* -------------------------------- signed out ------------------------------- */

function Landing() {
  const { signIn, configured, error } = useAuth();
  const [busy, setBusy] = useState(false);
  const papers = useCatalogue();
  const paper = papers?.[0];

  return (
    <div className="min-h-full">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <Link
            href="/admin"
            className="text-[13px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Examiner sign-in
          </Link>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-24">
        <div className="max-w-xl">
          <p className="eyebrow">{APP_TAGLINE}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.15] tracking-tight text-ink sm:text-[44px]">
            Sit a mock paper under exam conditions, not on the honour system.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
            {APP_NAME} runs timed papers with a live invigilator: your camera stays with the
            examiner, sections lock when their clock runs out, and every answer is marked the moment
            you pick it. Afterwards, an AI works through any question you got wrong.
          </p>

          {!configured ? (
            <div className="mt-8 max-w-md">
              <Notice tone="warn">
                Sign-in is not configured on this deployment yet. Set the Firebase variables and
                redeploy.
              </Notice>
            </div>
          ) : (
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                variant="primary"
                className="h-11 px-5"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await signIn();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Spinner /> : <GoogleMark />}
                Continue with Google
              </Button>
              <span className="text-[13px] text-ink-3">
                Candidates sign in with Google. Examiners use{" "}
                <Link href="/admin" className="underline underline-offset-4 hover:text-ink-2">
                  the console
                </Link>
                .
              </span>
            </div>
          )}

          {error ? (
            <div className="mt-6 max-w-md">
              <Notice tone="bad">{error}</Notice>
            </div>
          ) : null}
        </div>

        {/* The paper, written out the way a notice board would put it. */}
        <aside className="lg:pt-10">
          {paper ? (
            <div className="border-t-2 border-ink pt-4">
              <p className="eyebrow">
                {papers && papers.length > 1 ? "Papers on offer" : "Available paper"}
              </p>
              <h2 className="mt-1.5 font-display text-xl tracking-tight text-ink">
                {paper.examName}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                {paper.examDescription ?? paper.description}
              </p>

              <dl className="mt-5 divide-y divide-line border-y border-line text-[13.5px]">
                {[
                  ["Questions", String(paper.questions)],
                  ["Sections", paper.sections.map((s) => s.shortName).join(", ")],
                  [
                    "Duration",
                    `${paper.sections.length} × ${paper.sections[0]?.minutes ?? 0} minutes`,
                  ],
                  [
                    "Marks",
                    `+${paper.correctMark} correct, ${paper.wrongMark} wrong, ${paper.maxScore} total`,
                  ],
                  ["Invigilation", "Camera and microphone, live"],
                  ["After the paper", "Marked instantly, AI answer review"],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4 py-2.5">
                    <dt className="w-32 shrink-0 text-ink-3">{label}</dt>
                    <dd className="text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[12px] text-ink-3">
                {papers && papers.length > 1
                  ? `${papers.length} papers available once you sign in.`
                  : "More papers are being added."}
              </p>
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

/* --------------------------------- examiner -------------------------------- */

function ExaminerHome() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl tracking-tight text-ink">Examiner</h1>
      <p className="mt-2 text-[14px] text-ink-2">
        Create a session, share its code, and invigilate candidates as they write.
      </p>
      <div className="mt-6">
        <Link href="/admin">
          <Button variant="primary">Open the console</Button>
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------- candidate -------------------------------- */

function CandidateHome() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const papers = useCatalogue();

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

  const practice = async (paperId: number) => {
    setBusy(`paper-${paperId}`);
    try {
      const { state } = await api<{ state: { attemptId: number } }>("/api/practice", {
        method: "POST",
        body: { paperId },
      });
      router.push(`/practice/${state.attemptId}`);
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : "Could not start a practice paper.");
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink">Take a paper</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-2">
          Join the session your examiner gave you, or write a paper on your own.
        </p>

        <div className="mt-7 border-t-2 border-ink">
          {papers === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : papers.length === 0 ? (
            <p className="py-6 text-[13px] text-ink-2">No papers are available yet.</p>
          ) : (
            papers.map((paper) => (
              <div
                key={paper.id}
                className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-5"
              >
                <div className="min-w-0 max-w-md">
                  <h2 className="font-display text-lg tracking-tight text-ink">{paper.examName}</h2>
                  <p className="mt-0.5 text-[13px] text-ink-2">{paper.name}</p>
                  <p className="mt-2 text-[12.5px] text-ink-3">
                    {paper.questions} questions · {paper.minutes} minutes · {paper.maxScore} marks ·
                    +{paper.correctMark} / {paper.wrongMark}
                  </p>
                </div>
                <Button disabled={busy !== null} onClick={() => practice(paper.id)}>
                  {busy === `paper-${paper.id}` ? <Spinner /> : null}
                  Practice on my own
                </Button>
              </div>
            ))
          )}
        </div>

        <Panel className="mt-7">
          <PanelHeader
            title="Join a live session"
            meta="Invigilated: your camera stays with the examiner for the whole paper."
          />
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-45 flex-1">
                <span className="eyebrow block">Room code</span>
                <Input
                  value={code}
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="KX4M2P"
                  className="mt-1.5 font-mono text-base tracking-[0.25em] uppercase"
                  maxLength={8}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                />
              </label>
              <Button variant="primary" disabled={busy !== null || !code.trim()} onClick={join}>
                {busy === "join" ? <Spinner /> : null}
                Join session
              </Button>
            </div>
            {joinError ? (
              <div className="mt-3">
                <Notice tone="bad">{joinError}</Notice>
              </div>
            ) : null}
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
  );
}
