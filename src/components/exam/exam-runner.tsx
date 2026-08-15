"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ExamTimer } from "@/components/exam/exam-timer";
import { QuestionPalette } from "@/components/exam/question-palette";
import { ChatPanel } from "@/components/exam/chat-panel";
import { SelfCamera } from "@/components/exam/self-camera";
import {
  Badge,
  Button,
  ConfirmDialog,
  Notice,
  Panel,
  PanelHeader,
  Spinner,
  cx,
} from "@/components/ui";
import { useRealtime } from "@/hooks/use-realtime";
import { useCameraPublisher } from "@/hooks/use-camera-publisher";
import { api } from "@/lib/api-client";
import {
  MAX_TAB_SWITCHES,
  OPTION_LETTERS,
  QUESTIONS_PER_SECTION,
  SECTION_ORDER,
  sectionName,
  sectionShort,
} from "@/lib/exam";
import type { AttemptState, ChatLine } from "@/lib/types";
import type { ClientMessage } from "@/lib/realtime-protocol";

type Pending = "section" | "submit" | null;

export function ExamRunner({
  initialState,
  roomCode,
}: {
  initialState: AttemptState;
  roomCode?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [index, setIndex] = useState(initialState.currentIndex);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabWarning, setTabWarning] = useState(false);
  const sectionRef = useRef(initialState.currentSection);

  const live = Boolean(roomCode);
  const attemptId = state.attemptId;

  /* ------------------------------- realtime ------------------------------- */
  // The socket is created below, so the camera talks to it through a stable
  // reference rather than being torn down whenever the connection changes.
  const sendRef = useRef<(msg: ClientMessage) => void>(() => {});
  const sendMessage = useCallback((msg: ClientMessage) => sendRef.current(msg), []);

  const camera = useCameraPublisher({
    enabled: live && state.status === "IN_PROGRESS",
    send: sendMessage,
  });

  const cameraHandler = useRef(camera.handleMessage);
  cameraHandler.current = camera.handleMessage;

  const { send } = useRealtime({
    enabled: true,
    roomCode: roomCode ?? null,
    attemptId,
    onMessage: useCallback((msg) => {
      if (msg.t === "attempt") {
        setState(msg.state);
        return;
      }
      if (msg.t === "chat") {
        setChat((prev) => (prev.some((l) => l.id === msg.line.id) ? prev : [...prev, msg.line]));
        return;
      }
      cameraHandler.current(msg);
    }, []),
  });
  sendRef.current = send;

  useEffect(() => {
    if (!live) return;
    api<{ lines: ChatLine[] }>(`/api/attempts/${attemptId}/chat`)
      .then((data) => setChat(data.lines))
      .catch(() => {});
  }, [attemptId, live]);

  /* --------------------------- state transitions --------------------------- */
  // A new section means a new set of 25; start at the top of it.
  useEffect(() => {
    if (state.currentSection !== sectionRef.current) {
      sectionRef.current = state.currentSection;
      setIndex(0);
    }
  }, [state.currentSection]);

  useEffect(() => {
    if (state.status === "SUBMITTED") router.replace(`/results/${attemptId}`);
  }, [state.status, attemptId, router]);

  const refresh = useCallback(async () => {
    try {
      const { state: fresh } = await api<{ state: AttemptState }>(`/api/attempts/${attemptId}`);
      setState(fresh);
    } catch {
      /* the websocket will catch us up */
    }
  }, [attemptId]);

  /* --------------------------- leaving the window --------------------------- */
  useEffect(() => {
    if (!live || state.status !== "IN_PROGRESS") return;
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      sendRef.current({ t: "tab-switch" });
      setTabWarning(true);
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [live, state.status]);

  /* -------------------------------- answering ------------------------------- */
  const sectionQuestions = useMemo(
    () =>
      state.questions.slice(
        state.currentSection * QUESTIONS_PER_SECTION,
        (state.currentSection + 1) * QUESTIONS_PER_SECTION,
      ),
    [state.questions, state.currentSection],
  );

  const question = sectionQuestions[index];

  const patch = useCallback(
    async (body: { order: number; selected?: number | null; marked?: boolean; currentIndex?: number }) => {
      // Optimistic: the paper must feel instant even on a slow connection.
      setState((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.order === body.order
            ? {
                ...q,
                selected: body.selected !== undefined ? body.selected : q.selected,
                marked: body.marked !== undefined ? body.marked : q.marked,
              }
            : q,
        ),
      }));
      try {
        const { state: fresh } = await api<{ state: AttemptState }>(
          `/api/attempts/${attemptId}/answer`,
          { method: "POST", body },
        );
        setState(fresh);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save that answer.");
        void refresh();
      }
    },
    [attemptId, refresh],
  );

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(QUESTIONS_PER_SECTION - 1, Math.max(0, next));
      setIndex(clamped);
      const target = sectionQuestions[clamped];
      if (target) void patch({ order: target.order, currentIndex: clamped });
    },
    [patch, sectionQuestions],
  );

  const submitSection = async () => {
    setBusy(true);
    try {
      const { state: fresh } = await api<{ state: AttemptState }>(
        `/api/attempts/${attemptId}/section`,
        { method: "POST" },
      );
      setState(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the section.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const submitPaper = async () => {
    setBusy(true);
    try {
      await api(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      router.replace(`/results/${attemptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the paper.");
      setBusy(false);
      setConfirming(null);
    }
  };

  /* -------------------------------- screens -------------------------------- */
  if (state.status === "SUBMITTED") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (state.status === "WAITING") {
    return (
      <div className="min-h-full">
        <AppHeader subtitle={state.room ? `Room ${state.room.code}` : undefined} />
        <main className="mx-auto max-w-lg px-5 py-20 text-center">
          <h1 className="font-display text-2xl tracking-tight text-ink">
            Waiting for the examiner to start
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            You are checked in for <strong className="text-ink">{state.room?.title}</strong>. Keep
            this tab open — the paper opens by itself the moment{" "}
            {state.room?.examinerName ?? "your examiner"} starts the exam.
          </p>
          <div className="mt-8">
            <SelfCamera status={camera.status} videoRef={camera.videoRef} />
          </div>
        </main>
      </div>
    );
  }

  const answeredInSection = sectionQuestions.filter((q) => q.selected !== null).length;
  const isFinalSection = state.currentSection >= SECTION_ORDER.length - 1;
  const unanswered = QUESTIONS_PER_SECTION - answeredInSection;

  return (
    <div className="min-h-full">
      <AppHeader
        compact
        subtitle={state.room ? `Room ${state.room.code}` : "Practice paper"}
        right={
          <ExamTimer remainingMs={state.remainingMs} paused={state.paused} onExpire={refresh} />
        }
      />

      <SectionStepper current={state.currentSection} />

      <main className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {state.paused ? (
            <Notice tone="warn">
              The examiner has paused this exam. Your clock is frozen — stay on this page.
            </Notice>
          ) : null}
          {tabWarning ? (
            <Notice tone="bad">
              You left the exam window. This is recorded and shown to the examiner (
              {state.tabSwitches} of {MAX_TAB_SWITCHES} allowed).{" "}
              <button className="underline" onClick={() => setTabWarning(false)}>
                Dismiss
              </button>
            </Notice>
          ) : null}
          {error ? <Notice tone="bad">{error}</Notice> : null}

          <Panel>
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div className="text-[13px] font-medium text-ink-2">
                Question <span className="tabular text-ink">{index + 1}</span> of{" "}
                {QUESTIONS_PER_SECTION}
              </div>
              <div className="flex items-center gap-2">
                {question?.marked ? <Badge tone="warn">Marked for review</Badge> : null}
                <span className="text-[12px] text-ink-3">+2 correct &middot; &minus;0.5 wrong</span>
              </div>
            </div>

            {question ? (
              <div className="px-5 py-5">
                <p className="text-[17px] leading-relaxed text-ink">{question.text}</p>

                <div className="mt-5 space-y-2">
                  {question.options.map((option, i) => {
                    const selected = question.selected === i;
                    return (
                      <button
                        key={i}
                        onClick={() => void patch({ order: question.order, selected: i })}
                        className={cx(
                          "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-[15px] transition-colors",
                          selected
                            ? "border-accent bg-accent-soft text-ink ring-1 ring-accent"
                            : "border-line-strong bg-surface hover:bg-subtle",
                        )}
                      >
                        <span
                          className={cx(
                            "mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                            selected
                              ? "border-accent bg-accent text-white"
                              : "border-line-strong text-ink-3",
                          )}
                        >
                          {OPTION_LETTERS[i]}
                        </span>
                        <span className="leading-relaxed">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-[13px] text-ink-3">
                This section has no question at that position.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={index === 0} onClick={() => goTo(index - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    question && void patch({ order: question.order, marked: !question.marked })
                  }
                >
                  {question?.marked ? "Unmark" : "Mark for review"}
                </Button>
                <Button
                  size="sm"
                  disabled={!question || question.selected === null}
                  onClick={() => question && void patch({ order: question.order, selected: null })}
                >
                  Clear
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={index >= QUESTIONS_PER_SECTION - 1}
                  onClick={() => goTo(index + 1)}
                >
                  Next
                </Button>
                <Button
                  size="sm"
                  variant={isFinalSection ? "danger" : "secondary"}
                  onClick={() => setConfirming(isFinalSection ? "submit" : "section")}
                >
                  {isFinalSection ? "Submit paper" : "Submit section"}
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel>
            <PanelHeader
              title="Questions"
              meta={`${answeredInSection} of ${QUESTIONS_PER_SECTION} answered`}
            />
            <div className="px-4 py-4">
              <QuestionPalette questions={sectionQuestions} currentIndex={index} onJump={goTo} />
            </div>
          </Panel>

          {live ? (
            <>
              <Panel>
                <PanelHeader
                  title="Invigilation"
                  meta={
                    camera.watcherCount > 0
                      ? "The examiner is watching your camera"
                      : "Your camera is available to the examiner"
                  }
                />
                <div className="px-4 py-4">
                  <SelfCamera status={camera.status} videoRef={camera.videoRef} />
                </div>
              </Panel>

              <Panel className="flex flex-col">
                <PanelHeader title="Examiner" meta={state.room?.examinerName} />
                <ChatPanel
                  lines={chat}
                  side="CANDIDATE"
                  height="h-56"
                  emptyHint="Message your examiner if something goes wrong."
                  onSend={(body) => send({ t: "chat", attemptId, body })}
                />
              </Panel>
            </>
          ) : null}
        </aside>
      </main>

      <ConfirmDialog
        open={confirming === "section"}
        title={`Submit ${sectionName(state.currentSection)}?`}
        body={
          <>
            The next section starts on a fresh {state.sectionMinutes}-minute clock and you cannot
            come back to this one.
            {unanswered > 0 ? (
              <>
                {" "}
                <strong className="text-ink">
                  {unanswered} question{unanswered === 1 ? " is" : "s are"} still unanswered.
                </strong>
              </>
            ) : null}
          </>
        }
        confirmLabel={busy ? "Submitting…" : "Submit section"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void submitSection()}
      />

      <ConfirmDialog
        open={confirming === "submit"}
        tone="danger"
        title="Submit the whole paper?"
        body={
          <>
            Your paper will be marked immediately and you will not be able to change any answer.
            {unanswered > 0 ? (
              <>
                {" "}
                <strong className="text-ink">
                  {unanswered} question{unanswered === 1 ? " is" : "s are"} still unanswered in this
                  section.
                </strong>
              </>
            ) : null}
          </>
        }
        confirmLabel={busy ? "Submitting…" : "Submit paper"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void submitPaper()}
      />
    </div>
  );
}

/** Where the candidate is in the paper — four steps, no decoration. */
function SectionStepper({ current }: { current: number }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-5">
        {SECTION_ORDER.map((_, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div
              key={i}
              className={cx(
                "flex shrink-0 items-center gap-2 border-b-2 py-2.5 text-[13px]",
                active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3",
              )}
            >
              <span className="tabular text-[11px] font-semibold text-ink-3">{i + 1}</span>
              <span className={done ? "line-through decoration-ink-3/60" : undefined}>
                {sectionShort(i)}
              </span>
              {done ? <span className="text-[11px] text-ink-3">closed</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
