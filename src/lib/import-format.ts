/**
 * Turning the text of an uploaded question paper into structured questions.
 *
 * Pure string work, no file handling — reading PDFs and Word documents lives in
 * extract-text.ts, which is server-only. Keeping them apart means the browser
 * can share these types and the template sample without pulling in a PDF
 * library.
 *
 * The expected layout, per question:
 *
 *   Section: Quantitative Aptitude        (optional, applies until changed)
 *   1. A train 180 m long crosses a pole in 12 seconds. Find its speed.
 *   (A) 54 km/h
 *   (B) 60 km/h
 *   (C) 45 km/h
 *   (D) 72 km/h
 *   Answer: A
 *   Explanation: Speed = 180 / 12 = 15 m/s = 54 km/h.
 *   Topic: Speed and distance                (optional)
 *   Difficulty: Easy                         (optional)
 *
 * Question numbers may be "1.", "1)", "Q1." or "Q.1"; options may be "(A)",
 * "A)", "A." or "a)"; the answer may be a letter or the option's full text.
 */

export type ParsedQuestion = {
  section: string | null;
  text: string;
  options: string[];
  answerIndex: number;
  explanation: string | null;
  topic: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
};

export type ParseProblem = { near: string; reason: string };

export type ParseResult = {
  questions: ParsedQuestion[];
  problems: ParseProblem[];
};

const QUESTION_START = /^(?:Q\s*[.:)]?\s*)?(\d{1,3})\s*[.):]\s*(.*)$/i;
const OPTION_LINE = /^\(?([A-Da-d1-4])\)?\s*[.):]?\s+(.*)$/;
const FIELD_LINE = /^(section|answer|ans|correct|explanation|exp|solution|topic|difficulty|level)\s*[:\-]\s*(.*)$/i;

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Parses extracted text into questions, reporting anything it had to skip. */
export function parseQuestions(raw: string): ParseResult {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, "").replace(/^\s+/, ""))
    .filter((line) => line.length > 0);

  const questions: ParsedQuestion[] = [];
  const problems: ParseProblem[] = [];

  let currentSection: string | null = null;
  let block: {
    number: string;
    text: string[];
    options: string[];
    answer: string | null;
    explanation: string[];
    topic: string | null;
    difficulty: ParsedQuestion["difficulty"];
    section: string | null;
  } | null = null;
  /** Where free text goes: the question stem, or the explanation. */
  let sink: "text" | "explanation" = "text";

  const finish = () => {
    if (!block) return;
    const text = block.text.join(" ").trim();
    const near = text.slice(0, 60) || `question ${block.number}`;

    if (!text) problems.push({ near: `question ${block.number}`, reason: "No question text" });
    else if (block.options.length < 2) {
      problems.push({ near, reason: `Only ${block.options.length} option(s) found` });
    } else if (!block.answer) {
      problems.push({ near, reason: "No answer marked" });
    } else {
      const answerIndex = resolveAnswer(block.answer, block.options);
      if (answerIndex === null) {
        problems.push({ near, reason: `Answer "${block.answer}" does not match any option` });
      } else {
        questions.push({
          section: block.section,
          text,
          options: block.options,
          answerIndex,
          explanation: block.explanation.join(" ").trim() || null,
          topic: block.topic,
          difficulty: block.difficulty,
        });
      }
    }
    block = null;
    sink = "text";
  };

  for (const line of lines) {
    const field = FIELD_LINE.exec(line);
    if (field) {
      const key = field[1].toLowerCase();
      const value = field[2].trim();

      if (key === "section") {
        // A section heading applies to every question that follows it.
        finish();
        currentSection = value || null;
        continue;
      }
      if (!block) continue;

      if (key === "answer" || key === "ans" || key === "correct") {
        block.answer = value;
        sink = "text";
      } else if (key === "explanation" || key === "exp" || key === "solution") {
        block.explanation.push(value);
        sink = "explanation";
      } else if (key === "topic") {
        block.topic = value || null;
      } else if (key === "difficulty" || key === "level") {
        const upper = value.toUpperCase();
        block.difficulty =
          upper.startsWith("E") ? "EASY" : upper.startsWith("M") ? "MEDIUM" : upper.startsWith("H") ? "HARD" : null;
      }
      continue;
    }

    const start = QUESTION_START.exec(line);
    // A numbered line only starts a new question once the previous one has its
    // options — otherwise "1. 2. 3." inside a passage would split it.
    if (start && (!block || block.options.length > 0)) {
      finish();
      block = {
        number: start[1],
        text: start[2] ? [start[2]] : [],
        options: [],
        answer: null,
        explanation: [],
        topic: null,
        difficulty: null,
        section: currentSection,
      };
      sink = "text";
      continue;
    }

    if (!block) continue;

    const option = OPTION_LINE.exec(line);
    if (option && sink !== "explanation") {
      const label = option[1].toUpperCase();
      const expected = LETTERS[block.options.length];
      const numeric = String(block.options.length + 1);
      // Only accept the option that comes next, so numbers inside the stem are
      // not mistaken for choices.
      if (label === expected || label === numeric) {
        block.options.push(option[2].trim());
        continue;
      }
    }

    if (sink === "explanation") block.explanation.push(line);
    else if (block.options.length === 0) block.text.push(line);
    else block.options[block.options.length - 1] += ` ${line}`;
  }

  finish();
  return { questions, problems };
}

/** An answer may be given as a letter, a number, or the option's own text. */
function resolveAnswer(answer: string, options: string[]): number | null {
  const cleaned = answer.trim().replace(/^\(|\)$/g, "").replace(/[.)]$/, "").trim();

  const letter = /^[A-Fa-f]$/.exec(cleaned);
  if (letter) {
    const index = LETTERS.indexOf(letter[0].toUpperCase());
    return index < options.length ? index : null;
  }

  const numeric = /^[1-9]$/.exec(cleaned);
  if (numeric) {
    const index = Number(numeric[0]) - 1;
    return index < options.length ? index : null;
  }

  const exact = options.findIndex((o) => o.toLowerCase() === cleaned.toLowerCase());
  if (exact >= 0) return exact;

  // "Answer: B) 60 km/h" — a letter followed by the option text.
  const prefixed = /^([A-Fa-f])\s*[.):]\s*(.+)$/.exec(cleaned);
  if (prefixed) {
    const index = LETTERS.indexOf(prefixed[1].toUpperCase());
    if (index < options.length) return index;
  }
  return null;
}

/** The layout shown to whoever is preparing a file. */
export const TEMPLATE_SAMPLE = `Section: Quantitative Aptitude

1. A train 180 m long crosses a pole in 12 seconds. What is its speed?
(A) 54 km/h
(B) 60 km/h
(C) 45 km/h
(D) 72 km/h
Answer: A
Explanation: Speed = 180 / 12 = 15 m/s = 15 × 18/5 = 54 km/h.
Topic: Speed and distance
Difficulty: Easy

2. Simplify: 25% of 480 + 15% of 200
(A) 140
(B) 150
(C) 130
(D) 160
Answer: B
Explanation: 120 + 30 = 150.`;
