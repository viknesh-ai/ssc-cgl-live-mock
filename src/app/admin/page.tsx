"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConsoleShell } from "@/components/admin/console-shell";
import { RoomBadge } from "@/components/admin/room-badge";
import { Button, EmptyState, Input, Notice, Panel, PanelHeader, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { PaperSummary, RoomView } from "@/lib/types";

export default function SessionsPage() {
  const [rooms, setRooms] = useState<RoomView[] | null>(null);
  const [papers, setPapers] = useState<PaperSummary[] | null>(null);
  const [paperId, setPaperId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ rooms: RoomView[] }>("/api/rooms")
      .then((data) => setRooms(data.rooms))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load sessions."));
    api<{ papers: PaperSummary[] }>("/api/papers")
      .then((data) => {
        const live = data.papers.filter((p) => !p.archived);
        setPapers(live);
        setPaperId(live[0]?.id ?? null);
      })
      .catch(() => setPapers([]));
  }, []);

  const create = async () => {
    if (!paperId) return;
    setBusy(true);
    setError(null);
    try {
      const { room } = await api<{ room: RoomView }>("/api/rooms", {
        method: "POST",
        body: { paperId, title: title.trim() || undefined },
      });
      setRooms((prev) => [room, ...(prev ?? [])]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a session.");
    } finally {
      setBusy(false);
    }
  };

  const chosen = papers?.find((p) => p.id === paperId);
  const short = chosen?.sections.find((s) => s.available < s.questionCount);

  return (
    <ConsoleShell
      title="Sessions"
      description="A session runs one paper for a group of candidates. Share its code; start it when everyone is in."
    >
      <div className="space-y-5">
        <Panel>
          <PanelHeader title="New session" />
          <div className="space-y-3 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow block">Paper</span>
                {papers === null ? (
                  <div className="mt-1.5 flex h-9.5 items-center">
                    <Spinner />
                  </div>
                ) : papers.length === 0 ? (
                  <p className="mt-2 text-[13px] text-ink-2">
                    No papers yet —{" "}
                    <Link href="/admin/papers" className="text-accent underline">
                      create one first
                    </Link>
                    .
                  </p>
                ) : (
                  <select
                    value={paperId ?? ""}
                    onChange={(e) => setPaperId(Number(e.target.value))}
                    className="mt-1.5 h-9.5 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
                  >
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.examName}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="block">
                <span className="eyebrow block">Session name (optional)</span>
                <Input
                  value={title}
                  placeholder={chosen ? chosen.name : "e.g. Sunday full mock"}
                  className="mt-1.5"
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                />
              </label>
            </div>

            {chosen ? (
              <p className="text-[12.5px] text-ink-3">
                {chosen.totalQuestions} questions · {chosen.totalMinutes} minutes ·{" "}
                {chosen.maxScore} marks
              </p>
            ) : null}

            {short ? (
              <Notice tone="warn">
                {short.name} needs {short.questionCount} published questions but the bank has{" "}
                {short.available}. Add more in the question bank before running this paper.
              </Notice>
            ) : null}

            <div>
              <Button variant="primary" disabled={busy || !paperId} onClick={create}>
                {busy ? <Spinner /> : null}
                Create session
              </Button>
            </div>
          </div>
          {error ? (
            <div className="px-5 pb-4">
              <Notice tone="bad">{error}</Notice>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader title="All sessions" />
          {rooms === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : rooms.length === 0 ? (
            <EmptyState title="No sessions yet" hint="Create one above to get a code you can share." />
          ) : (
            <ul className="divide-y divide-line">
              {rooms.map((room) => (
                <li key={room.code}>
                  <Link
                    href={`/admin/${room.code}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-subtle"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[15px] font-semibold tracking-[0.18em] text-ink">
                          {room.code}
                        </span>
                        <RoomBadge status={room.status} />
                      </div>
                      <div className="mt-0.5 truncate text-[13px] text-ink-2">
                        {room.title}
                        <span className="text-ink-3"> · {room.paperName}</span>
                      </div>
                    </div>
                    <div className={cx("shrink-0 text-right text-[12px] text-ink-3")}>
                      <div>
                        {room.candidateCount} candidate{room.candidateCount === 1 ? "" : "s"}
                      </div>
                      <div>
                        {new Date(room.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </ConsoleShell>
  );
}
