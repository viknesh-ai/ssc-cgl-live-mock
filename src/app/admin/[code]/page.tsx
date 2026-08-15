"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { AppHeader } from "@/components/app-header";
import { CandidateTable } from "@/components/admin/candidate-table";
import { CameraViewer } from "@/components/admin/camera-viewer";
import { AnswerSheet } from "@/components/admin/answer-sheet";
import { RoomBadge } from "@/components/admin/room-badge";
import { ChatPanel } from "@/components/exam/chat-panel";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Notice,
  Panel,
  PanelHeader,
  Spinner,
  Stat,
  StatRow,
} from "@/components/ui";
import { useRealtime } from "@/hooks/use-realtime";
import { useCameraViewer } from "@/hooks/use-camera-viewer";
import { api } from "@/lib/api-client";
import { sectionShort } from "@/lib/exam";
import type { CandidateLive, CandidateSheet, ChatLine, RoomView } from "@/lib/types";
import type { ClientMessage } from "@/lib/realtime-protocol";

export default function AdminRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const roomCode = code.toUpperCase();
  const { ready, session } = useAuth();

  const [room, setRoom] = useState<RoomView | null>(null);
  const [candidates, setCandidates] = useState<CandidateLive[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<CandidateSheet | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /* ------------------------------- realtime ------------------------------- */
  const sendRef = useRef<(msg: ClientMessage) => void>(() => {});
  const sendMessage = useCallback((msg: ClientMessage) => sendRef.current(msg), []);
  const viewer = useCameraViewer({ send: sendMessage });
  const viewerRef = useRef(viewer.handleMessage);
  viewerRef.current = viewer.handleMessage;

  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selectedId;

  const { send, connected } = useRealtime({
    enabled: session?.role === "EXAMINER",
    roomCode,
    onMessage: useCallback((msg) => {
      if (msg.t === "room") {
        setRoom(msg.room);
        setCandidates(msg.candidates);
        return;
      }
      if (msg.t === "chat") {
        if (msg.line.attemptId !== selectedRef.current) return;
        setChat((prev) => (prev.some((l) => l.id === msg.line.id) ? prev : [...prev, msg.line]));
        return;
      }
      viewerRef.current(msg);
    }, []),
  });
  sendRef.current = send;

  useEffect(() => {
    if (session?.role !== "EXAMINER") return;
    api<{ room: RoomView; candidates: CandidateLive[] }>(`/api/rooms/${roomCode}`)
      .then((data) => {
        setRoom(data.room);
        setCandidates(data.candidates);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not open this room."));
  }, [roomCode, session]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const selected = useMemo(
    () => candidates.find((c) => c.attemptId === selectedId) ?? null,
    [candidates, selectedId],
  );

  // Pick the first candidate automatically so the panels are never empty.
  useEffect(() => {
    if (selectedId === null && candidates.length > 0) setSelectedId(candidates[0].attemptId);
  }, [candidates, selectedId]);

  // Their paper is refetched whenever they answer or move, so the sheet tracks them.
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    api<{ sheet: CandidateSheet }>(`/api/attempts/${selectedId}/sheet`)
      .then((data) => active && setSheet(data.sheet))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedId, selected?.answered, selected?.currentIndex, selected?.currentSection]);

  useEffect(() => {
    if (!selectedId) return;
    setChat([]);
    api<{ lines: ChatLine[] }>(`/api/attempts/${selectedId}/chat`)
      .then((data) => setChat(data.lines))
      .catch(() => {});
  }, [selectedId]);

  const control = async (action: "start" | "pause" | "resume" | "end") => {
    setBusy(true);
    setError(null);
    try {
      const { room: updated } = await api<{ room: RoomView }>(`/api/rooms/${roomCode}/control`, {
        method: "POST",
        body: { action },
      });
      setRoom(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That control failed.");
    } finally {
      setBusy(false);
      setConfirmEnd(false);
    }
  };

  const copyLink = async () => {
    const link = `${window.location.origin}/exam/${roomCode}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (session?.role !== "EXAMINER") {
    return (
      <div className="min-h-full">
        <AppHeader />
        <main className="mx-auto max-w-md px-5 py-20">
          <Notice tone="bad">Examiner access only.</Notice>
          <div className="mt-5">
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const active = candidates.filter((c) => c.status !== "SUBMITTED").length;

  return (
    <div className="min-h-full">
      <AppHeader
        compact
        subtitle={room?.title}
        right={
          <span className="flex items-center gap-2 text-[12px] text-ink-3">
            <span className={connected ? "text-ok" : "text-warn"}>
              {connected ? "Connected" : "Reconnecting…"}
            </span>
          </span>
        }
      />

      <main className="mx-auto max-w-[1500px] space-y-4 px-5 py-5">
        {error ? <Notice tone="bad">{error}</Notice> : null}

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-semibold tracking-[0.2em] text-ink">
                {roomCode}
              </span>
              {room ? <RoomBadge status={room.status} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={copyLink}>
                {copied ? "Link copied" : "Copy candidate link"}
              </Button>
              {room?.status === "WAITING" || room?.status === "ENDED" ? (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy || room.status === "ENDED"}
                  onClick={() => void control("start")}
                >
                  Start exam
                </Button>
              ) : null}
              {room?.status === "RUNNING" ? (
                <Button size="sm" disabled={busy} onClick={() => void control("pause")}>
                  Pause
                </Button>
              ) : null}
              {room?.status === "PAUSED" ? (
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void control("resume")}>
                  Resume
                </Button>
              ) : null}
              {room && room.status !== "ENDED" ? (
                <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirmEnd(true)}>
                  End exam
                </Button>
              ) : null}
            </div>
          </div>

          <StatRow>
            <Stat label="Candidates" value={candidates.length} />
            <Stat label="Still writing" value={active} />
            <Stat
              label="Started"
              value={
                room?.startedAt
                  ? new Date(room.startedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"
              }
            />
            <Stat
              label="Flags raised"
              value={candidates.reduce((n, c) => n + c.tabSwitches, 0)}
              tone={candidates.some((c) => c.tabSwitches > 0) ? "bad" : "default"}
            />
          </StatRow>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Candidates" meta="Select a candidate to watch them." />
              <CandidateTable
                candidates={candidates}
                selectedId={selectedId}
                onSelect={setSelectedId}
                now={now}
              />
            </Panel>

            <Panel>
              <PanelHeader
                title="Live answer sheet"
                meta={
                  selected
                    ? `${selected.name} — ${sectionShort(selected.currentSection)}, question ${selected.currentIndex + 1}`
                    : undefined
                }
              />
              {sheet && selected ? (
                <AnswerSheet sheet={sheet} />
              ) : (
                <EmptyState title="No candidate selected" />
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <PanelHeader
                title={selected ? selected.name : "Proctoring"}
                meta={selected ? selected.email : "Select a candidate first."}
              />
              {selected ? (
                <CameraViewer
                  candidateName={selected.name}
                  status={viewer.watching === selected.attemptId ? viewer.status : "off"}
                  message={viewer.watching === selected.attemptId ? viewer.message : null}
                  stream={viewer.watching === selected.attemptId ? viewer.stream : null}
                  frame={viewer.watching === selected.attemptId ? viewer.frame : null}
                  watching={viewer.watching === selected.attemptId}
                  onWatch={() => viewer.watch(selected.attemptId)}
                  onStop={viewer.stop}
                />
              ) : (
                <EmptyState title="No candidate selected" />
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Message candidate" />
              {selected ? (
                <ChatPanel
                  lines={chat}
                  side="EXAMINER"
                  height="h-64"
                  placeholder={`Message ${selected.name.split(" ")[0]}`}
                  emptyHint="Nothing said yet."
                  onSend={(body) => send({ t: "chat", attemptId: selected.attemptId, body })}
                />
              ) : (
                <EmptyState title="No candidate selected" />
              )}
            </Panel>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={confirmEnd}
        tone="danger"
        title="End this exam?"
        body="Every paper still open will be submitted and marked as it stands. This cannot be undone."
        confirmLabel={busy ? "Ending…" : "End exam"}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => void control("end")}
      />
    </div>
  );
}
