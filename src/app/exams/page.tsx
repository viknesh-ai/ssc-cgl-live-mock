"use client";

import { SitePage } from "@/components/site/site-chrome";
import { ExamCard } from "@/components/site/exam-card";
import { Spinner } from "@/components/ui";
import { catalogueGroups, useCatalogue } from "@/lib/catalogue";

/** The catalogue: every exam we carry, grouped the way candidates search for them. */
export default function ExamsPage() {
  const exams = useCatalogue();
  const groups = exams ? catalogueGroups(exams) : [];
  const ready = exams?.filter((e) => e.papers.length > 0).length ?? 0;

  return (
    <SitePage>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="font-display text-4xl tracking-tight text-ink">Exams</h1>
        <p className="mt-3 text-[16px] text-ink-2">
          {exams === null
            ? "Loading…"
            : `${ready} ready to sit now. More each week.`}
        </p>

        {exams === null ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <div className="mt-12 space-y-12">
            {groups.map((group) => (
              <section key={group.title}>
                <h2 className="font-display text-[22px] tracking-tight text-ink">{group.title}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.entries.map((entry) => (
                    <ExamCard key={entry.name} entry={entry} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-14 border-t border-line pt-6 text-[14px] text-ink-2">
          Need an exam that is not here?{" "}
          <a
            href="mailto:hello@invigil.app?subject=Exam%20request"
            className="text-accent underline underline-offset-4"
          >
            Tell us
          </a>
          .
        </p>
      </div>
    </SitePage>
  );
}
