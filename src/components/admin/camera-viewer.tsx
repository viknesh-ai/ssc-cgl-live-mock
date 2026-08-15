"use client";

import { useEffect, useRef } from "react";
import { Button, Badge, Notice } from "@/components/ui";

type Status = "off" | "connecting" | "live" | "frames" | "unavailable";

/**
 * The candidate's camera. A live track when a peer connection succeeds, still
 * frames when the network blocks one — labelled either way so the examiner
 * always knows what they are looking at.
 */
export function CameraViewer({
  candidateName,
  status,
  message,
  stream,
  frame,
  watching,
  onWatch,
  onStop,
}: {
  candidateName: string;
  status: Status;
  message: string | null;
  stream: MediaStream | null;
  frame: string | null;
  watching: boolean;
  onWatch: () => void;
  onStop: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="px-4 py-4">
      <div className="relative overflow-hidden rounded-md border border-line bg-ink">
        <div className="aspect-4/3 w-full">
          {status === "live" && stream ? (
            <video ref={videoRef} autoPlay playsInline className="size-full object-cover" />
          ) : status === "frames" && frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame} alt={`${candidateName}'s camera`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-[13px] text-white/60">
              {status === "connecting"
                ? "Connecting to camera…"
                : status === "unavailable"
                  ? "No camera on the candidate's device"
                  : "Not watching"}
            </div>
          )}
        </div>

        {watching && status !== "off" ? (
          <div className="absolute left-2 top-2">
            <span className="rounded-sm bg-ink/80 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
              {status === "live" ? "Live" : status === "frames" ? "Frames" : status}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {watching ? (
            <Button size="sm" onClick={onStop}>
              Stop watching
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={onWatch}>
              Watch camera
            </Button>
          )}
        </div>
        {status === "live" ? <Badge tone="ok">Audio and video</Badge> : null}
      </div>

      {message ? (
        <div className="mt-3">
          <Notice tone={status === "unavailable" ? "bad" : "warn"}>{message}</Notice>
        </div>
      ) : null}
    </div>
  );
}
