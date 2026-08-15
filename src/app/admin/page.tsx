"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { AppHeader } from "@/components/app-header";
import { Wordmark } from "@/components/wordmark";
import { RoomBadge } from "@/components/admin/room-badge";
import { Button, EmptyState, Input, Notice, Panel, PanelHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";
import { APP_NAME } from "@/lib/brand";
import type { RoomView } from "@/lib/types";

export default function AdminPage() {
  const { ready, session } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (session?.role !== "EXAMINER") return <ExaminerLogin />;

  return <RoomList />;
}

/**
 * Examiners share one username and password rather than a personal account:
 * the console has to open on any device that happens to be to hand, and more
 * than one person may be invigilating the same room at the same time.
 */
function ExaminerLogin() {
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
            <span className="eyebrow">Username</span>
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
            <span className="eyebrow">Password</span>
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

function RoomList() {
  const [rooms, setRooms] = useState<RoomView[] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ rooms: RoomView[] }>("/api/rooms")
      .then((data) => setRooms(data.rooms))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load rooms."));
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { room } = await api<{ room: RoomView }>("/api/rooms", {
        method: "POST",
        body: { title: title.trim() || undefined },
      });
      setRooms((prev) => [room, ...(prev ?? [])]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full">
      <AppHeader subtitle="Examiner console" />
      <main className="mx-auto max-w-4xl space-y-5 px-5 py-9">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Rooms</h1>
          <p className="mt-1.5 text-[14px] text-ink-2">
            Each room has a code. Candidates enter it to join, and you start the paper once everyone
            is in.
          </p>
        </div>

        <Panel>
          <PanelHeader title="New room" />
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <Input
              value={title}
              placeholder="Paper name (optional) — e.g. Sunday full mock"
              className="min-w-60 flex-1"
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <Button variant="primary" disabled={busy} onClick={create}>
              {busy ? <Spinner /> : null}
              Create room
            </Button>
          </div>
          {error ? (
            <div className="px-5 pb-4">
              <Notice tone="bad">{error}</Notice>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader title="Your rooms" />
          {rooms === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : rooms.length === 0 ? (
            <EmptyState title="No rooms yet" hint="Create one above to get a code you can share." />
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
                      <div className="mt-0.5 truncate text-[13px] text-ink-2">{room.title}</div>
                    </div>
                    <div className="shrink-0 text-right text-[12px] text-ink-3">
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
      </main>
    </div>
  );
}
