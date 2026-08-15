/** Shapes exchanged between the server, the REST API and the browser. */
import type { AttemptMode, AttemptStatus, RoomStatus, Section } from "@/generated/prisma/enums";
import type { ScoreSheet } from "@/lib/exam";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  role: "CANDIDATE" | "EXAMINER";
};

export type QuestionView = {
  order: number;
  questionId: number;
  section: Section;
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
  currentIndex: number;
  answered: number;
  marked: number;
  correct: number;
  wrong: number;
  tabSwitches: number;
  deadlineAt: number | null;
  submittedAt: string | null;
  totalScore: number | null;
  joinedAt: string;
};

export type RoomView = {
  code: string;
  title: string;
  status: RoomStatus;
  sectionMinutes: number;
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
  items: {
    order: number;
    questionId: number;
    section: Section;
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
