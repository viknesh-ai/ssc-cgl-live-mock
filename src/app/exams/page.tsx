"use client";

import Link from "next/link";
import { SitePage } from "@/components/site/site-chrome";
import { Spinner } from "@/components/ui";
import { byRegion, useCatalogue } from "@/lib/catalogue";

/** The public catalogue, grouped by where each exam is sat. */
export default function ExamsPage() {
  const exams = useCatalogue();
  const groups = exams ? byRegion(exams) : [];

  return (
    <SitePage>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="font-display text-3xl tracking-tight text-ink">Exams</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          Each exam keeps its own sections, timing and marking — including negative marking where it
          applies. Papers are drawn fresh from the question bank every time, so a second attempt is
          not the same paper again.
        </p>

        {exams === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : exams.length === 0 ? (
          <p className="py-10 text-[14px] text-ink-2">Papers are being prepared.</p>
        ) : (
          <div className="mt-10 space-y-12">
            {groups.map(([region, list]) => (
              <section key={region}>
                <h2 className="eyebrow block">{region}</h2>
                <div className="mt-3 border-t-2 border-ink">
                  {list.map((exam) => (
                    <Link
                      key={exam.id}
                      href={`/exams/${exam.slug}`}
                      className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-5 hover:bg-surface"
                    >
                      <div className="min-w-0 max-w-xl">
                        <h3 className="font-display text-lg tracking-tight text-ink">
                          {exam.name}
                        </h3>
                        {exam.description ? (
                          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                            {exam.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[12.5px] text-ink-3">
                          {exam.sections.map((s) => s.shortName).join(" · ")}
                        </p>
                      </div>
                      <div className="tabular shrink-0 text-right text-[12.5px] text-ink-3">
                        <div>
                          {exam.papers.length} paper{exam.papers.length === 1 ? "" : "s"}
                        </div>
                        <div>{exam.questionCount} questions</div>
                        <div>
                          +{exam.correctMark} / {exam.wrongMark}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </SitePage>
  );
}
