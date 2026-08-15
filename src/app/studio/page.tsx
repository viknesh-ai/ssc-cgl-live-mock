"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudioShell } from "@/components/studio/studio-shell";
import { Button, EmptyState, Panel, PanelHeader, Spinner, Stat, StatRow, cx } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ExamView, PaperSummary } from "@/lib/types";

export default function StudioOverview() {
  const [exams, setExams] = useState<ExamView[] | null>(null);
  const [papers, setPapers] = useState<PaperSummary[] | null>(null);

  useEffect(() => {
    api<{ exams: ExamView[] }>("/api/exams")
      .then((d) => setExams(d.exams))
      .catch(() => setExams([]));
    api<{ papers: PaperSummary[] }>("/api/papers")
      .then((d) => setPapers(d.papers))
      .catch(() => setPapers([]));
  }, []);

  const questionCount = exams?.reduce((n, e) => n + e.questionCount, 0) ?? 0;
  const emptySections =
    exams?.flatMap((e) => e.sections.filter((s) => s.questionCount === 0).map((s) => ({ exam: e, s }))) ??
    [];
  const shortPapers =
    papers?.filter((p) => p.sections.some((s) => s.available < s.questionCount)) ?? [];

  return (
    <StudioShell
      title="Library"
      description="Everything candidates can be given: the exams, the papers drawn from them, and the questions behind both."
      actions={
        <Link href="/studio/import">
          <Button variant="primary">Import questions</Button>
        </Link>
      }
    >
      <div className="space-y-5">
        <Panel>
          <StatRow>
            <Stat label="Exams" value={exams?.length ?? "—"} />
            <Stat label="Papers" value={papers?.filter((p) => !p.archived).length ?? "—"} />
            <Stat label="Questions" value={questionCount || "—"} />
            <Stat
              label="Needs attention"
              value={emptySections.length + shortPapers.length}
              tone={emptySections.length + shortPapers.length > 0 ? "warn" : "default"}
            />
          </StatRow>
        </Panel>

        {shortPapers.length || emptySections.length ? (
          <Panel>
            <PanelHeader
              title="Needs attention"
              meta="Papers that cannot be run, and sections with nothing in them."
            />
            <ul className="divide-y divide-line">
              {shortPapers.map((paper) => {
                const short = paper.sections.filter((s) => s.available < s.questionCount);
                return (
                  <li key={`p-${paper.id}`} className="px-5 py-3 text-[13.5px]">
                    <span className="font-medium text-ink">{paper.name}</span>
                    <span className="text-ink-2">
                      {" "}
                      — {short.map((s) => `${s.shortName} has ${s.available} of ${s.questionCount}`).join(", ")}
                    </span>
                  </li>
                );
              })}
              {emptySections.map(({ exam, s }) => (
                <li key={`s-${s.id}`} className="px-5 py-3 text-[13.5px]">
                  <span className="font-medium text-ink">{exam.name}</span>
                  <span className="text-ink-2"> — {s.name} has no questions yet</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            title="Exams"
            actions={
              <Link href="/studio/exams">
                <Button size="sm">Manage</Button>
              </Link>
            }
          />
          {exams === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : exams.length === 0 ? (
            <EmptyState title="No exams yet" hint="Create one to start a question bank." />
          ) : (
            <ul className="divide-y divide-line">
              {exams.map((exam) => (
                <li key={exam.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-ink">{exam.name}</div>
                    <div className="text-[12px] text-ink-3">
                      {exam.region ?? "Region not set"} · {exam.sections.length} sections
                    </div>
                  </div>
                  <div
                    className={cx(
                      "tabular shrink-0 text-[13px]",
                      exam.questionCount === 0 ? "text-bad" : "text-ink-2",
                    )}
                  >
                    {exam.questionCount} questions
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </StudioShell>
  );
}
