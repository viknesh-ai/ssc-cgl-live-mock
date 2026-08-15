"use client";

import { useEffect, useState } from "react";

/** The public prospectus, as the browser sees it. */
export type CataloguePaper = {
  id: number;
  name: string;
  description: string | null;
  questions: number;
  minutes: number;
  maxScore: number;
  ready: boolean;
  sections: { name: string; shortName: string; questionCount: number; minutes: number }[];
};

export type CatalogueExam = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  region: string | null;
  correctMark: number;
  wrongMark: number;
  questionCount: number;
  sections: { name: string; shortName: string }[];
  papers: CataloguePaper[];
};

export function useCatalogue() {
  const [exams, setExams] = useState<CatalogueExam[] | null>(null);
  useEffect(() => {
    fetch("/api/catalogue")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => setExams([]));
  }, []);
  return exams;
}

/**
 * The exams we intend to carry, grouped the way candidates think about them.
 *
 * Anything here that is not yet in the database shows as coming soon; the
 * moment an exam of the same name is created in the studio and given a paper,
 * the same entry becomes a live link. Nothing here needs changing when that
 * happens.
 */
export const PLANNED_GROUPS: { title: string; exams: string[] }[] = [
  {
    title: "Staff Selection & Railways",
    exams: [
      "SSC CGL Tier-I",
      "SSC CHSL Tier-I",
      "SSC MTS",
      "SSC GD Constable",
      "RRB NTPC",
      "RRB Group D",
    ],
  },
  {
    title: "Banking & Insurance",
    exams: [
      "IBPS PO Prelims",
      "IBPS Clerk Prelims",
      "SBI PO Prelims",
      "SBI Clerk Prelims",
      "RBI Grade B",
      "NIACL AO",
    ],
  },
  {
    title: "Civil services & State",
    exams: ["UPSC Prelims", "TNPSC Group II", "MPSC Prelims", "State PSC Prelims"],
  },
  {
    title: "Campus & Management",
    exams: ["CAT", "GATE", "NIMCET", "TANCET"],
  },
  {
    title: "Study abroad",
    exams: ["SAT", "GRE General", "GMAT Focus", "IELTS Academic", "TOEFL iBT"],
  },
];

export type CatalogueEntry = {
  name: string;
  /** Present once the exam exists and has a paper to sit. */
  live: CatalogueExam | null;
};

const key = (name: string) => name.trim().toLowerCase();

/** Merges what the database holds into the planned list. */
export function catalogueGroups(exams: CatalogueExam[]) {
  const byName = new Map(exams.map((e) => [key(e.name), e]));
  const claimed = new Set<string>();

  const groups = PLANNED_GROUPS.map((group) => ({
    title: group.title,
    entries: group.exams.map((name): CatalogueEntry => {
      const match = byName.get(key(name));
      if (match) claimed.add(key(name));
      return { name, live: match && match.papers.length > 0 ? match : null };
    }),
  }));

  // Anything created in the studio that the planned list does not mention.
  const extra = exams.filter((e) => !claimed.has(key(e.name)) && e.papers.length > 0);
  if (extra.length) {
    groups.push({
      title: "Also available",
      entries: extra.map((e) => ({ name: e.name, live: e })),
    });
  }
  return groups;
}

/** Every exam that can actually be sat right now. */
export function liveExams(exams: CatalogueExam[]) {
  return exams.filter((e) => e.papers.length > 0);
}
