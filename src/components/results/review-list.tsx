"use client";

import { useMemo, useState } from "react";
import { Button, Badge, Notice, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api-client";
import { OPTION_LETTERS } from "@/lib/exam";
import type { AttemptResult } from "@/lib/types";

type Filter = "all" | "wrong" | "skipped" | number;

/** The marked paper, one question at a time, with AI explanations on request. */
export function ReviewList({
  result,
  initialExplanations,
}: {
  result: AttemptResult;
  initialExplanations: Record<string, string>;
}) {
  const [filter, setFilter] = useState<Filter>("wrong");
  const [explanations, setExplanations] = useState<Record<number, string>>(() =>
    Object.fromEntries(Object.entries(initialExplanations).map(([k, v]) => [Number(k), v])),
  );
  const [loading, setLoading] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  // Questions are numbered within their section, as the candidate saw them.
  const sectionOffsets = useMemo(() => {
    const offsets = new Map<number, number>();
    for (const q of result.questions) {
      const current = offsets.get(q.sectionIndex);
      if (current === undefined || q.order < current) offsets.set(q.sectionIndex, q.order);
    }
    return offsets;
  }, [result.questions]);

  const items = useMemo(() => {
    return result.questions.filter((q) => {
      if (filter === "wrong") return q.selected !== null && q.selected !== q.answerIndex;
      if (filter === "skipped") return q.selected === null;
      if (typeof filter === "number") return q.sectionIndex === filter;
      return true;
    });
  }, [result.questions, filter]);

  const explain = async (questionId: number) => {
    setLoading(questionId);
    setErrors((prev) => ({ ...prev, [questionId]: "" }));
    try {
      const data = await api<{ content: string }>("/api/explain", {
        method: "POST",
        body: { questionId },
      });
      setExplanations((prev) => ({ ...prev, [questionId]: data.content }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [questionId]: err instanceof Error ? err.message : "The AI could not answer right now.",
      }));
    } finally {
      setLoading(null);
    }
  };

  const counts = useMemo(
    () => ({
      wrong: result.questions.filter((q) => q.selected !== null && q.selected !== q.answerIndex).length,
      skipped: result.questions.filter((q) => q.selected === null).length,
    }),
    [result.questions],
  );

  const filters: { key: Filter; label: string }[] = [
    { key: "wrong", label: `Wrong (${counts.wrong})` },
    { key: "skipped", label: `Skipped (${counts.skipped})` },
    { key: "all", label: `All (${result.questions.length})` },
    ...result.score.sections.map((section) => ({
      key: section.index as Filter,
      label: section.shortName,
    })),
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
        {filters.map((f) => (
          <button
            key={String(f.key)}
            onClick={() => setFilter(f.key)}
            className={cx(
              "rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
              filter === f.key
                ? "border-ink bg-ink text-white"
                : "border-line-strong bg-surface text-ink-2 hover:bg-subtle",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-ink-3">Nothing here — well done.</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((q) => {
            const correct = q.selected === q.answerIndex;
            const skipped = q.selected === null;
            const explanation = explanations[q.questionId];
            const error = errors[q.questionId];

            return (
              <li key={q.order} className="px-5 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-[12px] font-semibold text-ink-3">
                    Q{q.order - (sectionOffsets.get(q.sectionIndex) ?? 0) + 1}
                  </span>
                  <span className="text-[12px] text-ink-3">
                    {result.score.sections[q.sectionIndex]?.shortName}
                  </span>
                  {skipped ? (
                    <Badge>Not attempted</Badge>
                  ) : correct ? (
                    <Badge tone="ok">Correct +2</Badge>
                  ) : (
                    <Badge tone="bad">Wrong &minus;0.5</Badge>
                  )}
                </div>

                <p className="mt-2 text-[15px] leading-relaxed text-ink">{q.text}</p>

                <ul className="mt-3 space-y-1.5">
                  {q.options.map((option, i) => {
                    const isKey = i === q.answerIndex;
                    const isChoice = i === q.selected;
                    return (
                      <li
                        key={i}
                        className={cx(
                          "flex items-start gap-2.5 rounded-md border px-3 py-2 text-[14px]",
                          isKey
                            ? "border-ok/30 bg-ok-soft"
                            : isChoice
                              ? "border-bad/30 bg-bad-soft"
                              : "border-line bg-surface",
                        )}
                      >
                        <span className="mt-px text-[12px] font-semibold text-ink-3">
                          {OPTION_LETTERS[i]}
                        </span>
                        <span className="flex-1 text-ink">{option}</span>
                        {isKey ? (
                          <span className="text-[12px] font-medium text-ok">Correct answer</span>
                        ) : isChoice ? (
                          <span className="text-[12px] font-medium text-bad">Your answer</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3">
                  {explanation ? (
                    <div className="rounded-md border border-line bg-subtle px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                        AI explanation
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                        {explanation}
                      </p>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      disabled={loading === q.questionId}
                      onClick={() => void explain(q.questionId)}
                    >
                      {loading === q.questionId ? <Spinner /> : null}
                      Explain this answer
                    </Button>
                  )}
                  {error ? (
                    <div className="mt-2">
                      <Notice tone="bad">{error}</Notice>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
