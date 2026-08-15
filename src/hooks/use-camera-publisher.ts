"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { iceServers, PEER_TIMEOUT_MS, SNAPSHOT_INTERVAL_MS, SNAPSHOT_WIDTH } from "@/lib/webrtc";
import type { ClientMessage, ServerMessage } from "@/lib/realtime-protocol";

type PublisherStatus = "idle" | "requesting" | "live" | "denied" | "unavailable";

type Watcher = {
  pc: RTCPeerConnection | null;
  snapshotTimer: ReturnType<typeof setInterval> | null;
  timeout: ReturnType<typeof setTimeout> | null;
};

/**
 * Candidate side of proctoring.
 *
 * Holds the camera open for the whole exam, answers an examiner's request with
 * a peer connection, and — if that connection cannot be established — keeps the
 * examiner supplied with still frames over the websocket instead.
 */
export function useCameraPublisher({
  enabled,
  send,
}: {
  enabled: boolean;
  send: (msg: ClientMessage) => void;
}) {
  const [status, setStatus] = useState<PublisherStatus>("idle");
  const [watcherCount, setWatcherCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchersRef = useRef(new Map<number, Watcher>());

  /* ------------------------------ the camera ------------------------------ */
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatus("requesting");

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("live");
        send({ t: "camera-state", on: true });
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setStatus(err.name === "NotAllowedError" ? "denied" : "unavailable");
        send({ t: "camera-state", on: false });
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      watchersRef.current.forEach((_, peerId) => teardown(peerId));
      send({ t: "camera-state", on: false });
    };
    // `send` is stable; re-running on it would drop the camera on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const teardown = useCallback((peerId: number) => {
    const watcher = watchersRef.current.get(peerId);
    if (!watcher) return;
    watcher.pc?.close();
    if (watcher.snapshotTimer) clearInterval(watcher.snapshotTimer);
    if (watcher.timeout) clearTimeout(watcher.timeout);
    watchersRef.current.delete(peerId);
    setWatcherCount(watchersRef.current.size);
  }, []);

  /** Grabs one small JPEG from the live preview. */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    const scale = SNAPSHOT_WIDTH / video.videoWidth;
    canvas.width = SNAPSHOT_WIDTH;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.5);
  }, []);

  const startSnapshots = useCallback(
    (peerId: number) => {
      const watcher = watchersRef.current.get(peerId);
      if (!watcher || watcher.snapshotTimer) return;
      watcher.pc?.close();
      watcher.pc = null;
      send({ t: "signal", toPeerId: peerId, payload: { kind: "fallback" } });
      watcher.snapshotTimer = setInterval(() => {
        const frame = captureFrame();
        if (frame) send({ t: "snapshot", toPeerId: peerId, data: frame });
      }, SNAPSHOT_INTERVAL_MS);
    },
    [captureFrame, send],
  );

  /* ------------------------------ signalling ------------------------------ */
  const openPeer = useCallback(
    async (peerId: number) => {
      const stream = streamRef.current;
      if (!stream) {
        send({
          t: "signal",
          toPeerId: peerId,
          payload: { kind: "unavailable", reason: status === "denied" ? "Camera permission denied" : "No camera" },
        });
        return;
      }
      teardown(peerId);

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const watcher: Watcher = { pc, snapshotTimer: null, timeout: null };
      watchersRef.current.set(peerId, watcher);
      setWatcherCount(watchersRef.current.size);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({ t: "signal", toPeerId: peerId, payload: { kind: "ice", candidate: event.candidate.toJSON() } });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected" && watcher.timeout) {
          clearTimeout(watcher.timeout);
          watcher.timeout = null;
        }
        if (pc.connectionState === "failed") startSnapshots(peerId);
      };

      // If the peer connection has not come up in time, the network is blocking
      // it — send frames instead of leaving the examiner with a black square.
      watcher.timeout = setTimeout(() => {
        if (pc.connectionState !== "connected") startSnapshots(peerId);
      }, PEER_TIMEOUT_MS);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ t: "signal", toPeerId: peerId, payload: { kind: "offer", sdp: offer.sdp ?? "" } });
    },
    [send, startSnapshots, status, teardown],
  );

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.t === "camera-request") {
        void openPeer(msg.peerId);
        return;
      }
      if (msg.t === "camera-stop") {
        teardown(msg.peerId);
        return;
      }
      if (msg.t !== "signal") return;

      const watcher = watchersRef.current.get(msg.fromPeerId);
      if (!watcher?.pc) return;
      if (msg.payload.kind === "answer") {
        void watcher.pc.setRemoteDescription({ type: "answer", sdp: msg.payload.sdp });
      } else if (msg.payload.kind === "ice") {
        void watcher.pc.addIceCandidate(msg.payload.candidate).catch(() => {});
      }
    },
    [openPeer, teardown],
  );

  return { status, watcherCount, videoRef, handleMessage };
}
