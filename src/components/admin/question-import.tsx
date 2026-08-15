"use client";

import { useState } from "react";
import { Button, Notice, Panel, PanelHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ExamView } from "@/lib/types";

const SAMPLE = `[
  {
    "section": "Reasoning",
    "text": "Select the number that will come next in the series: 6, 11, 21, 36, 56, ?",
    "options": ["71", "76", "81", "86"],
    "answerIndex": 2,
    "topic": "Series",
    "difficulty": "EASY"
  }
]`;

/**
 * Bulk import by pasting JSON. Questions already in the bank are skipped rather
 * than duplicated, and every rejected row is reported with its reason.
 */
export function QuestionImport({
  exam,
  onCancel,
  onDone,
}: {
  exam: ExamView;
  onCancel: () => void;
  onDone: (message: string) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ row: number; reason: string }[]>([]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setFailures([]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("That is not valid JSON. Paste an array of question objects.");
      setBusy(false);
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setError("Expected a JSON array with at least one question.");
      setBusy(false);
      return;
    }

    try {
      const result = await api<{
        created: number;
        skipped: number;
        failed: { row: number; reason: string }[];
      }>("/api/questions/import", {
        method: "POST",
        body: { examId: exam.id, status, questions: parsed },
      });
      setFailures(result.failed);
      if (result.failed.length) {
        setError(`${result.created} added, ${result.skipped} already present, ${result.failed.length} rejected.`);
        setBusy(false);
        return;
      }
      await onDone(
        `Imported ${result.created} question${result.created === 1 ? "" : "s"}` +
          (result.skipped ? `, skipped ${result.skipped} already in the bank.` : "."),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Import questions" meta={`Into ${exam.name}`} />
      <div className="space-y-3 px-5 py-4">
        <p className="text-[13px] leading-relaxed text-ink-2">
          Paste a JSON array. Name the section by its name or short name ({" "}
          {exam.sections.map((s) => s.shortName).join(", ")} ), give the options in order, and set{" "}
          <code className="font-mono text-[12.5px]">answerIndex</code> to the position of the correct
          one, counting from zero. <code className="font-mono text-[12.5px]">topic</code> and{" "}
          <code className="font-mono text-[12.5px]">difficulty</code> are optional.
        </p>

        <textarea
          value={text}
          rows={10}
          spellCheck={false}
          placeholder={SAMPLE}
          onChange={(e) => setText(e.target.value)}
          className="thin-scroll w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        />

        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={status === "DRAFT"}
            onChange={(e) => setStatus(e.target.checked ? "DRAFT" : "PUBLISHED")}
          />
          Import as drafts, so they are not served until reviewed
        </label>

        {error ? <Notice tone="bad">{error}</Notice> : null}
        {failures.length ? (
          <div className="rounded-md border border-line bg-subtle px-4 py-3">
            <div className="eyebrow">Rejected rows</div>
            <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
              {failures.slice(0, 12).map((f) => (
                <li key={f.row}>
                  Row {f.row}: {f.reason}
                </li>
              ))}
              {failures.length > 12 ? <li>…and {failures.length - 12} more.</li> : null}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button variant="primary" disabled={busy || !text.trim()} onClick={run}>
            {busy ? <Spinner /> : null}
            Import
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Panel>
  );
}
