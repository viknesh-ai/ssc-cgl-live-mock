"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/exam";
import { cx } from "@/components/ui";

/**
 * The section clock. The server sends the authoritative remaining time on every
 * update; between updates the browser just counts down, and it stops counting
 * while the examiner has the room paused.
 */
export function ExamTimer({
  remainingMs,
  paused,
  onExpire,
}: {
  remainingMs: number | null;
  paused: boolean;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(remainingMs ?? 0);
  const expiredRef = useRef(false);

  useEffect(() => {
    setLeft(remainingMs ?? 0);
    if ((remainingMs ?? 0) > 0) expiredRef.current = false;
  }, [remainingMs]);

  useEffect(() => {
    if (remainingMs === null || paused) return;
    const started = Date.now();
    const base = remainingMs;
    const id = setInterval(() => {
      const next = Math.max(0, base - (Date.now() - started));
      setLeft(next);
      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }, 250);
    return () => clearInterval(id);
  }, [remainingMs, paused, onExpire]);

  if (remainingMs === null) {
    return <span className="tabular text-lg font-semibold text-ink-3">--:--</span>;
  }

  const critical = left <= 60_000;
  const low = left <= 180_000;

  return (
    <div className="flex items-center gap-2">
      {paused ? <span className="text-[12px] font-medium text-warn">Paused</span> : null}
      <span
        className={cx(
          "tabular rounded-md border px-2.5 py-1 text-lg font-semibold tracking-tight",
          critical
            ? "border-bad/30 bg-bad-soft text-bad"
            : low
              ? "border-warn/30 bg-warn-soft text-warn"
              : "border-line bg-subtle text-ink",
        )}
      >
        {formatClock(left)}
      </span>
    </div>
  );
}
