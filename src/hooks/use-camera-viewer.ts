"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { iceServers } from "@/lib/webrtc";
import type { ClientMessage, ServerMessage } from "@/lib/realtime-protocol";

type ViewerStatus = "off" | "connecting" | "live" | "frames" | "unavailable";

/**
 * Examiner side of proctoring: asks one candidate to open their camera, answers
 * the offer they send back, and renders whichever arrives — a live track, or
 * the still frames used when a peer connection cannot be formed.
 */
export function useCameraViewer({ send }: { send: (msg: ClientMessage) => void }) {
  const [watching, setWatching] = useState<number | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("off");
  const [message, setMessage] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerRef = useRef<number | null>(null);
  const watchingRef = useRef<number | null>(null);

  const close = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    peerRef.current = null;
    setStream(null);
    setFrame(null);
  }, []);

  const stop = useCallback(() => {
    const attemptId = watchingRef.current;
    if (attemptId) send({ t: "camera-stop", attemptId });
    watchingRef.current = null;
    setWatching(null);
    setStatus("off");
    setMessage(null);
    close();
  }, [close, send]);

  const watch = useCallback(
    (attemptId: number) => {
      if (watchingRef.current && watchingRef.current !== attemptId) {
        send({ t: "camera-stop", attemptId: watchingRef.current });
        close();
      }
      watchingRef.current = attemptId;
      setWatching(attemptId);
      setStatus("connecting");
      setMessage(null);
      send({ t: "camera-request", attemptId });
    },
    [close, send],
  );

  useEffect(() => close, [close]);

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      const attemptId = watchingRef.current;
      if (!attemptId) return;

      if (msg.t === "snapshot") {
        if (msg.attemptId !== attemptId) return;
        setFrame(msg.data);
        setStatus("frames");
        return;
      }
      if (msg.t !== "signal" || msg.fromAttemptId !== attemptId) return;

      const payload = msg.payload;
      if (payload.kind === "unavailable") {
        setStatus("unavailable");
        setMessage(payload.reason);
        return;
      }
      if (payload.kind === "fallback") {
        setStatus("frames");
        setMessage("Direct video is blocked on this network — showing still frames.");
        pcRef.current?.close();
        pcRef.current = null;
        return;
      }
      if (payload.kind === "offer") {
        peerRef.current = msg.fromPeerId;
        void acceptOffer(payload.sdp, msg.fromPeerId, attemptId);
        return;
      }
      if (payload.kind === "ice") {
        void pcRef.current?.addIceCandidate(payload.candidate).catch(() => {});
      }
    },
    // acceptOffer is defined below and closed over stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function acceptOffer(sdp: string, peerId: number, attemptId: number) {
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      setStream(event.streams[0] ?? null);
      setStatus("live");
      setMessage(null);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({
          t: "signal",
          toAttemptId: attemptId,
          payload: { kind: "ice", candidate: event.candidate.toJSON() },
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setStatus("frames");
    };

    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ t: "signal", toAttemptId: attemptId, payload: { kind: "answer", sdp: answer.sdp ?? "" } });
    void peerId;
  }

  return { watching, status, message, stream, frame, watch, stop, handleMessage };
}
