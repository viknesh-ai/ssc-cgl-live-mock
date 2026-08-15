"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { SitePage } from "@/components/site/site-chrome";
import { GoogleMark } from "@/components/google-mark";
import { Button, EmptyState, Notice, Panel, PanelHeader, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useCatalogue } from "@/lib/catalogue";

export default function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { session, signIn, ready } = useAuth();
  const router = useRouter();
  const exams = useCatalogue();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exam = exams?.find((e) => e.slug === slug);

  const start = async (paperId: number) => {
    if (!session) {
      void signIn();
      return;
    }
    setBusy(paperId);
    setError(null);
    try {
      const { state } = await api<{ state: { attemptId: number } }>("/api/practice", {
        method: "POST",
        body: { paperId },
      });
      router.push(`/practice/${state.attemptId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start that paper.");
      setBusy(null);
    }
  };

  if (exams === null) {
    return (
      <SitePage>
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      </SitePage>
    );
  }

  if (!exam) {
    return (
      <SitePage>
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <h1 className="font-display text-2xl tracking-tight text-ink">Exam not found</h1>
          <div className="mt-6">
            <Link href="/exams">
              <Button>All exams</Button>
            </Link>
          </div>
        </div>
      </SitePage>
    );
  }

  return (
    <SitePage>
      <div className="mx-auto max-w-4xl px-5 py-12">
        <Link href="/exams" className="text-[15px] text-ink-2 hover:text-ink">
          ← All exams
        </Link>

        <div className="mt-4">
          <p className="eyebrow block">{exam.region ?? "International"}</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">{exam.name}</h1>
          {exam.description ? (
            <p className="mt-3 max-w-2xl text-[16px] text-ink-2">{exam.description}</p>
          ) : null}
        </div>

        <dl className="mt-8 divide-y divide-line border-y border-line text-[15px]">
          {[
            ["Sections", exam.sections.map((s) => s.shortName).join(" · ")],
            ["Marking", `+${exam.correctMark} correct · ${exam.wrongMark} wrong`],
            ["Bank", `${exam.questionCount} questions`],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-6 py-3">
              <dt className="w-32 shrink-0 text-ink-3">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {error ? (
          <div className="mt-6">
            <Notice tone="bad">{error}</Notice>
          </div>
        ) : null}

        <h2 className="mt-10 font-display text-[26px] tracking-tight text-ink">Papers</h2>
        <div className="mt-4 space-y-4">
          {exam.papers.length === 0 ? (
            <Panel>
              <EmptyState title="Coming soon" hint="Papers for this exam are being prepared." />
            </Panel>
          ) : (
            exam.papers.map((paper) => (
              <Panel key={paper.id}>
                <PanelHeader
                  title={paper.name}
                  meta={`${paper.questions} questions · ${paper.minutes} min · ${paper.maxScore} marks`}
                  actions={
                    ready && !session ? (
                      <Button variant="primary" onClick={() => void signIn()}>
                        <GoogleMark />
                        Sign in to start
                      </Button>
                    ) : (
                      <Button variant="primary" disabled={busy !== null} onClick={() => start(paper.id)}>
                        {busy === paper.id ? <Spinner /> : null}
                        Start paper
                      </Button>
                    )
                  }
                />
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="eyebrow px-5 py-2">Section</th>
                      <th className="eyebrow px-4 py-2 text-right">Questions</th>
                      <th className="eyebrow px-5 py-2 text-right">Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paper.sections.map((s) => (
                      <tr key={s.name} className="border-b border-line last:border-0">
                        <td className="px-5 py-2 text-ink">{s.name}</td>
                        <td className="tabular px-4 py-2 text-right text-ink-2">
                          {s.questionCount}
                        </td>
                        <td className="tabular px-5 py-2 text-right text-ink-2">{s.minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            ))
          )}
        </div>
      </div>
    </SitePage>
  );
}
