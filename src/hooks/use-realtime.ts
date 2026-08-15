"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentToken } from "@/lib/api-client";
import { WS_PATH, type ClientMessage, type ServerMessage } from "@/lib/realtime-protocol";

type Options = {
  enabled: boolean;
  roomCode?: string | null;
  attemptId?: number | null;
  onMessage: (msg: ServerMessage) => void;
};

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

/**
 * Keeps one websocket open for as long as the page needs it, reconnecting with
 * backoff. Exam state is authoritative on the server, and every reconnect is
 * followed by a fresh state push, so a dropped connection costs nothing.
 */
export function useRealtime({ enabled, roomCode, attemptId, onMessage }: Options) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    let closed = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const open = async () => {
      if (closed) return;
      // Candidates present a Firebase token; examiners have a session cookie,
      // which the browser sends with the upgrade request on its own. Either is
      // enough, so a missing token must not stop us connecting.
      const token = await currentToken();
      if (closed) return;

      const url = new URL(WS_PATH, window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      if (token) url.searchParams.set("token", token);
      if (roomCode) url.searchParams.set("room", roomCode);
      if (attemptId) url.searchParams.set("attempt", String(attemptId));

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        attempts = 0;
        setConnected(true);
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: "ping" }));
        }, PING_MS);
      };

      socket.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(event.data) as ServerMessage);
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        if (closed) return;
        attempts += 1;
        const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(attempts, 5));
        retryTimer = setTimeout(open, delay);
      };

      socket.onerror = () => socket.close();
    };

    void open();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      socketRef.current?.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, roomCode, attemptId]);

  const send = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }, []);

  return { connected, send };
}
