"use client";

import type { RefObject } from "react";
import { Notice } from "@/components/ui";

/** The candidate's own preview, so they can see exactly what is being sent. */
export function SelfCamera({
  status,
  videoRef,
}: {
  status: "idle" | "requesting" | "live" | "denied" | "unavailable";
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div>
      <div className="relative overflow-hidden rounded-md border border-line bg-ink">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="block aspect-4/3 w-full object-cover"
        />
        {status !== "live" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ink text-[13px] text-white/70">
            {status === "requesting" ? "Starting camera…" : "Camera off"}
          </div>
        ) : null}
      </div>

      {status === "denied" ? (
        <div className="mt-3">
          <Notice tone="bad">
            Camera access is blocked. Allow it in your browser&apos;s address bar, then reload —
            invigilated papers require a working camera.
          </Notice>
        </div>
      ) : null}
      {status === "unavailable" ? (
        <div className="mt-3">
          <Notice tone="warn">
            No camera or microphone was found on this device. Your examiner has been told.
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
