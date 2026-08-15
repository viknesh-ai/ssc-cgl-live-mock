"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StudioShell } from "@/components/studio/studio-shell";
import { QuestionEditor, type QuestionDraft } from "@/components/admin/question-editor";
import { QuestionImport } from "@/components/admin/question-import";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Notice,
  Panel,
  PanelHeader,
  Spinner,
  cx,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { OPTION_LETTERS } from "@/lib/exam";
import type { BankQuestion, ExamView } from "@/lib/types";

type Listing = {
  questions: BankQuestion[];
  total: number;
  page: number;
  perPage: number;
  topics: string[];
};

const PER_PAGE = 25;

export default function QuestionBankPage() {
  const [exams, setExams] = useState<ExamView[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | "">("");
  const [status, setStatus] = useState<"" | "PUBLISHED" | "DRAFT">("");
  const [difficulty, setDifficulty] = useState<"" | "EASY" | "MEDIUM" | "HARD">("");
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState<QuestionDraft | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BankQuestion | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    api<{ exams: ExamView[] }>("/api/exams")
      .then((data) => {
        setExams(data.exams);
        setExamId(data.exams[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load exams."));
  }, []);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    const params = new URLSearchParams({
      examId: String(examId),
      page: String(page),
      perPage: String(PER_PAGE),
    });
    if (sectionId) params.set("sectionId", String(sectionId));
    if (status) params.set("status", status);
    if (difficulty) params.set("difficulty", difficulty);
    if (topic) params.set("topic", topic);
    if (search.trim()) params.set("search", search.trim());

    try {
      setListing(await api<Listing>(`/api/questions?${params}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load questions.");
    } finally {
      setLoading(false);
    }
  }, [examId, sectionId, status, difficulty, topic, search, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const exam = useMemo(() => exams.find((e) => e.id === examId), [exams, examId]);
  const totalPages = listing ? Math.max(1, Math.ceil(listing.total / listing.perPage)) : 1;

  const remove = async (question: BankQuestion) => {
    try {
      const res = await api<{ deleted: boolean; message?: string }>(
        `/api/questions/${question.id}`,
        { method: "DELETE" },
      );
      setNotice(res.message ?? "Question deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the question.");
    } finally {
      setConfirmDelete(null);
    }
  };

  const resetFilters = () => {
    setSectionId("");
    setStatus("");
    setDifficulty("");
    setTopic("");
    setSearch("");
    setPage(1);
  };

  return (
    <StudioShell
      title="Question bank"
      description="Everything candidates can be asked. Papers draw from here, so a question added now is in the next session."
      actions={
        <>
          <Button onClick={() => setImporting(true)}>Import</Button>
          <Button
            variant="primary"
            disabled={!exam}
            onClick={() =>
              exam &&
              setEditing({
                examId: exam.id,
                sectionId: exam.sections[0]?.id ?? 0,
                text: "",
                options: ["", "", "", ""],
                answerIndex: 0,
                topic: "",
                difficulty: "",
                status: "PUBLISHED",
              })
            }
          >
            New question
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {notice ? (
          <Notice>
            {notice}{" "}
            <button className="underline" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </Notice>
        ) : null}

        {editing && exam ? (
          <QuestionEditor
            draft={editing}
            exam={exam}
            onCancel={() => setEditing(null)}
            onSaved={async (message) => {
              setEditing(null);
              setNotice(message);
              await load();
            }}
          />
        ) : null}

        {importing && exam ? (
          <QuestionImport
            exam={exam}
            onCancel={() => setImporting(false)}
            onDone={async (message) => {
              setImporting(false);
              setNotice(message);
              await load();
            }}
          />
        ) : null}

        <Panel>
          <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3.5">
            {exams.length > 1 ? (
              <label className="block">
                <span className="eyebrow block">Exam</span>
                <select
                  value={examId ?? ""}
                  onChange={(e) => {
                    setExamId(Number(e.target.value));
                    resetFilters();
                  }}
                  className="mt-1.5 h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
                >
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="eyebrow block">Section</span>
              <select
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value ? Number(e.target.value) : "");
                  setPage(1);
                }}
                className="mt-1.5 h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
              >
                <option value="">All sections</option>
                {exam?.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName} ({s.questionCount})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="eyebrow block">Status</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as typeof status);
                  setPage(1);
                }}
                className="mt-1.5 h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
              >
                <option value="">Any</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>

            <label className="block">
              <span className="eyebrow block">Difficulty</span>
              <select
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value as typeof difficulty);
                  setPage(1);
                }}
                className="mt-1.5 h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
              >
                <option value="">Any</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </label>

            {listing?.topics.length ? (
              <label className="block">
                <span className="eyebrow block">Topic</span>
                <select
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1.5 h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px]"
                >
                  <option value="">Any</option>
                  {listing.topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block min-w-52 flex-1">
              <span className="eyebrow block">Search</span>
              <Input
                value={search}
                placeholder="Find in question text"
                className="mt-1.5 h-9"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>

          {loading && !listing ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : !listing || listing.questions.length === 0 ? (
            <EmptyState
              title="No questions match"
              hint="Change the filters, or add a question with the button above."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="eyebrow px-5 py-2.5">Question</th>
                      <th className="eyebrow px-3 py-2.5">Section</th>
                      <th className="eyebrow px-3 py-2.5 text-right">Served</th>
                      <th className="eyebrow px-3 py-2.5 text-right">Correct</th>
                      <th className="eyebrow px-5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listing.questions.map((q) => (
                      <QuestionRow
                        key={q.id}
                        question={q}
                        expanded={expanded === q.id}
                        onToggle={() => setExpanded(expanded === q.id ? null : q.id)}
                        onEdit={() =>
                          setEditing({
                            id: q.id,
                            examId: q.examId,
                            sectionId: q.sectionId,
                            text: q.text,
                            options: q.options,
                            answerIndex: q.answerIndex,
                            topic: q.topic ?? "",
                            difficulty: q.difficulty ?? "",
                            status: q.status,
                          })
                        }
                        onDelete={() => setConfirmDelete(q)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
                <span className="text-[12.5px] text-ink-3">
                  {listing.total} question{listing.total === 1 ? "" : "s"} · page {listing.page} of{" "}
                  {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        tone="danger"
        title="Delete this question?"
        body={
          confirmDelete && confirmDelete.stats.served > 0
            ? `It has been served ${confirmDelete.stats.served} time${confirmDelete.stats.served === 1 ? "" : "s"}, so it will be moved to drafts instead — past results keep their questions.`
            : "It has never been served, so it will be deleted outright."
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
      />
    </StudioShell>
  );
}

function QuestionRow({
  question,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  question: BankQuestion;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { stats } = question;
  return (
    <>
      <tr className={cx("border-b border-line", expanded && "bg-subtle")}>
        <td className="px-5 py-3">
          <button onClick={onToggle} className="text-left">
            <span className="line-clamp-2 text-ink">{question.text}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {question.status === "DRAFT" ? <Badge tone="warn">Draft</Badge> : null}
              {question.topic ? <Badge>{question.topic}</Badge> : null}
              {question.difficulty ? <Badge>{question.difficulty.toLowerCase()}</Badge> : null}
              {question.hasExplanation ? <Badge tone="accent">AI note</Badge> : null}
            </span>
          </button>
        </td>
        <td className="px-3 py-3 text-ink-2">{question.sectionShortName}</td>
        <td className="tabular px-3 py-3 text-right text-ink-2">{stats.served}</td>
        <td
          className={cx(
            "tabular px-3 py-3 text-right",
            stats.accuracy === null
              ? "text-ink-3"
              : stats.accuracy >= 60
                ? "text-ok"
                : stats.accuracy >= 30
                  ? "text-ink-2"
                  : "text-bad",
          )}
        >
          {stats.accuracy === null ? "—" : `${stats.accuracy}%`}
        </td>
        <td className="px-5 py-3">
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-line bg-subtle">
          <td colSpan={5} className="px-5 py-3">
            <ul className="space-y-1">
              {question.options.map((option, i) => (
                <li
                  key={i}
                  className={cx(
                    "flex gap-2 rounded-sm px-2 py-1",
                    i === question.answerIndex ? "bg-ok-soft text-ok" : "text-ink-2",
                  )}
                >
                  <span className="font-semibold">{OPTION_LETTERS[i]}</span>
                  <span className="text-ink">{option}</span>
                  {i === question.answerIndex ? (
                    <span className="ml-auto text-[12px] font-medium">Key</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-3">
              Served {question.stats.served} · correct {question.stats.correct} · wrong{" "}
              {question.stats.wrong} · skipped {question.stats.skipped} · updated{" "}
              {new Date(question.updatedAt).toLocaleDateString()}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
