/** Shapes exchanged between the server, the REST API and the browser. */
import type {
  AttemptMode,
  AttemptStatus,
  Difficulty,
  QuestionStatus,
  RoomStatus,
} from "@/generated/prisma/enums";
import type { ScoreSheet } from "@/lib/exam";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  role: "CANDIDATE" | "EXAMINER";
};

/** A paper's shape, as the browser needs it to lay out the exam. */
export type PaperView = {
  name: string;
  examName: string;
  correctMark: number;
  wrongMark: number;
  maxScore: number;
  totalQuestions: number;
  sections: {
    index: number;
    name: string;
    shortName: string;
    questionCount: number;
    minutes: number;
    offset: number;
  }[];
};

export type QuestionView = {
  order: number;
  sectionIndex: number;
  questionId: number;
  text: string;
  options: string[];
  selected: number | null;
  marked: boolean;
  /** Only present once the paper has been submitted. */
  answerIndex?: number;
};

export type AttemptState = {
  attemptId: number;
  mode: AttemptMode;
  status: AttemptStatus;
  currentSection: number;
  currentIndex: number;
  sectionMinutes: number;
  /** Epoch ms when the current section locks; null before the exam starts. */
  deadlineAt: number | null;
  /**
   * Milliseconds left in this section, measured by the server. While the room
   * is paused this stops decreasing, so the browser can simply tick it down.
   */
  remainingMs: number | null;
  serverNow: number;
  paused: boolean;
  tabSwitches: number;
  paper: PaperView;
  questions: QuestionView[];
  room: {
    code: string;
    title: string;
    status: RoomStatus;
    examinerName: string;
  } | null;
};

export type AttemptResult = {
  attemptId: number;
  paperName: string;
  examName: string;
  submittedAt: string | null;
  score: ScoreSheet;
  questions: (QuestionView & { answerIndex: number })[];
};

export type CandidateLive = {
  attemptId: number;
  userId: number;
  name: string;
  email: string;
  photoUrl: string | null;
  status: AttemptStatus;
  online: boolean;
  cameraOn: boolean;
  currentSection: number;
  currentSectionName: string;
  sectionQuestionCount: number;
  currentIndex: number;
  answered: number;
  marked: number;
  correct: number;
  wrong: number;
  tabSwitches: number;
  deadlineAt: number | null;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number;
  joinedAt: string;
};

export type RoomView = {
  code: string;
  title: string;
  status: RoomStatus;
  paperId: number;
  paperName: string;
  examName: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  examinerName: string;
  candidateCount: number;
};

/** One candidate's full answer sheet, for the examiner's live view. */
export type CandidateSheet = {
  attemptId: number;
  name: string;
  currentSection: number;
  currentIndex: number;
  sections: { index: number; shortName: string; questionCount: number; offset: number }[];
  items: {
    order: number;
    sectionIndex: number;
    questionId: number;
    text: string;
    options: string[];
    selected: number | null;
    answerIndex: number;
    marked: boolean;
  }[];
};

export type ChatLine = {
  id: number;
  attemptId: number;
  body: string;
  fromExaminer: boolean;
  senderName: string;
  createdAt: string;
};

/* ------------------------------ question bank ----------------------------- */

export type ExamView = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  region: string | null;
  correctMark: number;
  wrongMark: number;
  sections: { id: number; order: number; name: string; shortName: string; questionCount: number }[];
  paperCount: number;
  questionCount: number;
};

export type PaperSummary = {
  id: number;
  name: string;
  description: string | null;
  examId: number;
  examName: string;
  archived: boolean;
  createdAt: string;
  totalQuestions: number;
  totalMinutes: number;
  maxScore: number;
  sections: {
    sectionId: number;
    name: string;
    shortName: string;
    questionCount: number;
    minutes: number;
    topic: string | null;
    /** Published questions available to draw from. */
    available: number;
  }[];
  sessionCount: number;
};

export type BankQuestion = {
  id: number;
  examId: number;
  examName: string;
  sectionId: number;
  sectionName: string;
  sectionShortName: string;
  text: string;
  options: string[];
  answerIndex: number;
  topic: string | null;
  difficulty: Difficulty | null;
  status: QuestionStatus;
  updatedAt: string;
  /** How the question has performed in real attempts. */
  stats: {
    served: number;
    correct: number;
    wrong: number;
    skipped: number;
    accuracy: number | null;
  };
  hasExplanation: boolean;
};

export type BankFacets = {
  topics: string[];
  total: number;
};
