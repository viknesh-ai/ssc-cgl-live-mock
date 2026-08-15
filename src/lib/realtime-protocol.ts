/** Message shapes for the /ws realtime channel, shared by browser and server. */
import type { AttemptState, CandidateLive, ChatLine, RoomView } from "@/lib/types";

export const WS_PATH = "/ws";

/** Sent by the browser. */
export type ClientMessage =
  | { t: "ping" }
  /** Candidate reports whether its camera is actually publishing. */
  | { t: "camera-state"; on: boolean }
  /** Candidate reports leaving the exam window. */
  | { t: "tab-switch" }
  /** Examiner asks a candidate to open a peer connection. */
  | { t: "camera-request"; attemptId: number }
  /** Examiner stops watching a candidate. */
  | { t: "camera-stop"; attemptId: number }
  /** WebRTC offer/answer/ICE relay. */
  | { t: "signal"; toAttemptId?: number; toPeerId?: number; payload: SignalPayload }
  /** Low-bandwidth fallback frame from a candidate, base64 JPEG data URL. */
  | { t: "snapshot"; toPeerId?: number; data: string }
  | { t: "chat"; attemptId: number; body: string };

export type SignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit }
  /** Candidate could not establish a peer connection; falling back to frames. */
  | { kind: "fallback" }
  /** Candidate has no camera available at all. */
  | { kind: "unavailable"; reason: string };

/** Sent by the server. */
export type ServerMessage =
  | { t: "ready"; peerId: number; role: "EXAMINER" | "CANDIDATE"; attemptId: number | null }
  | { t: "room"; room: RoomView; candidates: CandidateLive[] }
  | { t: "attempt"; state: AttemptState }
  | { t: "chat"; line: ChatLine }
  | { t: "camera-request"; peerId: number }
  | { t: "camera-stop"; peerId: number }
  | { t: "signal"; fromPeerId: number; fromAttemptId: number | null; payload: SignalPayload }
  | { t: "snapshot"; attemptId: number; data: string }
  | { t: "error"; message: string }
  | { t: "pong" };
