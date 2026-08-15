/**
 * The exam engine.
 *
 * The server owns the clock and the answer key. A candidate's browser can only
 * report what was picked; when a section ends, who is in which section, and
 * whether an answer was right are all decided here.
 */
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-server";
import {
  QUESTIONS_PER_SECTION,
  SECTION_ORDER,
  scoreAttempt,
  sectionDeadline,
  sectionOf,
} from "@/lib/exam";
import type { AttemptResult, AttemptState, CandidateLive, CandidateSheet } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const attemptInclude = {
  user: true,
  room: { include: { examiner: true } },
  items: { orderBy: { order: "asc" }, include: { question: true } },
} satisfies Prisma.AttemptInclude;

export type FullAttempt = Prisma.AttemptGetPayload<{ include: typeof attemptInclude }>;

export function getAttempt(id: number) {
  return prisma.attempt.findUnique({ where: { id }, include: attemptInclude });
}

/**
 * Picks a fresh paper: 25 questions per section, preferring ones this
 * candidate has not seen before, falling back to the whole pool once the bank
 * has been exhausted.
 */
async function drawPaper(userId: number): Promise<number[]> {
  const seen = await prisma.seenQuestion.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const seenIds = new Set(seen.map((s) => s.questionId));
  const picked: number[] = [];

  for (const section of SECTION_ORDER) {
    const pool = await prisma.question.findMany({ where: { section }, select: { id: true } });
    if (pool.length < QUESTIONS_PER_SECTION) {
      throw new HttpError(
        503,
        `The question bank has only ${pool.length} ${section} questions; ${QUESTIONS_PER_SECTION} are needed. Run the seed script.`,
      );
    }
    let fresh = pool.filter((q) => !seenIds.has(q.id));
    if (fresh.length < QUESTIONS_PER_SECTION) fresh = pool;
    picked.push(...shuffle(fresh).slice(0, QUESTIONS_PER_SECTION).map((q) => q.id));
  }

  return picked;
}

function shuffle<T>(input: T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The candidate's attempt for a room, created on first join. Re-joining (or
 * reloading) returns the same paper rather than drawing a new one.
 */
export async function joinRoom(userId: number, roomCode: string): Promise<FullAttempt> {
  const room = await prisma.room.findUnique({ where: { code: roomCode } });
  if (!room) throw new HttpError(404, "That room code does not exist.");
  if (room.status === "ENDED") throw new HttpError(410, "This exam has already ended.");

  const existing = await prisma.attempt.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
    include: attemptInclude,
  });
  if (existing) return syncClock(existing);

  const questionIds = await drawPaper(userId);
  const created = await prisma.attempt.create({
    data: {
      userId,
      roomId: room.id,
      mode: "LIVE",
      sectionMinutes: room.sectionMinutes,
      status: room.status === "RUNNING" || room.status === "PAUSED" ? "IN_PROGRESS" : "WAITING",
      sectionStartedAt: room.status === "RUNNING" || room.status === "PAUSED" ? new Date() : null,
      items: {
        create: questionIds.map((questionId, order) => ({ questionId, order })),
      },
    },
    include: attemptInclude,
  });
  await recordSeen(userId, questionIds);
  return created;
}

/** Solo practice: no room, no examiner, clock starts immediately. */
export async function startSoloAttempt(userId: number): Promise<FullAttempt> {
  const open = await prisma.attempt.findFirst({
    where: { userId, roomId: null, status: { not: "SUBMITTED" } },
    include: attemptInclude,
    orderBy: { id: "desc" },
  });
  if (open) return syncClock(open);

  const questionIds = await drawPaper(userId);
  const created = await prisma.attempt.create({
    data: {
      userId,
      mode: "SOLO",
      status: "IN_PROGRESS",
      sectionStartedAt: new Date(),
      items: { create: questionIds.map((questionId, order) => ({ questionId, order })) },
    },
    include: attemptInclude,
  });
  await recordSeen(userId, questionIds);
  return created;
}

async function recordSeen(userId: number, questionIds: number[]) {
  await prisma.seenQuestion.createMany({
    data: questionIds.map((questionId) => ({ userId, questionId })),
    skipDuplicates: true,
  });
}

/**
 * Advances the clock: sections whose deadline has passed are closed, and the
 * paper is submitted once the last one runs out. Called before every read so
 * the state a client sees is always current, with no background job needed.
 */
export async function syncClock(attempt: FullAttempt): Promise<FullAttempt> {
  if (attempt.status !== "IN_PROGRESS" || !attempt.sectionStartedAt) return attempt;

  // While the examiner has the room paused, time simply stops advancing.
  const paused = attempt.room?.status === "PAUSED" && attempt.room.pausedAt;
  const now = paused ? new Date(attempt.room!.pausedAt!).getTime() : Date.now();

  let current = attempt;
  for (;;) {
    const deadline = sectionDeadline(current);
    if (deadline === null || now < deadline) break;

    if (current.currentSection >= SECTION_ORDER.length - 1) {
      return submitAttempt(current, new Date(deadline));
    }
    current = await prisma.attempt.update({
      where: { id: current.id },
      data: {
        currentSection: current.currentSection + 1,
        currentIndex: 0,
        // Anchor to the deadline, not to now, so sections do not drift.
        sectionStartedAt: new Date(deadline),
        pausedMs: 0,
      },
      include: attemptInclude,
    });
  }
  return current;
}

/** Early submit: closes the current section and opens the next on a fresh clock. */
export async function advanceSection(attempt: FullAttempt): Promise<FullAttempt> {
  if (attempt.status !== "IN_PROGRESS") throw new HttpError(409, "This paper is not in progress.");
  if (attempt.currentSection >= SECTION_ORDER.length - 1) return submitAttempt(attempt);

  return prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      currentSection: attempt.currentSection + 1,
      currentIndex: 0,
      sectionStartedAt: new Date(),
      pausedMs: 0,
    },
    include: attemptInclude,
  });
}

export async function submitAttempt(attempt: FullAttempt, at = new Date()): Promise<FullAttempt> {
  if (attempt.status === "SUBMITTED") return attempt;
  const sheet = scoreAttempt(
    attempt.items.map((item) => ({
      order: item.order,
      selected: item.selected,
      answerIndex: item.question.answerIndex,
    })),
  );
  return prisma.attempt.update({
    where: { id: attempt.id },
    data: { status: "SUBMITTED", submittedAt: at, totalScore: sheet.total },
    include: attemptInclude,
  });
}

/** Records an answer, a review flag, or simple navigation. */
export async function saveAnswer(
  attempt: FullAttempt,
  input: { order: number; selected?: number | null; marked?: boolean; currentIndex?: number },
): Promise<FullAttempt> {
  if (attempt.status !== "IN_PROGRESS") throw new HttpError(409, "This paper is closed.");

  const item = attempt.items.find((i) => i.order === input.order);
  if (!item) throw new HttpError(404, "No such question on this paper.");
  if (sectionOf(item.order) !== attempt.currentSection) {
    throw new HttpError(409, "That section is locked.");
  }
  if (input.selected !== undefined && input.selected !== null) {
    if (!Number.isInteger(input.selected) || input.selected < 0 || input.selected > 3) {
      throw new HttpError(400, "Invalid option.");
    }
  }

  const data: Prisma.AttemptQuestionUpdateInput = {};
  if (input.selected !== undefined) {
    data.selected = input.selected;
    data.answeredAt = input.selected === null ? null : new Date();
  }
  if (input.marked !== undefined) data.marked = input.marked;
  if (Object.keys(data).length) {
    await prisma.attemptQuestion.update({ where: { id: item.id }, data });
  }

  const index =
    input.currentIndex ?? item.order - attempt.currentSection * QUESTIONS_PER_SECTION;
  return prisma.attempt.update({
    where: { id: attempt.id },
    data: { currentIndex: clampIndex(index) },
    include: attemptInclude,
  });
}

export async function setCurrentIndex(attempt: FullAttempt, index: number): Promise<FullAttempt> {
  return prisma.attempt.update({
    where: { id: attempt.id },
    data: { currentIndex: clampIndex(index) },
    include: attemptInclude,
  });
}

const clampIndex = (n: number) => Math.min(QUESTIONS_PER_SECTION - 1, Math.max(0, Math.trunc(n)));

/* --------------------------------- views --------------------------------- */

/** What the candidate is allowed to see: no answer key until they submit. */
export function toAttemptState(attempt: FullAttempt): AttemptState {
  const revealed = attempt.status === "SUBMITTED";
  const paused = attempt.room?.status === "PAUSED" && attempt.room.pausedAt;
  const deadline = sectionDeadline(attempt);
  // While the room is paused the clock reads from the moment it stopped, so a
  // paused candidate's remaining time does not drain.
  const effectiveNow = paused ? new Date(attempt.room!.pausedAt!).getTime() : Date.now();
  return {
    attemptId: attempt.id,
    mode: attempt.mode,
    status: attempt.status,
    currentSection: attempt.currentSection,
    currentIndex: attempt.currentIndex,
    sectionMinutes: attempt.sectionMinutes,
    deadlineAt: deadline,
    remainingMs:
      deadline === null || attempt.status !== "IN_PROGRESS"
        ? null
        : Math.max(0, deadline - effectiveNow),
    serverNow: Date.now(),
    paused: Boolean(paused),
    tabSwitches: attempt.tabSwitches,
    questions: attempt.items.map((item) => ({
      order: item.order,
      questionId: item.questionId,
      section: item.question.section,
      text: item.question.text,
      options: item.question.options,
      selected: item.selected,
      marked: item.marked,
      ...(revealed ? { answerIndex: item.question.answerIndex } : {}),
    })),
    room: attempt.room
      ? {
          code: attempt.room.code,
          title: attempt.room.title,
          status: attempt.room.status,
          examinerName: attempt.room.examiner.name,
        }
      : null,
  };
}

export function toAttemptResult(attempt: FullAttempt): AttemptResult {
  const score = scoreAttempt(
    attempt.items.map((item) => ({
      order: item.order,
      selected: item.selected,
      answerIndex: item.question.answerIndex,
    })),
  );
  return {
    attemptId: attempt.id,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    score,
    questions: attempt.items.map((item) => ({
      order: item.order,
      questionId: item.questionId,
      section: item.question.section,
      text: item.question.text,
      options: item.question.options,
      selected: item.selected,
      marked: item.marked,
      answerIndex: item.question.answerIndex,
    })),
  };
}

/** Row in the examiner's candidate table. */
export function toCandidateLive(
  attempt: FullAttempt,
  presence: { online: boolean; cameraOn: boolean },
): CandidateLive {
  let answered = 0;
  let marked = 0;
  let correct = 0;
  let wrong = 0;
  for (const item of attempt.items) {
    if (item.marked) marked++;
    if (item.selected === null) continue;
    answered++;
    if (item.selected === item.question.answerIndex) correct++;
    else wrong++;
  }
  return {
    attemptId: attempt.id,
    userId: attempt.userId,
    name: attempt.user.name,
    email: attempt.user.email,
    photoUrl: attempt.user.photoUrl,
    status: attempt.status,
    online: presence.online,
    cameraOn: presence.cameraOn,
    currentSection: attempt.currentSection,
    currentIndex: attempt.currentIndex,
    answered,
    marked,
    correct,
    wrong,
    tabSwitches: attempt.tabSwitches,
    deadlineAt: sectionDeadline(attempt),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    totalScore: attempt.totalScore,
    joinedAt: attempt.joinedAt.toISOString(),
  };
}

/** The examiner's view of one candidate's paper, answer key included. */
export function toCandidateSheet(attempt: FullAttempt): CandidateSheet {
  return {
    attemptId: attempt.id,
    name: attempt.user.name,
    currentSection: attempt.currentSection,
    currentIndex: attempt.currentIndex,
    items: attempt.items.map((item) => ({
      order: item.order,
      questionId: item.questionId,
      section: item.question.section,
      text: item.question.text,
      options: item.question.options,
      selected: item.selected,
      answerIndex: item.question.answerIndex,
      marked: item.marked,
    })),
  };
}
