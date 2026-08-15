/**
 * Websocket endpoint behind the Next.js server.
 *
 * Carries three things: live exam state to examiners and candidates, the
 * examiner/candidate chat, and WebRTC signalling for the proctoring camera
 * (plus the snapshot frames used when a peer connection cannot be formed).
 */
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { prisma } from "@/lib/prisma";
import { userFromClaims, verifyIdToken } from "@/lib/auth-server";
import { sessionCookieFrom, userFromSessionToken } from "@/lib/admin-session";
import { WS_PATH, type ClientMessage, type ServerMessage } from "@/lib/realtime-protocol";
import { hub, type Connection } from "@/server/hub";

const MAX_CHAT_LENGTH = 400;
/** Snapshot frames are small JPEGs; anything larger is a client bug or abuse. */
const MAX_SNAPSHOT_BYTES = 400_000;
const TICK_MS = 5_000;

export function attachRealtime(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== WS_PATH) return; // Next.js keeps HMR on its own paths.

    // The token is checked before the handshake completes, so an unauthenticated
    // client never gets a socket at all.
    void (async () => {
      const session = await authenticate(url, req.headers.cookie).catch((err) => {
        console.error("[ws] auth failed", err);
        return null;
      });
      if (!session) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        void onConnection(ws, session).catch((err) => {
          console.error("[ws] connection failed", err);
          ws.close(1011, "server error");
        });
      });
    })();
  });

  const ticker = setInterval(() => {
    void tick();
  }, TICK_MS);
  ticker.unref?.();

  return wss;
}

/** Keeps countdowns honest: sections close on time even if nobody clicks. */
async function tick() {
  try {
    for (const roomId of hub.activeRoomIds()) {
      await hub.publishRoom(roomId);
      await hub.publishRoomCandidates(roomId);
    }
    // Solo candidates have no room, so refresh them individually.
    const solo = hub.all().filter((c) => c.role === "CANDIDATE" && !c.roomId && c.attemptId);
    for (const conn of new Set(solo.map((c) => c.attemptId!))) {
      await hub.publishAttempt(conn);
    }
  } catch (err) {
    console.error("[ws] tick", err);
  }
}

type Session = {
  userId: number;
  userName: string;
  role: "EXAMINER" | "CANDIDATE";
  roomId: number | null;
  attemptId: number | null;
};

/** Resolves who is connecting and what they are allowed to watch. */
async function authenticate(url: URL, cookieHeader?: string): Promise<Session | null> {
  // Examiners arrive with a session cookie, candidates with a Firebase token.
  const examiner = await userFromSessionToken(sessionCookieFrom(cookieHeader));
  let user = examiner;
  if (!user) {
    const claims = await verifyIdToken(url.searchParams.get("token"));
    if (!claims) return null;
    user = await userFromClaims(claims);
  }

  const roomCode = url.searchParams.get("room")?.toUpperCase() || null;
  const attemptParam = Number(url.searchParams.get("attempt")) || null;

  const room = roomCode ? await prisma.room.findUnique({ where: { code: roomCode } }) : null;
  if (roomCode && !room) return null;

  const role = user.role === "EXAMINER" ? "EXAMINER" : "CANDIDATE";
  let attemptId: number | null = null;

  if (role === "CANDIDATE") {
    // A candidate may only attach to their own paper.
    const attempt = room
      ? await prisma.attempt.findUnique({
          where: { roomId_userId: { roomId: room.id, userId: user.id } },
          select: { id: true },
        })
      : attemptParam
        ? await prisma.attempt.findFirst({
            where: { id: attemptParam, userId: user.id },
            select: { id: true },
          })
        : null;
    if (!attempt) return null;
    attemptId = attempt.id;
  }

  return { userId: user.id, userName: user.name, role, roomId: room?.id ?? null, attemptId };
}

async function onConnection(ws: WebSocket, session: Session) {
  const { role, attemptId } = session;

  const conn: Connection = {
    peerId: hub.allocatePeerId(),
    role,
    userId: session.userId,
    userName: session.userName,
    roomId: session.roomId,
    attemptId,
    cameraOn: false,
    send: (msg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
  hub.add(conn);

  conn.send({ t: "ready", peerId: conn.peerId, role, attemptId });
  if (conn.roomId) await hub.publishRoom(conn.roomId);
  if (attemptId) await hub.publishAttempt(attemptId);

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    void handleMessage(conn, msg).catch((err) => {
      console.error("[ws] message", err);
      conn.send({ t: "error", message: "Could not process that request." });
    });
  });

  ws.on("close", () => {
    hub.remove(conn.peerId);
    if (conn.roomId) void hub.publishRoom(conn.roomId);
  });
}

async function handleMessage(conn: Connection, msg: ClientMessage) {
  switch (msg.t) {
    case "ping":
      conn.send({ t: "pong" });
      return;

    case "camera-state": {
      conn.cameraOn = Boolean(msg.on);
      if (conn.roomId) await hub.publishRoom(conn.roomId);
      return;
    }

    case "tab-switch": {
      if (conn.role !== "CANDIDATE" || !conn.attemptId) return;
      await prisma.attempt.update({
        where: { id: conn.attemptId },
        data: { tabSwitches: { increment: 1 } },
      });
      if (conn.roomId) await hub.publishRoom(conn.roomId);
      await hub.publishAttempt(conn.attemptId);
      return;
    }

    case "camera-request": {
      if (conn.role !== "EXAMINER") return;
      if (!(await examinerOwns(conn, msg.attemptId))) return;
      hub.sendToAttempt(msg.attemptId, { t: "camera-request", peerId: conn.peerId });
      return;
    }

    case "camera-stop": {
      if (conn.role !== "EXAMINER") return;
      hub.sendToAttempt(msg.attemptId, { t: "camera-stop", peerId: conn.peerId });
      return;
    }

    case "signal": {
      const target = await resolveTarget(conn, msg.toAttemptId, msg.toPeerId);
      if (!target) return;
      const relay: ServerMessage = {
        t: "signal",
        fromPeerId: conn.peerId,
        fromAttemptId: conn.attemptId,
        payload: msg.payload,
      };
      if (typeof target === "number") hub.sendTo(target, relay);
      else hub.sendToAttempt(target.attemptId, relay);
      return;
    }

    case "snapshot": {
      if (conn.role !== "CANDIDATE" || !conn.attemptId || !conn.roomId) return;
      if (typeof msg.data !== "string" || msg.data.length > MAX_SNAPSHOT_BYTES) return;
      const frame: ServerMessage = { t: "snapshot", attemptId: conn.attemptId, data: msg.data };
      if (msg.toPeerId) hub.sendTo(msg.toPeerId, frame);
      else hub.sendToExaminers(conn.roomId, frame);
      return;
    }

    case "chat": {
      const body = String(msg.body ?? "").trim().slice(0, MAX_CHAT_LENGTH);
      if (!body) return;

      const attempt = await prisma.attempt.findUnique({
        where: { id: msg.attemptId },
        select: { id: true, userId: true, roomId: true },
      });
      if (!attempt?.roomId) return;
      const allowed =
        conn.role === "EXAMINER" ? conn.roomId === attempt.roomId : attempt.userId === conn.userId;
      if (!allowed) return;

      const saved = await prisma.chatMessage.create({
        data: {
          roomId: attempt.roomId,
          attemptId: attempt.id,
          senderId: conn.userId,
          fromExaminer: conn.role === "EXAMINER",
          body,
        },
      });
      const line: ServerMessage = {
        t: "chat",
        line: {
          id: saved.id,
          attemptId: attempt.id,
          body: saved.body,
          fromExaminer: saved.fromExaminer,
          senderName: conn.userName,
          createdAt: saved.createdAt.toISOString(),
        },
      };
      hub.sendToAttempt(attempt.id, line);
      hub.sendToExaminers(attempt.roomId, line);
      return;
    }
  }
}

async function examinerOwns(conn: Connection, attemptId: number) {
  if (!conn.roomId) return false;
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { roomId: true },
  });
  return attempt?.roomId === conn.roomId;
}

/** Signalling only ever crosses between an examiner and a candidate they watch. */
async function resolveTarget(
  conn: Connection,
  toAttemptId?: number,
  toPeerId?: number,
): Promise<number | { attemptId: number } | null> {
  if (conn.role === "EXAMINER") {
    if (!toAttemptId || !(await examinerOwns(conn, toAttemptId))) return null;
    return { attemptId: toAttemptId };
  }
  if (!toPeerId) return null;
  const target = hub.get(toPeerId);
  if (!target || target.role !== "EXAMINER") return null;
  if (conn.roomId && target.roomId !== conn.roomId) return null;
  return toPeerId;
}
