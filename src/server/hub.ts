/**
 * In-process registry of live connections.
 *
 * The websocket server and the REST routes run in the same Node process, so a
 * route that changes exam state can push the new state straight to whoever is
 * watching. Connections are held behind a small interface, which keeps the
 * `ws` dependency out of everything except the socket server itself.
 */
import { getAttempt, specOf, syncClock, toAttemptState, toCandidateLive } from "@/lib/attempt";
import { getPaperSpec } from "@/lib/paper";
import { fullRoom, roomAttempts, toRoomView } from "@/lib/room";
import type { ServerMessage } from "@/lib/realtime-protocol";

export type Connection = {
  peerId: number;
  role: "EXAMINER" | "CANDIDATE";
  userId: number;
  userName: string;
  roomId: number | null;
  /** Candidates only: the paper this connection belongs to. */
  attemptId: number | null;
  cameraOn: boolean;
  send: (msg: ServerMessage) => void;
  close: () => void;
};

class Hub {
  private nextPeerId = 1;
  private connections = new Map<number, Connection>();

  allocatePeerId() {
    return this.nextPeerId++;
  }

  add(conn: Connection) {
    this.connections.set(conn.peerId, conn);
  }

  remove(peerId: number) {
    this.connections.delete(peerId);
  }

  get(peerId: number) {
    return this.connections.get(peerId);
  }

  all() {
    return [...this.connections.values()];
  }

  examinersOf(roomId: number) {
    return this.all().filter((c) => c.role === "EXAMINER" && c.roomId === roomId);
  }

  candidatesOf(roomId: number) {
    return this.all().filter((c) => c.role === "CANDIDATE" && c.roomId === roomId);
  }

  connectionsFor(attemptId: number) {
    return this.all().filter((c) => c.attemptId === attemptId);
  }

  presenceOf(attemptId: number) {
    const conns = this.connectionsFor(attemptId);
    return {
      online: conns.length > 0,
      cameraOn: conns.some((c) => c.cameraOn),
    };
  }

  /** Rooms that at least one examiner or candidate is currently watching. */
  activeRoomIds() {
    const ids = new Set<number>();
    for (const c of this.connections.values()) if (c.roomId) ids.add(c.roomId);
    return [...ids];
  }

  /** Pushes the candidate table to every examiner watching the room. */
  async publishRoom(roomId: number) {
    const watchers = this.examinersOf(roomId);
    if (!watchers.length) return;

    const room = await fullRoom(roomId).catch(() => null);
    if (!room) return;

    // Every candidate in a room sits the same paper, so its shape is loaded once.
    const spec = await getPaperSpec(room.paperId);
    const attempts = await roomAttempts(roomId);
    const message: ServerMessage = {
      t: "room",
      room: toRoomView(room),
      candidates: attempts.map((a) => toCandidateLive(a, spec, this.presenceOf(a.id))),
    };
    for (const watcher of watchers) watcher.send(message);
  }

  /** Pushes fresh exam state to one candidate's open tabs. */
  async publishAttempt(attemptId: number) {
    const targets = this.connectionsFor(attemptId).filter((c) => c.role === "CANDIDATE");
    if (!targets.length) return;
    const attempt = await getAttempt(attemptId);
    if (!attempt) return;
    const synced = await syncClock(attempt);
    const message: ServerMessage = {
      t: "attempt",
      state: toAttemptState(synced, await specOf(synced)),
    };
    for (const target of targets) target.send(message);
  }

  /** Pushes fresh state to every candidate in a room (used by start/pause/end). */
  async publishRoomCandidates(roomId: number) {
    const ids = new Set(
      this.candidatesOf(roomId)
        .map((c) => c.attemptId)
        .filter((id): id is number => id !== null),
    );
    for (const id of ids) await this.publishAttempt(id);
  }

  sendTo(peerId: number, msg: ServerMessage) {
    this.get(peerId)?.send(msg);
  }

  sendToAttempt(attemptId: number, msg: ServerMessage) {
    for (const conn of this.connectionsFor(attemptId)) conn.send(msg);
  }

  sendToExaminers(roomId: number, msg: ServerMessage) {
    for (const conn of this.examinersOf(roomId)) conn.send(msg);
  }
}

const globalForHub = globalThis as unknown as { __examHub?: Hub };
export const hub = (globalForHub.__examHub ??= new Hub());
