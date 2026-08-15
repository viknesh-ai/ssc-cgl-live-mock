"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  EmptyState,
  Notice,
  Panel,
  PanelHeader,
  Spinner,
  cx,
} from "@/components/ui";
import { api, currentToken } from "@/lib/api-client";
import { OPTION_LETTERS } from "@/lib/exam";
import { TEMPLATE_SAMPLE, type ParsedQuestion, type ParseProblem } from "@/lib/import-format";
import type { ExamView } from "@/lib/types";

type ParseResponse = {
  filename: string;
  characters: number;
  questions: ParsedQuestion[];
  problems: ParseProblem[];
};

export function ImportManager() {
  const [exams, setExams] = useState<ExamView[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [fallbackSection, setFallbackSection] = useState<number | "">("");
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");

  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [dropping, setDropping] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api<{ exams: ExamView[] }>("/api/exams")
      .then((data) => {
        setExams(data.exams);
        setExamId(data.exams[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load exams."));
  }, []);

  const exam = exams.find((e) => e.id === examId);

  /** Matches a parsed section name against this exam's sections. */
  const matchSection = (name: string | null) => {
    if (!name || !exam) return null;
    const wanted = name.trim().toLowerCase();
    const hit = exam.sections.find(
      (s) => s.name.toLowerCase() === wanted || s.shortName.toLowerCase() === wanted,
    );
    return hit?.id ?? null;
  };

  const upload = async (file: File) => {
    setParsing(true);
    setError(null);
    setResult(null);
    setParsed(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const token = await currentToken();
      const res = await fetch("/api/studio/parse", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read that file.");

      const response = data as ParseResponse;
      setParsed(response);
      setAssignments(
        Object.fromEntries(
          response.questions.map((q, i) => [i, matchSection(q.section) ?? (Number(fallbackSection) || 0)]),
        ),
      );
      setDropping(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!parsed || !examId) return;
    setImporting(true);
    setError(null);
    try {
      const questions = parsed.questions
        .map((q, i) => ({ q, sectionId: assignments[i] }))
        .filter(({ sectionId }, i) => sectionId && !dropping.has(i))
        .map(({ q, sectionId }) => ({
          sectionId,
          text: q.text,
          options: q.options,
          answerIndex: q.answerIndex,
          topic: q.topic,
          difficulty: q.difficulty,
          explanation: q.explanation,
        }));

      if (!questions.length) throw new Error("Nothing selected to import.");

      const res = await api<{ created: number; skipped: number; failed: { row: number; reason: string }[] }>(
        "/api/questions/import",
        { method: "POST", body: { examId, status, questions } },
      );
      setResult(
        `Imported ${res.created} question${res.created === 1 ? "" : "s"}` +
          (res.skipped ? `, skipped ${res.skipped} already in the bank` : "") +
          (res.failed.length ? `, ${res.failed.length} rejected` : "") +
          ".",
      );
      setParsed(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const unassigned = parsed
    ? parsed.questions.filter((_, i) => !assignments[i] && !dropping.has(i)).length
    : 0;
  const selected = parsed ? parsed.questions.length - dropping.size - unassigned : 0;

  return (
    <div className="space-y-4">
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink-2">
          Every question in the file is read out and shown for checking before anything is saved. To
          add questions one at a time instead — typing the question and its options yourself — use{" "}
          <Link href="questions" className="text-accent underline underline-offset-4">
            the question bank
          </Link>
          .
        </p>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {result ? <Notice>{result}</Notice> : null}

        <Panel>
          <PanelHeader title="1 — Choose the exam" />
          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <label className="block">
              <span className="eyebrow block">Exam</span>
              <select
                value={examId ?? ""}
                onChange={(e) => setExamId(Number(e.target.value))}
                className="mt-1.5 h-9.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
              >
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow block">Section when the file does not say</span>
              <select
                value={fallbackSection}
                onChange={(e) => setFallbackSection(e.target.value ? Number(e.target.value) : "")}
                className="mt-1.5 h-9.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
              >
                <option value="">Ask me for each question</option>
                {exam?.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={status === "DRAFT"}
                onChange={(e) => setStatus(e.target.checked ? "DRAFT" : "PUBLISHED")}
              />
              Import as drafts
            </label>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="2 — Use the template"
            meta="Any paper laid out like this can be read. Download it, fill it in, save as PDF or Word."
            actions={
              <a href="/invigil-question-template.txt" download>
                <Button>Download template</Button>
              </a>
            }
          />
          <div className="px-5 py-4">
            <pre className="thin-scroll max-h-72 overflow-auto rounded-md border border-line bg-subtle px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink-2">
              {TEMPLATE_SAMPLE}
            </pre>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              Numbering may be <code className="font-mono text-[13px]">1.</code>,{" "}
              <code className="font-mono text-[13px]">1)</code>,{" "}
              <code className="font-mono text-[13px]">Q1.</code> or{" "}
              <code className="font-mono text-[13px]">Q.1</code>. Options may be{" "}
              <code className="font-mono text-[13px]">(A)</code>,{" "}
              <code className="font-mono text-[13px]">A)</code>,{" "}
              <code className="font-mono text-[13px]">A.</code> or lower case. The answer may be a
              letter, a number, or the option&apos;s own text. Explanation, topic and difficulty are
              optional — an explanation you write here is kept and shown to candidates instead of an
              AI one.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="3 — Upload the file"
            meta="PDF, .docx or .txt, up to 8 MB. Scanned images need OCR first."
          />
          <div className="px-5 py-4">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
              disabled={!examId || parsing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
              className="block w-full text-[15px] text-ink-2 file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-ink hover:file:bg-subtle"
            />
            {parsing ? (
              <p className="mt-3 flex items-center gap-2 text-[14px] text-ink-2">
                <Spinner /> Reading the file…
              </p>
            ) : null}

          </div>
        </Panel>

        {parsed ? (
          <Panel>
            <PanelHeader
              title="4 — Check what was found"
              meta={`${parsed.filename} · ${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"} found${parsed.problems.length ? ` · ${parsed.problems.length} skipped` : ""}`}
              actions={
                <Button variant="primary" disabled={importing || selected === 0} onClick={runImport}>
                  {importing ? <Spinner /> : null}
                  Import {selected} question{selected === 1 ? "" : "s"}
                </Button>
              }
            />

            {parsed.problems.length ? (
              <div className="border-b border-line px-5 py-3">
                <div className="eyebrow">Skipped in the file</div>
                <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
                  {parsed.problems.slice(0, 8).map((p, i) => (
                    <li key={i}>
                      <span className="text-ink">{p.near}</span> — {p.reason}
                    </li>
                  ))}
                  {parsed.problems.length > 8 ? (
                    <li>…and {parsed.problems.length - 8} more.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {unassigned > 0 ? (
              <div className="border-b border-line px-5 py-3">
                <Notice tone="warn">
                  {unassigned} question{unassigned === 1 ? " has" : "s have"} no section yet. Pick
                  one for each, or set a default above.
                </Notice>
              </div>
            ) : null}

            <ol className="divide-y divide-line">
              {parsed.questions.map((q, i) => {
                const dropped = dropping.has(i);
                return (
                  <li key={i} className={cx("px-5 py-4", dropped && "opacity-45")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tabular text-[12px] font-semibold text-ink-3">
                          {i + 1}
                        </span>
                        {q.section ? <Badge>{q.section}</Badge> : null}
                        {q.topic ? <Badge>{q.topic}</Badge> : null}
                        {q.difficulty ? <Badge>{q.difficulty.toLowerCase()}</Badge> : null}
                        {q.explanation ? <Badge tone="accent">explanation</Badge> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={assignments[i] ?? ""}
                          onChange={(e) =>
                            setAssignments({ ...assignments, [i]: Number(e.target.value) })
                          }
                          className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[12.5px]"
                        >
                          <option value="">Choose section…</option>
                          {exam?.sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.shortName}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => {
                            const next = new Set(dropping);
                            if (dropped) next.delete(i);
                            else next.add(i);
                            setDropping(next);
                          }}
                        >
                          {dropped ? "Include" : "Skip"}
                        </Button>
                      </div>
                    </div>

                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{q.text}</p>
                    <ul className="mt-2 space-y-1">
                      {q.options.map((option, oi) => (
                        <li
                          key={oi}
                          className={cx(
                            "flex gap-2 rounded-sm px-2 py-1 text-[13.5px]",
                            oi === q.answerIndex ? "bg-ok-soft text-ok" : "text-ink-2",
                          )}
                        >
                          <span className="font-semibold">{OPTION_LETTERS[oi]}</span>
                          <span className="text-ink">{option}</span>
                          {oi === q.answerIndex ? (
                            <span className="ml-auto text-[12px] font-medium">Key</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {q.explanation ? (
                      <p className="mt-2 rounded-md border border-line bg-subtle px-3 py-2 text-[13px] leading-relaxed text-ink-2">
                        {q.explanation}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </Panel>
        ) : parsing ? null : (
          <Panel>
            <EmptyState
              title="Nothing uploaded yet"
              hint="Questions found in the file are shown here for checking before anything is saved."
            />
          </Panel>
        )}
    </div>
  );
}
