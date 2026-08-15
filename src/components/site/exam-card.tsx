"use client";

import Link from "next/link";
import { cx } from "@/components/ui";
import type { CatalogueEntry } from "@/lib/catalogue";

/**
 * One exam in the catalogue. A live exam shows what it costs you in time and
 * marks; the rest simply say when they will be here, said once.
 */
export function ExamCard({ entry }: { entry: CatalogueEntry }) {
  const live = entry.live;
  const paper = live?.papers[0];

  const inner = (
    <>
      <h3 className="font-display text-[20px] leading-snug tracking-tight text-ink">
        {entry.name}
      </h3>

      {live && paper ? (
        <p className="mt-1.5 text-[14px] text-ink-2">
          {paper.questions} questions · {paper.minutes} min · {paper.maxScore} marks
        </p>
      ) : null}

      <span
        className={cx(
          "mt-auto inline-flex h-10 items-center self-start rounded-md border px-4 text-[15px] font-medium",
          live
            ? "border-ink bg-ink text-white"
            : "border-line-strong bg-subtle text-ink-3",
        )}
      >
        {live ? "Start" : "Coming soon"}
      </span>
    </>
  );

  const shell = "flex min-h-40 flex-col rounded-lg border bg-surface p-5";

  if (!live) {
    return <div className={cx(shell, "border-line")}>{inner}</div>;
  }

  return (
    <Link
      href={`/exams/${live.slug}`}
      className={cx(shell, "border-line transition-colors hover:border-ink hover:bg-subtle")}
    >
      {inner}
    </Link>
  );
}
