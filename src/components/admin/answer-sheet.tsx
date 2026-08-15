"use client";

import { useState } from "react";
import { Badge, cx } from "@/components/ui";
import { OPTION_LETTERS } from "@/lib/exam";
import type { CandidateSheet } from "@/lib/types";

/**
 * The candidate's paper as the examiner sees it: a 100-question map marked
 * right or wrong as they go, and whichever question is open beneath it.
 */
export function AnswerSheet({ sheet }: { sheet: CandidateSheet }) {
  const livePosition =
    (sheet.sections[sheet.currentSection]?.offset ?? 0) + sheet.currentIndex;
  const [pinned, setPinned] = useState<number | null>(null);
  const shown = pinned ?? livePosition;
  const item = sheet.items.find((i) => i.order === shown);

  return (
    <div className="px-4 py-4">
      <div className="space-y-3">
        {sheet.sections.map((section) => (
          <div key={section.index}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="eyebrow block">{section.shortName}</span>
            </div>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${Math.min(section.questionCount, 25)}, minmax(0, 1fr))`,
              }}
            >
              {sheet.items
                .filter((i) => i.sectionIndex === section.index)
                .map((i) => {
                  const answered = i.selected !== null;
                  const correct = answered && i.selected === i.answerIndex;
                  return (
                    <button
                      key={i.order}
                      title={`${section.shortName} Q${i.order - section.offset + 1}`}
                      onClick={() => setPinned(i.order === shown ? null : i.order)}
                      className={cx(
                        "aspect-square rounded-sm border text-[9px] font-semibold",
                        answered
                          ? correct
                            ? "border-ok/40 bg-ok-soft text-ok"
                            : "border-bad/40 bg-bad-soft text-bad"
                          : "border-line-strong bg-subtle text-ink-3",
                        i.order === livePosition && "ring-2 ring-accent ring-offset-1",
                        i.order === shown && pinned !== null && "ring-2 ring-ink ring-offset-1",
                      )}
                    >
                      {i.order - section.offset + 1}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-ok/40 bg-ok-soft" /> Correct
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-bad/40 bg-bad-soft" /> Wrong
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-line-strong bg-subtle" /> Unanswered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm ring-2 ring-accent" /> Where they are now
        </span>
      </div>

      {item ? (
        <div className="mt-4 rounded-md border border-line bg-subtle px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-[12px] font-semibold text-ink-3">
              Q{item.order - (sheet.sections[item.sectionIndex]?.offset ?? 0) + 1} of{" "}
              {sheet.sections[item.sectionIndex]?.questionCount ?? 0}
            </span>
            <span className="text-[12px] text-ink-3">
              {sheet.sections[item.sectionIndex]?.shortName}
            </span>
            {pinned === null ? <Badge tone="accent">Following live</Badge> : (
              <button className="text-[12px] text-accent underline" onClick={() => setPinned(null)}>
                Follow live again
              </button>
            )}
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-ink">{item.text}</p>
          <ul className="mt-2.5 space-y-1">
            {item.options.map((option, i) => {
              const isKey = i === item.answerIndex;
              const isChoice = i === item.selected;
              return (
                <li
                  key={i}
                  className={cx(
                    "flex items-start gap-2 rounded-sm px-2 py-1 text-[13.5px]",
                    isKey ? "bg-ok-soft text-ok" : isChoice ? "bg-bad-soft text-bad" : "text-ink-2",
                  )}
                >
                  <span className="text-[12px] font-semibold">{OPTION_LETTERS[i]}</span>
                  <span className="flex-1 text-ink">{option}</span>
                  {isKey ? <span className="text-[12px] font-medium">Key</span> : null}
                  {isChoice && !isKey ? <span className="text-[12px] font-medium">Picked</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
