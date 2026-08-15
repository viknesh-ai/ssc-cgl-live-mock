"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { AppHeader } from "@/components/app-header";
import { ReviewList } from "@/components/results/review-list";
import { Button, Notice, Panel, PanelHeader, Spinner, Stat, StatRow } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { AttemptResult } from "@/lib/types";

type Payload = {
  result: AttemptResult;
  candidateName: string;
  explanations: Record<string, string>;
};

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready, session } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api<Payload>(`/api/attempts/${id}/result`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this result."));
  }, [id, session]);

  const score = data?.result.score;

  const verdict = useMemo(
    () => (score ? [...score.sections].sort((a, b) => a.score - b.score)[0] : null),
    [score],
  );

  if (!ready || (session && !data && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-full">
        <AppHeader />
        <main className="mx-auto max-w-md px-5 py-20 text-center text-[14px] text-ink-2">
          Sign in to view this result.
        </main>
      </div>
    );
  }

  if (error || !data || !score) {
    return (
      <div className="min-h-full">
        <AppHeader />
        <main className="mx-auto max-w-md px-5 py-20">
          <Notice tone="bad">{error ?? "Result unavailable."}</Notice>
          <div className="mt-5">
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <AppHeader subtitle={`${data.result.paperName} · ${data.candidateName}`} />

      <main className="mx-auto max-w-6xl space-y-5 px-5 py-8">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Paper marked</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {data.result.submittedAt
              ? new Date(data.result.submittedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : null}
          </p>
        </div>

        <Panel>
          <StatRow>
            <Stat
              label="Score"
              value={
                <>
                  {score.total.toFixed(1)}
                  <span className="text-sm font-normal text-ink-3"> / {score.maxScore}</span>
                </>
              }
            />
            <Stat
              label="Attempted"
              value={`${score.attempted} / ${data.result.questions.length}`}
            />
            <Stat label="Correct" value={score.correct} tone="ok" />
            <Stat label="Wrong" value={score.wrong} tone="bad" />
          </StatRow>

          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                    Section
                  </th>
                  {["Correct", "Wrong", "Skipped", "Accuracy", "Score"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {score.sections.map((row) => (
                  <tr key={row.index} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5 font-medium text-ink">{row.shortName}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ok">{row.correct}</td>
                    <td className="tabular px-4 py-2.5 text-right text-bad">{row.wrong}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-2">{row.skipped}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-2">{row.accuracy}%</td>
                    <td className="tabular px-4 py-2.5 text-right font-medium text-ink">
                      {row.score.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {verdict ? (
          <Notice>
            Weakest section: <strong className="text-ink">{verdict.shortName}</strong> —{" "}
            {verdict.correct} correct, {verdict.wrong} wrong, {verdict.skipped} skipped. Use the AI
            explanations below on the ones you got wrong there first.
          </Notice>
        ) : null}

        <Panel>
          <PanelHeader
            title="Review"
            meta="Ask the AI to work through any question you want explained."
          />
          <ReviewList result={data.result} initialExplanations={data.explanations} />
        </Panel>
      </main>
    </div>
  );
}
