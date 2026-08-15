/**
 * Exam rules, shared by the server and the browser.
 *
 * SSC CGL Tier-I: 100 questions in four fixed sections of 25, each section on
 * its own clock, +2 for a correct answer and -0.5 for a wrong one.
 */
import type { Section } from "@/generated/prisma/enums";

export const SECTION_ORDER = [
  "REASONING",
  "GENERAL_AWARENESS",
  "QUANTITATIVE",
  "ENGLISH",
] as const satisfies readonly Section[];

export const SECTION_LABEL: Record<Section, string> = {
  REASONING: "General Intelligence & Reasoning",
  GENERAL_AWARENESS: "General Awareness",
  QUANTITATIVE: "Quantitative Aptitude",
  ENGLISH: "English Language & Comprehension",
};

export const SECTION_SHORT: Record<Section, string> = {
  REASONING: "Reasoning",
  GENERAL_AWARENESS: "General Awareness",
  QUANTITATIVE: "Quantitative",
  ENGLISH: "English",
};

export const QUESTIONS_PER_SECTION = 25;
export const TOTAL_QUESTIONS = SECTION_ORDER.length * QUESTIONS_PER_SECTION;
export const MARK_CORRECT = 2;
export const MARK_WRONG = -0.5;
export const MAX_SCORE = TOTAL_QUESTIONS * MARK_CORRECT;
export const DEFAULT_SECTION_MINUTES = 15;
export const MAX_TAB_SWITCHES = 3;

export const sectionOf = (order: number) => Math.floor(order / QUESTIONS_PER_SECTION);
export const sectionName = (index: number) => SECTION_LABEL[SECTION_ORDER[index]] ?? "—";
export const sectionShort = (index: number) => SECTION_SHORT[SECTION_ORDER[index]] ?? "—";

/** Room codes are short and readable so they can be typed or read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateRoomCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export type SectionResult = {
  section: Section;
  label: string;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  accuracy: number;
};

export type ScoreSheet = {
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  sections: SectionResult[];
};

export function scoreAttempt(
  items: { order: number; selected: number | null; answerIndex: number }[],
): ScoreSheet {
  const sections: SectionResult[] = SECTION_ORDER.map((section) => ({
    section,
    label: SECTION_LABEL[section],
    correct: 0,
    wrong: 0,
    skipped: 0,
    score: 0,
    accuracy: 0,
  }));

  for (const item of items) {
    const row = sections[sectionOf(item.order)];
    if (!row) continue;
    if (item.selected === null || item.selected === undefined) row.skipped++;
    else if (item.selected === item.answerIndex) row.correct++;
    else row.wrong++;
  }

  let total = 0;
  for (const row of sections) {
    row.score = round(row.correct * MARK_CORRECT + row.wrong * MARK_WRONG);
    const attempted = row.correct + row.wrong;
    row.accuracy = attempted ? round((row.correct / attempted) * 100, 1) : 0;
    total += row.score;
  }

  const correct = sections.reduce((n, s) => n + s.correct, 0);
  const wrong = sections.reduce((n, s) => n + s.wrong, 0);
  const skipped = sections.reduce((n, s) => n + s.skipped, 0);
  const attempted = correct + wrong;

  return {
    total: round(total),
    attempted,
    correct,
    wrong,
    skipped,
    accuracy: attempted ? round((correct / attempted) * 100, 1) : 0,
    sections,
  };
}

export function round(n: number, places = 2) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/**
 * When the candidate's current section ends, in epoch milliseconds.
 *
 * Each section starts a fresh clock, so submitting a section early does not
 * carry unused time forward, and time spent while the examiner has the room
 * paused is added back on.
 */
export function sectionDeadline(attempt: {
  sectionStartedAt: Date | string | null;
  sectionMinutes: number;
  pausedMs: number;
}): number | null {
  if (!attempt.sectionStartedAt) return null;
  const start = new Date(attempt.sectionStartedAt).getTime();
  return start + attempt.sectionMinutes * 60_000 + attempt.pausedMs;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
