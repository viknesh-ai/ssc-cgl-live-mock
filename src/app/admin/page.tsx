"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { AppHeader } from "@/components/app-header";
import { Button, EmptyState, Input, Notice, Panel, PanelHeader, Spinner } from "@/components/ui";
import { RoomBadge } from "@/components/admin/room-badge";
import { api } from "@/lib/api-client";
import type { RoomView } from "@/lib/types";

export default function AdminPage() {
  const { ready, session, signIn } = useAuth();
  const [rooms, setRooms] = useState<RoomView[] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.role !== "EXAMINER") return;
    api<{ rooms: RoomView[] }>("/api/rooms")
      .then((data) => setRooms(data.rooms))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load rooms."));
  }, [session]);

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
          <h1 className="text-xl font-semibold tracking-tight text-ink">Examiner sign-in</h1>
          <p className="mt-2 text-[14px] text-ink-2">
            Sign in with the Google account registered as the examiner for this deployment.
          </p>
          <div className="mt-6">
            <Button variant="primary" onClick={() => void signIn()}>
              Continue with Google
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (session.role !== "EXAMINER") {
    return (
      <div className="min-h-full">
        <AppHeader />
        <main className="mx-auto max-w-md px-5 py-20">
          <Notice tone="bad">
            {session.email} is not the examiner account for this deployment.
          </Notice>
          <div className="mt-5">
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <AppHeader subtitle="Examiner console" />
      <main className="mx-auto max-w-4xl space-y-5 px-5 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Rooms</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            Each room has a code. Candidates enter it to join, and you start the paper when everyone
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
                        <span className="font-mono text-[15px] font-semibold tracking-[0.15em] text-ink">
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
