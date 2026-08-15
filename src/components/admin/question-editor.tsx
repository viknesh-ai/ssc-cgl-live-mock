"use client";

import { useState } from "react";
import { Button, Input, Notice, Panel, PanelHeader, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api-client";
import { OPTION_LETTERS } from "@/lib/exam";
import type { ExamView } from "@/lib/types";

export type QuestionDraft = {
  id?: number;
  examId: number;
  sectionId: number;
  text: string;
  options: string[];
  answerIndex: number;
  topic: string;
  difficulty: "" | "EASY" | "MEDIUM" | "HARD";
  status: "DRAFT" | "PUBLISHED";
};

/** Write or correct one question. The correct option is chosen, not typed. */
export function QuestionEditor({
  draft,
  exam,
  onCancel,
  onSaved,
}: {
  draft: QuestionDraft;
  exam: ExamView;
  onCancel: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const filled = form.options.filter((o) => o.trim()).length;
  const valid = form.text.trim().length >= 5 && filled >= 2 && form.options[form.answerIndex]?.trim();

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      sectionId: form.sectionId,
      text: form.text.trim(),
      options: form.options.map((o) => o.trim()).filter(Boolean),
      answerIndex: form.answerIndex,
      topic: form.topic.trim() || null,
      difficulty: form.difficulty || null,
      status: form.status,
    };
    try {
      if (form.id) {
        await api(`/api/questions/${form.id}`, { method: "PATCH", body });
        await onSaved("Question updated.");
      } else {
        await api("/api/questions", { method: "POST", body: { ...body, examId: form.examId } });
        await onSaved("Question added to the bank.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the question.");
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title={form.id ? "Edit question" : "New question"} meta={exam.name} />
      <div className="space-y-4 px-5 py-4">
        <label className="block">
          <span className="eyebrow block">Question</span>
          <textarea
            value={form.text}
            rows={3}
            onChange={(e) => set("text", e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px] leading-relaxed text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            placeholder="Select the number that will come next in the series: 6, 11, 21, 36, 56, ?"
          />
        </label>

        <div>
          <span className="eyebrow block">Options — click the circle to mark the correct one</span>
          <div className="mt-1.5 space-y-2">
            {form.options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Mark ${OPTION_LETTERS[i]} correct`}
                  onClick={() => set("answerIndex", i)}
                  className={cx(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors",
                    form.answerIndex === i
                      ? "border-ok bg-ok text-white"
                      : "border-line-strong text-ink-3 hover:border-ink-3",
                  )}
                >
                  {OPTION_LETTERS[i]}
                </button>
                <Input
                  value={option}
                  placeholder={`Option ${OPTION_LETTERS[i]}`}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[i] = e.target.value;
                    set("options", options);
                  }}
                />
                {form.options.length > 2 ? (
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      const options = form.options.filter((_, index) => index !== i);
                      setForm((prev) => ({
                        ...prev,
                        options,
                        answerIndex: Math.min(prev.answerIndex, options.length - 1),
                      }));
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          {form.options.length < 6 ? (
            <Button
              size="sm"
              variant="quiet"
              className="mt-2"
              onClick={() => set("options", [...form.options, ""])}
            >
              Add option
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="eyebrow block">Section</span>
            <select
              value={form.sectionId}
              onChange={(e) => set("sectionId", Number(e.target.value))}
              className="mt-1.5 h-9.5 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
            >
              {exam.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow block">Topic</span>
            <Input
              value={form.topic}
              placeholder="e.g. Series"
              className="mt-1.5"
              onChange={(e) => set("topic", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="eyebrow block">Difficulty</span>
            <select
              value={form.difficulty}
              onChange={(e) => set("difficulty", e.target.value as QuestionDraft["difficulty"])}
              className="mt-1.5 h-9.5 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
            >
              <option value="">Unset</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </label>
          <label className="block">
            <span className="eyebrow block">Status</span>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as QuestionDraft["status"])}
              className="mt-1.5 h-9.5 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
            >
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>
        </div>

        {error ? <Notice tone="bad">{error}</Notice> : null}

        <div className="flex items-center gap-2">
          <Button variant="primary" disabled={busy || !valid} onClick={save}>
            {busy ? <Spinner /> : null}
            {form.id ? "Save changes" : "Add question"}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
          {!valid ? (
            <span className="text-[12.5px] text-ink-3">
              Needs question text, at least two options, and a correct option that is filled in.
            </span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
