"use client";

import { cx } from "@/components/ui";
import type { QuestionView } from "@/lib/types";

/**
 * The 25-question grid for the current section. Three states only — answered,
 * marked for review, and where you are — each shown by a different shape or
 * weight rather than by yet another colour.
 */
export function QuestionPalette({
  questions,
  currentIndex,
  onJump,
}: {
  questions: QuestionView[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, index) => {
          const answered = q.selected !== null;
          const current = index === currentIndex;
          return (
            <button
              key={q.order}
              onClick={() => onJump(index)}
              aria-current={current ? "true" : undefined}
              className={cx(
                "tabular relative h-9 rounded-md border text-[13px] font-medium transition-colors",
                answered
                  ? "border-ok/30 bg-ok-soft text-ok"
                  : "border-line-strong bg-surface text-ink-2 hover:bg-subtle",
                current && "ring-2 ring-accent ring-offset-1",
              )}
            >
              {index + 1}
              {q.marked ? (
                <span
                  aria-label="Marked for review"
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-warn"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <dl className="mt-3 space-y-1 text-[12px] text-ink-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm border border-ok/30 bg-ok-soft" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-warn" />
          <span>Marked for review</span>
        </div>
      </dl>
    </div>
  );
}
