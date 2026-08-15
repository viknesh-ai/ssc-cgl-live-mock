/**
 * The exam engine.
 *
 * The server owns the clock and the answer key. A candidate's browser can only
 * report what was picked; when a section ends, who is in which section, and
 * whether an answer was right are all decided here. The paper's shape comes
 * from its PaperSpec, so nothing below assumes four sections of twenty-five.
 */
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-server";
import { scoreAttempt, sectionDeadline, type PaperSpec, type SectionSpec } from "@/lib/exam";
import { getPaperSpec } from "@/lib/paper";
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

export const specOf = (attempt: FullAttempt) => getPaperSpec(attempt.paperId);

/**
 * Picks a fresh paper: the questions each section asks for, preferring ones
 * this candidate has not seen before and falling back to the whole pool once
 * the bank has been exhausted.
 */
async function drawQuestions(userId: number, spec: PaperSpec) {
  const seen = await prisma.seenQuestion.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const seenIds = new Set(seen.map((s) => s.questionId));
  const drawn: { questionId: number; order: number; sectionIndex: number }[] = [];

  for (const section of spec.sections) {
    const pool = await prisma.question.findMany({
      where: {
        sectionId: section.sectionId,
        status: "PUBLISHED",
        ...(section.topic ? { topic: section.topic } : {}),
      },
      select: { id: true },
    });
    if (pool.length < section.questionCount) {
      throw new HttpError(
        503,
        `"${section.name}" needs ${section.questionCount} published questions but the bank has ${pool.length}.`,
      );
    }
    let fresh = pool.filter((q) => !seenIds.has(q.id));
    if (fresh.length < section.questionCount) fresh = pool;
    shuffle(fresh)
      .slice(0, section.questionCount)
      .forEach((q, i) =>
        drawn.push({ questionId: q.id, order: section.offset + i, sectionIndex: section.index }),
      );
  }

  return drawn;
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

  const spec = await getPaperSpec(room.paperId);
  const running = room.status === "RUNNING" || room.status === "PAUSED";
  const created = await prisma.attempt.create({
    data: {
      userId,
      roomId: room.id,
      paperId: room.paperId,
      mode: "LIVE",
      sectionMinutes: spec.sections[0].minutes,
      status: running ? "IN_PROGRESS" : "WAITING",
      sectionStartedAt: running ? new Date() : null,
      items: { create: await drawQuestions(userId, spec) },
    },
    include: attemptInclude,
  });
  await recordSeen(userId, created.items.map((i) => i.questionId));
  return created;
}

/** Solo practice: no room, no examiner, clock starts immediately. */
export async function startSoloAttempt(userId: number, paperId: number): Promise<FullAttempt> {
  const open = await prisma.attempt.findFirst({
    where: { userId, roomId: null, status: { not: "SUBMITTED" } },
    include: attemptInclude,
    orderBy: { id: "desc" },
  });
  if (open) return syncClock(open);

  const spec = await getPaperSpec(paperId);
  const created = await prisma.attempt.create({
    data: {
      userId,
      paperId,
      mode: "SOLO",
      status: "IN_PROGRESS",
      sectionMinutes: spec.sections[0].minutes,
      sectionStartedAt: new Date(),
      items: { create: await drawQuestions(userId, spec) },
    },
    include: attemptInclude,
  });
  await recordSeen(userId, created.items.map((i) => i.questionId));
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
  const spec = await specOf(attempt);

  // While the examiner has the room paused, time simply stops advancing.
  const paused = attempt.room?.status === "PAUSED" && attempt.room.pausedAt;
  const now = paused ? new Date(attempt.room!.pausedAt!).getTime() : Date.now();

  let current = attempt;
  for (;;) {
    const deadline = sectionDeadline(current);
    if (deadline === null || now < deadline) break;

    const next = spec.sections[current.currentSection + 1];
    if (!next) return submitAttempt(current, new Date(deadline));

    current = await prisma.attempt.update({
      where: { id: current.id },
      data: {
        currentSection: next.index,
        currentIndex: 0,
        sectionMinutes: next.minutes,
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
  const spec = await specOf(attempt);
  const next = spec.sections[attempt.currentSection + 1];
  if (!next) return submitAttempt(attempt);

  return prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      currentSection: next.index,
      currentIndex: 0,
      sectionMinutes: next.minutes,
      sectionStartedAt: new Date(),
      pausedMs: 0,
    },
    include: attemptInclude,
  });
}

export async function submitAttempt(attempt: FullAttempt, at = new Date()): Promise<FullAttempt> {
  if (attempt.status === "SUBMITTED") return attempt;
  const spec = await specOf(attempt);
  const sheet = scoreAttempt(
    attempt.items.map((item) => ({
      sectionIndex: item.sectionIndex,
      selected: item.selected,
      answerIndex: item.question.answerIndex,
    })),
    spec,
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
  const spec = await specOf(attempt);
  const section = spec.sections[attempt.currentSection];

  const item = attempt.items.find((i) => i.order === input.order);
  if (!item) throw new HttpError(404, "No such question on this paper.");
  if (item.sectionIndex !== attempt.currentSection) throw new HttpError(409, "That section is locked.");
  if (input.selected !== undefined && input.selected !== null) {
    const options = item.question.options.length;
    if (!Number.isInteger(input.selected) || input.selected < 0 || input.selected >= options) {
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

  const index = input.currentIndex ?? item.order - section.offset;
  return prisma.attempt.update({
    where: { id: attempt.id },
    data: { currentIndex: clampIndex(index, section) },
    include: attemptInclude,
  });
}

const clampIndex = (n: number, section: SectionSpec) =>
  Math.min(section.questionCount - 1, Math.max(0, Math.trunc(n)));

/* --------------------------------- views --------------------------------- */

/** What the candidate is allowed to see: no answer key until they submit. */
export function toAttemptState(attempt: FullAttempt, spec: PaperSpec): AttemptState {
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
    paper: {
      name: spec.paperName,
      examName: spec.examName,
      correctMark: spec.correctMark,
      wrongMark: spec.wrongMark,
      maxScore: spec.maxScore,
      totalQuestions: spec.totalQuestions,
      sections: spec.sections.map((s) => ({
        index: s.index,
        name: s.name,
        shortName: s.shortName,
        questionCount: s.questionCount,
        minutes: s.minutes,
        offset: s.offset,
      })),
    },
    questions: attempt.items.map((item) => ({
      order: item.order,
      sectionIndex: item.sectionIndex,
      questionId: item.questionId,
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

export function toAttemptResult(attempt: FullAttempt, spec: PaperSpec): AttemptResult {
  const score = scoreAttempt(
    attempt.items.map((item) => ({
      sectionIndex: item.sectionIndex,
      selected: item.selected,
      answerIndex: item.question.answerIndex,
    })),
    spec,
  );
  return {
    attemptId: attempt.id,
    paperName: spec.paperName,
    examName: spec.examName,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    score,
    questions: attempt.items.map((item) => ({
      order: item.order,
      sectionIndex: item.sectionIndex,
      questionId: item.questionId,
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
  spec: PaperSpec,
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
  const section = spec.sections[attempt.currentSection];
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
    currentSectionName: section?.shortName ?? "—",
    sectionQuestionCount: section?.questionCount ?? 0,
    currentIndex: attempt.currentIndex,
    answered,
    marked,
    correct,
    wrong,
    tabSwitches: attempt.tabSwitches,
    deadlineAt: sectionDeadline(attempt),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    totalScore: attempt.totalScore,
    maxScore: spec.maxScore,
    joinedAt: attempt.joinedAt.toISOString(),
  };
}

/** The examiner's view of one candidate's paper, answer key included. */
export function toCandidateSheet(attempt: FullAttempt, spec: PaperSpec): CandidateSheet {
  return {
    attemptId: attempt.id,
    name: attempt.user.name,
    currentSection: attempt.currentSection,
    currentIndex: attempt.currentIndex,
    sections: spec.sections.map((s) => ({
      index: s.index,
      shortName: s.shortName,
      questionCount: s.questionCount,
      offset: s.offset,
    })),
    items: attempt.items.map((item) => ({
      order: item.order,
      sectionIndex: item.sectionIndex,
      questionId: item.questionId,
      text: item.question.text,
      options: item.question.options,
      selected: item.selected,
      answerIndex: item.question.answerIndex,
      marked: item.marked,
    })),
  };
}
