"use client";

import { useEffect, useState } from "react";
import { StudioShell } from "@/components/studio/studio-shell";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Notice,
  Panel,
  PanelHeader,
  Spinner,
  cx,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ExamView } from "@/lib/types";

type SectionDraft = { id?: number; name: string; shortName: string };
type Draft = {
  id?: number;
  name: string;
  description: string;
  region: string;
  correctMark: number;
  wrongMark: number;
  sections: SectionDraft[];
};

/** Common shapes, so a new exam is a couple of clicks rather than a form to fill. */
const PRESETS: { label: string; region: string; marks: [number, number]; sections: string[][] }[] = [
  {
    label: "SSC / Railways pattern",
    region: "India",
    marks: [2, -0.5],
    sections: [
      ["General Intelligence & Reasoning", "Reasoning"],
      ["General Awareness", "General Awareness"],
      ["Quantitative Aptitude", "Quantitative"],
      ["English Language & Comprehension", "English"],
    ],
  },
  {
    label: "Banking (IBPS / SBI) pattern",
    region: "India",
    marks: [1, -0.25],
    sections: [
      ["Reasoning Ability", "Reasoning"],
      ["Quantitative Aptitude", "Quantitative"],
      ["English Language", "English"],
      ["General & Banking Awareness", "Awareness"],
    ],
  },
  {
    label: "UPSC Prelims pattern",
    region: "India",
    marks: [2, -0.66],
    sections: [
      ["General Studies", "GS"],
      ["Civil Services Aptitude Test", "CSAT"],
    ],
  },
  {
    label: "SAT pattern",
    region: "United States",
    marks: [1, 0],
    sections: [
      ["Reading and Writing", "Reading & Writing"],
      ["Mathematics", "Maths"],
    ],
  },
  {
    label: "GRE General pattern",
    region: "International",
    marks: [1, 0],
    sections: [
      ["Verbal Reasoning", "Verbal"],
      ["Quantitative Reasoning", "Quantitative"],
    ],
  },
  {
    label: "IELTS Academic pattern",
    region: "International",
    marks: [1, 0],
    sections: [
      ["Listening", "Listening"],
      ["Reading", "Reading"],
      ["Writing", "Writing"],
    ],
  },
];

const blank = (): Draft => ({
  name: "",
  description: "",
  region: "",
  correctMark: 1,
  wrongMark: 0,
  sections: [{ name: "", shortName: "" }],
});

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamView[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void reload();
  }, []);

  const reload = async () => {
    try {
      const data = await api<{ exams: ExamView[] }>("/api/exams");
      setExams(data.exams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load exams.");
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) =>
    setDraft((prev) => ({
      ...(prev ?? blank()),
      region: preset.region,
      correctMark: preset.marks[0],
      wrongMark: preset.marks[1],
      sections: preset.sections.map(([name, shortName]) => ({ name, shortName })),
    }));

  const save = async () => {
    if (!draft?.name.trim()) return;
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      region: draft.region.trim() || null,
      correctMark: draft.correctMark,
      wrongMark: draft.wrongMark,
      sections: draft.sections
        .filter((s) => s.name.trim())
        .map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          name: s.name.trim(),
          shortName: s.shortName.trim() || s.name.trim(),
        })),
    };
    try {
      if (draft.id) await api(`/api/exams/${draft.id}`, { method: "PATCH", body });
      else await api("/api/exams", { method: "POST", body });
      setDraft(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the exam.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StudioShell
      title="Exams"
      description="An exam is a shape: what its sections are called and how it is marked. Papers and questions hang off it."
      actions={
        <Button variant="primary" onClick={() => setDraft(blank())}>
          New exam
        </Button>
      }
    >
      <div className="space-y-5">
        {error ? <Notice tone="bad">{error}</Notice> : null}

        {draft ? (
          <Panel>
            <PanelHeader title={draft.id ? `Edit ${draft.name || "exam"}` : "New exam"} />
            <div className="space-y-4 px-5 py-4">
              {!draft.id ? (
                <div>
                  <span className="eyebrow block">Start from a known pattern</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset)}
                        className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] text-ink-2 hover:bg-subtle hover:text-ink"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow block">Name</span>
                  <Input
                    value={draft.name}
                    placeholder="SSC CHSL Tier-I"
                    className="mt-1.5"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="eyebrow block">Region</span>
                  <Input
                    value={draft.region}
                    placeholder="India"
                    className="mt-1.5"
                    onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="eyebrow block">Description</span>
                <Input
                  value={draft.description}
                  placeholder="What this exam is, in one line."
                  className="mt-1.5"
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow block">Marks for a correct answer</span>
                  <Input
                    type="number"
                    step="0.25"
                    value={draft.correctMark}
                    className="mt-1.5"
                    onChange={(e) => setDraft({ ...draft, correctMark: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="eyebrow block">Marks for a wrong answer (negative or zero)</span>
                  <Input
                    type="number"
                    step="0.25"
                    max={0}
                    value={draft.wrongMark}
                    className="mt-1.5"
                    onChange={(e) => setDraft({ ...draft, wrongMark: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div>
                <span className="eyebrow block">Sections</span>
                <div className="mt-2 space-y-2">
                  {draft.sections.map((section, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Input
                        value={section.name}
                        placeholder="Full name, e.g. Quantitative Aptitude"
                        className="min-w-60 flex-1"
                        onChange={(e) => {
                          const sections = [...draft.sections];
                          sections[i] = { ...section, name: e.target.value };
                          setDraft({ ...draft, sections });
                        }}
                      />
                      <Input
                        value={section.shortName}
                        placeholder="Short name"
                        className="w-44"
                        onChange={(e) => {
                          const sections = [...draft.sections];
                          sections[i] = { ...section, shortName: e.target.value };
                          setDraft({ ...draft, sections });
                        }}
                      />
                      {draft.sections.length > 1 ? (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              sections: draft.sections.filter((_, index) => index !== i),
                            })
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="quiet"
                  className="mt-2"
                  onClick={() =>
                    setDraft({ ...draft, sections: [...draft.sections, { name: "", shortName: "" }] })
                  }
                >
                  Add section
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="primary" disabled={busy || !draft.name.trim()} onClick={save}>
                  {busy ? <Spinner /> : null}
                  {draft.id ? "Save changes" : "Create exam"}
                </Button>
                <Button onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </div>
          </Panel>
        ) : null}

        {exams === null ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : exams.length === 0 ? (
          <Panel>
            <EmptyState title="No exams yet" hint="Create one to start building a question bank." />
          </Panel>
        ) : (
          exams.map((exam) => (
            <Panel key={exam.id}>
              <PanelHeader
                title={exam.name}
                meta={`${exam.region ?? "Unspecified region"} · +${exam.correctMark} / ${exam.wrongMark} · ${exam.questionCount} questions · ${exam.paperCount} paper${exam.paperCount === 1 ? "" : "s"}`}
                actions={
                  <Button
                    size="sm"
                    onClick={() =>
                      setDraft({
                        id: exam.id,
                        name: exam.name,
                        description: exam.description ?? "",
                        region: exam.region ?? "",
                        correctMark: exam.correctMark,
                        wrongMark: exam.wrongMark,
                        sections: exam.sections.map((s) => ({
                          id: s.id,
                          name: s.name,
                          shortName: s.shortName,
                        })),
                      })
                    }
                  >
                    Edit
                  </Button>
                }
              />
              <ul className="divide-y divide-line">
                {exam.sections.map((section) => (
                  <li
                    key={section.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13.5px]"
                  >
                    <span className="text-ink">{section.name}</span>
                    <span
                      className={cx(
                        "tabular",
                        section.questionCount === 0 ? "text-bad" : "text-ink-3",
                      )}
                    >
                      {section.questionCount} question{section.questionCount === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
              {exam.questionCount === 0 ? (
                <div className="border-t border-line px-5 py-3">
                  <Badge tone="warn">Empty — import or write questions before running it</Badge>
                </div>
              ) : null}
            </Panel>
          ))
        )}
      </div>
    </StudioShell>
  );
}
