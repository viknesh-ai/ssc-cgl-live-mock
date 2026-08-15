/**
 * Exam rules.
 *
 * Nothing here is specific to one examination any more: a paper's shape — its
 * sections, how many questions each holds, how long each runs and how it is
 * marked — comes from the database as a PaperSpec, and these helpers work off
 * that. Adding a second exam is data, not code.
 */

export type SectionSpec = {
  /** 0-based position within the paper. */
  index: number;
  sectionId: number;
  name: string;
  shortName: string;
  questionCount: number;
  minutes: number;
  /** Optional filter: draw only questions carrying this topic. */
  topic: string | null;
  /** Position of this section's first question in the whole paper. */
  offset: number;
};

export type PaperSpec = {
  paperId: number;
  paperName: string;
  examId: number;
  examName: string;
  correctMark: number;
  wrongMark: number;
  sections: SectionSpec[];
  totalQuestions: number;
  maxScore: number;
  totalMinutes: number;
};

export const MAX_TAB_SWITCHES = 3;
export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
export const DEFAULT_SECTION_MINUTES = 15;
export const DEFAULT_QUESTIONS_PER_SECTION = 25;

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
  index: number;
  name: string;
  shortName: string;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  accuracy: number;
};

export type ScoreSheet = {
  total: number;
  maxScore: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  sections: SectionResult[];
};

export function scoreAttempt(
  items: { sectionIndex: number; selected: number | null; answerIndex: number }[],
  spec: Pick<PaperSpec, "sections" | "correctMark" | "wrongMark" | "maxScore">,
): ScoreSheet {
  const sections: SectionResult[] = spec.sections.map((s) => ({
    index: s.index,
    name: s.name,
    shortName: s.shortName,
    correct: 0,
    wrong: 0,
    skipped: 0,
    score: 0,
    accuracy: 0,
  }));

  for (const item of items) {
    const row = sections[item.sectionIndex];
    if (!row) continue;
    if (item.selected === null || item.selected === undefined) row.skipped++;
    else if (item.selected === item.answerIndex) row.correct++;
    else row.wrong++;
  }

  let total = 0;
  for (const row of sections) {
    row.score = round(row.correct * spec.correctMark + row.wrong * spec.wrongMark);
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
    maxScore: spec.maxScore,
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
