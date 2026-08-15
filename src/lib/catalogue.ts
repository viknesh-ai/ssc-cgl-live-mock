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

/** Exams grouped by where they are sat, for the catalogue page. */
export function byRegion(exams: CatalogueExam[]) {
  const groups = new Map<string, CatalogueExam[]>();
  for (const exam of exams) {
    const key = exam.region?.trim() || "Other";
    groups.set(key, [...(groups.get(key) ?? []), exam]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });
}
