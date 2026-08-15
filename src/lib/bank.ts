/**
 * The question bank: reading it for the console, and the statistics that tell
 * an examiner which questions are pulling their weight.
 */
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-server";
import type { BankQuestion, ExamView, PaperSummary } from "@/lib/types";
import type { Difficulty, Prisma, QuestionStatus } from "@/generated/prisma/client";

const questionInclude = {
  exam: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, shortName: true } },
  explanation: { select: { id: true } },
} satisfies Prisma.QuestionInclude;

type QuestionRow = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;

export type BankFilter = {
  examId?: number;
  sectionId?: number;
  topic?: string;
  difficulty?: Difficulty;
  status?: QuestionStatus;
  search?: string;
  page: number;
  perPage: number;
};

export async function listQuestions(filter: BankFilter) {
  const where: Prisma.QuestionWhereInput = {
    ...(filter.examId ? { examId: filter.examId } : {}),
    ...(filter.sectionId ? { sectionId: filter.sectionId } : {}),
    ...(filter.topic ? { topic: filter.topic } : {}),
    ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search
      ? { text: { contains: filter.search, mode: "insensitive" as const } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: questionInclude,
      orderBy: { id: "asc" },
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
    }),
    prisma.question.count({ where }),
  ]);

  const stats = await questionStats(rows.map((r) => r.id));
  return {
    questions: rows.map((row) => toBankQuestion(row, stats.get(row.id))),
    total,
    page: filter.page,
    perPage: filter.perPage,
  };
}

type Stats = { served: number; correct: number; wrong: number; skipped: number };

/** How each question has actually performed, straight from real attempts. */
async function questionStats(ids: number[]): Promise<Map<number, Stats>> {
  const out = new Map<number, Stats>();
  if (!ids.length) return out;

  const rows = await prisma.attemptQuestion.findMany({
    where: { questionId: { in: ids } },
    select: { questionId: true, selected: true, question: { select: { answerIndex: true } } },
  });

  for (const row of rows) {
    const stat = out.get(row.questionId) ?? { served: 0, correct: 0, wrong: 0, skipped: 0 };
    stat.served++;
    if (row.selected === null) stat.skipped++;
    else if (row.selected === row.question.answerIndex) stat.correct++;
    else stat.wrong++;
    out.set(row.questionId, stat);
  }
  return out;
}

export function toBankQuestion(row: QuestionRow, stats?: Stats): BankQuestion {
  const served = stats?.served ?? 0;
  const correct = stats?.correct ?? 0;
  const wrong = stats?.wrong ?? 0;
  const attempted = correct + wrong;
  return {
    id: row.id,
    examId: row.examId,
    examName: row.exam.name,
    sectionId: row.sectionId,
    sectionName: row.section.name,
    sectionShortName: row.section.shortName,
    text: row.text,
    options: row.options,
    answerIndex: row.answerIndex,
    topic: row.topic,
    difficulty: row.difficulty,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    stats: {
      served,
      correct,
      wrong,
      skipped: stats?.skipped ?? 0,
      accuracy: attempted ? Math.round((correct / attempted) * 1000) / 10 : null,
    },
    hasExplanation: Boolean(row.explanation),
  };
}

export function questionWithRelations(id: number) {
  return prisma.question.findUnique({ where: { id }, include: questionInclude });
}

/** Checks that a section belongs to the exam it is being filed under. */
export async function assertSectionInExam(examId: number, sectionId: number) {
  const section = await prisma.examSection.findUnique({ where: { id: sectionId } });
  if (!section || section.examId !== examId) {
    throw new HttpError(400, "That section belongs to a different exam.");
  }
}

export async function listExams(): Promise<ExamView[]> {
  const exams = await prisma.exam.findMany({
    where: { archived: false },
    orderBy: { id: "asc" },
    include: {
      sections: { orderBy: { order: "asc" } },
      _count: { select: { papers: true, questions: true } },
    },
  });

  const counts = await prisma.question.groupBy({
    by: ["sectionId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const bySection = new Map(counts.map((c) => [c.sectionId, c._count._all]));

  return exams.map((exam) => ({
    id: exam.id,
    slug: exam.slug,
    name: exam.name,
    description: exam.description,
    correctMark: exam.correctMark,
    wrongMark: exam.wrongMark,
    sections: exam.sections.map((s) => ({
      id: s.id,
      order: s.order,
      name: s.name,
      shortName: s.shortName,
      questionCount: bySection.get(s.id) ?? 0,
    })),
    paperCount: exam._count.papers,
    questionCount: exam._count.questions,
  }));
}

export async function listPaperSummaries(): Promise<PaperSummary[]> {
  const papers = await prisma.paper.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      exam: true,
      sections: { include: { section: true }, orderBy: { section: { order: "asc" } } },
      _count: { select: { rooms: true } },
    },
  });

  const counts = await prisma.question.groupBy({
    by: ["sectionId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const bySection = new Map(counts.map((c) => [c.sectionId, c._count._all]));

  return papers.map((paper) => {
    const sections = paper.sections.map((ps) => ({
      sectionId: ps.sectionId,
      name: ps.section.name,
      shortName: ps.section.shortName,
      questionCount: ps.questionCount,
      minutes: ps.minutes,
      topic: ps.topic,
      available: bySection.get(ps.sectionId) ?? 0,
    }));
    const totalQuestions = sections.reduce((n, s) => n + s.questionCount, 0);
    return {
      id: paper.id,
      name: paper.name,
      description: paper.description,
      examId: paper.examId,
      examName: paper.exam.name,
      archived: paper.archived,
      createdAt: paper.createdAt.toISOString(),
      totalQuestions,
      totalMinutes: sections.reduce((n, s) => n + s.minutes, 0),
      maxScore: Math.round(totalQuestions * paper.exam.correctMark * 100) / 100,
      sections,
      sessionCount: paper._count.rooms,
    };
  });
}
