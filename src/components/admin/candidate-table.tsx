"use client";

import { Badge, EmptyState, cx } from "@/components/ui";
import { formatClock, sectionShort, QUESTIONS_PER_SECTION } from "@/lib/exam";
import type { CandidateLive } from "@/lib/types";

/** Everyone in the room, at a glance. Selecting a row drives the panels beside it. */
export function CandidateTable({
  candidates,
  selectedId,
  onSelect,
  now,
}: {
  candidates: CandidateLive[];
  selectedId: number | null;
  onSelect: (attemptId: number) => void;
  now: number;
}) {
  if (candidates.length === 0) {
    return <EmptyState title="Nobody has joined yet" hint="Share the room code to let candidates in." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-left">
            {["Candidate", "Section", "Answered", "Correct", "Wrong", "Left", "Flags"].map((h, i) => (
              <th
                key={h}
                className={cx(
                  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3",
                  i > 0 && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const selected = c.attemptId === selectedId;
            const left = c.deadlineAt ? Math.max(0, c.deadlineAt - now) : null;
            return (
              <tr
                key={c.attemptId}
                onClick={() => onSelect(c.attemptId)}
                className={cx(
                  "cursor-pointer border-b border-line last:border-0",
                  selected ? "bg-accent-soft" : "hover:bg-subtle",
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      title={c.online ? "Connected" : "Disconnected"}
                      className={cx(
                        "size-2 shrink-0 rounded-full",
                        c.online ? "bg-ok" : "bg-line-strong",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{c.name}</div>
                      <div className="truncate text-[12px] text-ink-3">{c.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-ink-2">
                  {c.status === "SUBMITTED" ? (
                    <Badge tone="neutral">Submitted</Badge>
                  ) : c.status === "WAITING" ? (
                    <span className="text-ink-3">Waiting</span>
                  ) : (
                    <>
                      <div>{sectionShort(c.currentSection)}</div>
                      <div className="tabular text-[12px] text-ink-3">
                        Q{c.currentIndex + 1} of {QUESTIONS_PER_SECTION}
                      </div>
                    </>
                  )}
                </td>
                <td className="tabular px-4 py-3 text-right text-ink">{c.answered}</td>
                <td className="tabular px-4 py-3 text-right text-ok">{c.correct}</td>
                <td className="tabular px-4 py-3 text-right text-bad">{c.wrong}</td>
                <td className="tabular px-4 py-3 text-right text-ink-2">
                  {c.status === "SUBMITTED"
                    ? c.totalScore !== null
                      ? `${c.totalScore.toFixed(1)} marks`
                      : "—"
                    : left !== null
                      ? formatClock(left)
                      : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {c.cameraOn ? null : <Badge tone="warn">No camera</Badge>}
                    {c.tabSwitches > 0 ? <Badge tone="bad">{c.tabSwitches} exits</Badge> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
