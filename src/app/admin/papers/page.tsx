"use client";

import { useEffect, useState } from "react";
import { ConsoleShell } from "@/components/admin/console-shell";
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
import type { ExamView, PaperSummary } from "@/lib/types";

type Draft = {
  name: string;
  description: string;
  examId: number;
  sections: { sectionId: number; questionCount: number; minutes: number; topic: string }[];
};

export default function PapersPage() {
  const [papers, setPapers] = useState<PaperSummary[] | null>(null);
  const [exams, setExams] = useState<ExamView[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PaperSummary | null>(null);

  useEffect(() => {
    void reload();
    api<{ exams: ExamView[] }>("/api/exams")
      .then((data) => setExams(data.exams))
      .catch(() => setExams([]));
  }, []);

  const reload = async () => {
    try {
      const data = await api<{ papers: PaperSummary[] }>("/api/papers");
      setPapers(data.papers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load papers.");
    }
  };

  const startNew = () => {
    const exam = exams[0];
    if (!exam) return;
    setEditing(null);
    setDraft({
      name: "",
      description: "",
      examId: exam.id,
      sections: exam.sections.map((s) => ({
        sectionId: s.id,
        questionCount: 25,
        minutes: 15,
        topic: "",
      })),
    });
  };

  const startEdit = (paper: PaperSummary) => {
    setEditing(paper.id);
    setDraft({
      name: paper.name,
      description: paper.description ?? "",
      examId: paper.examId,
      sections: paper.sections.map((s) => ({
        sectionId: s.sectionId,
        questionCount: s.questionCount,
        minutes: s.minutes,
        topic: s.topic ?? "",
      })),
    });
  };

  const save = async () => {
    if (!draft?.name.trim()) return;
    setBusy(true);
    setError(null);
    const body = {
      examId: draft.examId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      sections: draft.sections.map((s) => ({
        sectionId: s.sectionId,
        questionCount: s.questionCount,
        minutes: s.minutes,
        topic: s.topic.trim() || null,
      })),
    };
    try {
      if (editing) await api(`/api/papers/${editing}`, { method: "PATCH", body });
      else await api("/api/papers", { method: "POST", body });
      setDraft(null);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the paper.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (paper: PaperSummary) => {
    setBusy(true);
    try {
      const res = await api<{ deleted: boolean; message?: string }>(`/api/papers/${paper.id}`, {
        method: "DELETE",
      });
      if (!res.deleted && res.message) setError(res.message);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the paper.");
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  const exam = exams.find((e) => e.id === draft?.examId);

  return (
    <ConsoleShell
      title="Papers"
      description="A paper says how many questions to draw from each section and how long each section runs. Candidates each get their own draw from the bank."
      actions={
        <Button variant="primary" disabled={!exams.length} onClick={startNew}>
          New paper
        </Button>
      }
    >
      <div className="space-y-5">
        {error ? <Notice tone="bad">{error}</Notice> : null}

        {draft && exam ? (
          <Panel>
            <PanelHeader title={editing ? "Edit paper" : "New paper"} meta={exam.name} />
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow block">Name</span>
                  <Input
                    value={draft.name}
                    placeholder="Full mock"
                    className="mt-1.5"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="eyebrow block">Description (optional)</span>
                  <Input
                    value={draft.description}
                    className="mt-1.5"
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="eyebrow py-2 pr-3">Section</th>
                      <th className="eyebrow py-2 pr-3 text-right">Questions</th>
                      <th className="eyebrow py-2 pr-3 text-right">Minutes</th>
                      <th className="eyebrow py-2 text-left">Topic filter</th>
                      <th className="eyebrow py-2 pl-3 text-right">In bank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.sections.map((row, i) => {
                      const section = exam.sections.find((s) => s.id === row.sectionId);
                      const short = (section?.questionCount ?? 0) < row.questionCount;
                      return (
                        <tr key={row.sectionId} className="border-b border-line last:border-0">
                          <td className="py-2 pr-3 font-medium text-ink">{section?.name}</td>
                          <td className="py-2 pr-3 text-right">
                            <Input
                              type="number"
                              min={1}
                              max={200}
                              value={row.questionCount}
                              className="ml-auto h-8 w-20 text-right"
                              onChange={(e) => {
                                const sections = [...draft.sections];
                                sections[i] = { ...row, questionCount: Number(e.target.value) };
                                setDraft({ ...draft, sections });
                              }}
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <Input
                              type="number"
                              min={1}
                              max={300}
                              value={row.minutes}
                              className="ml-auto h-8 w-20 text-right"
                              onChange={(e) => {
                                const sections = [...draft.sections];
                                sections[i] = { ...row, minutes: Number(e.target.value) };
                                setDraft({ ...draft, sections });
                              }}
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              value={row.topic}
                              placeholder="any"
                              className="h-8"
                              onChange={(e) => {
                                const sections = [...draft.sections];
                                sections[i] = { ...row, topic: e.target.value };
                                setDraft({ ...draft, sections });
                              }}
                            />
                          </td>
                          <td
                            className={cx(
                              "tabular py-2 pl-3 text-right",
                              short ? "text-bad" : "text-ink-3",
                            )}
                          >
                            {section?.questionCount ?? 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="primary" disabled={busy || !draft.name.trim()} onClick={save}>
                  {busy ? <Spinner /> : null}
                  {editing ? "Save changes" : "Create paper"}
                </Button>
                <Button
                  onClick={() => {
                    setDraft(null);
                    setEditing(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}

        {papers === null ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : papers.length === 0 ? (
          <Panel>
            <EmptyState title="No papers yet" hint="Create one to run a session." />
          </Panel>
        ) : (
          <div className="space-y-4">
            {papers.map((paper) => (
              <Panel key={paper.id}>
                <PanelHeader
                  title={paper.name}
                  meta={`${paper.examName} · ${paper.totalQuestions} questions · ${paper.totalMinutes} min · ${paper.maxScore} marks`}
                  actions={
                    <>
                      {paper.archived ? <Badge>Archived</Badge> : null}
                      {paper.sessionCount > 0 ? (
                        <Badge>
                          {paper.sessionCount} session{paper.sessionCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                      <Button size="sm" onClick={() => startEdit(paper)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirmDelete(paper)}>
                        Remove
                      </Button>
                    </>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="eyebrow px-5 py-2">Section</th>
                        <th className="eyebrow px-4 py-2 text-right">Questions</th>
                        <th className="eyebrow px-4 py-2 text-right">Minutes</th>
                        <th className="eyebrow px-4 py-2 text-left">Topic</th>
                        <th className="eyebrow px-5 py-2 text-right">In bank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paper.sections.map((s) => (
                        <tr key={s.sectionId} className="border-b border-line last:border-0">
                          <td className="px-5 py-2 text-ink">{s.name}</td>
                          <td className="tabular px-4 py-2 text-right text-ink">
                            {s.questionCount}
                          </td>
                          <td className="tabular px-4 py-2 text-right text-ink-2">{s.minutes}</td>
                          <td className="px-4 py-2 text-ink-2">{s.topic ?? "any"}</td>
                          <td
                            className={cx(
                              "tabular px-5 py-2 text-right",
                              s.available < s.questionCount ? "text-bad" : "text-ink-3",
                            )}
                          >
                            {s.available}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        tone="danger"
        title={`Remove "${confirmDelete?.name}"?`}
        body={
          confirmDelete && confirmDelete.sessionCount > 0
            ? "This paper has been used in a session, so it will be archived rather than deleted — past results stay intact."
            : "This paper has never been sat, so it will be deleted."
        }
        confirmLabel={busy ? "Removing…" : "Remove"}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
      />
    </ConsoleShell>
  );
}
