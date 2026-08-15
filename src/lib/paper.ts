/** Loading papers and turning them into the spec the exam engine runs on. */
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-server";
import type { PaperSpec } from "@/lib/exam";
import type { Prisma } from "@/generated/prisma/client";

const paperInclude = {
  exam: true,
  sections: { include: { section: true }, orderBy: { section: { order: "asc" } } },
} satisfies Prisma.PaperInclude;

export type FullPaper = Prisma.PaperGetPayload<{ include: typeof paperInclude }>;

export function toPaperSpec(paper: FullPaper): PaperSpec {
  let offset = 0;
  const sections = paper.sections.map((ps, index) => {
    const spec = {
      index,
      sectionId: ps.sectionId,
      name: ps.section.name,
      shortName: ps.section.shortName,
      questionCount: ps.questionCount,
      minutes: ps.minutes,
      topic: ps.topic,
      offset,
    };
    offset += ps.questionCount;
    return spec;
  });

  const totalQuestions = sections.reduce((n, s) => n + s.questionCount, 0);
  return {
    paperId: paper.id,
    paperName: paper.name,
    examId: paper.examId,
    examName: paper.exam.name,
    correctMark: paper.exam.correctMark,
    wrongMark: paper.exam.wrongMark,
    sections,
    totalQuestions,
    maxScore: Math.round(totalQuestions * paper.exam.correctMark * 100) / 100,
    totalMinutes: sections.reduce((n, s) => n + s.minutes, 0),
  };
}

/**
 * Checks the bank can actually supply the paper. Called before a session is
 * created so a shortage surfaces then, not when candidates are waiting.
 */
export async function assertDrawable(spec: PaperSpec) {
  for (const section of spec.sections) {
    const available = await prisma.question.count({
      where: {
        sectionId: section.sectionId,
        status: "PUBLISHED",
        ...(section.topic ? { topic: section.topic } : {}),
      },
    });
    if (available < section.questionCount) {
      throw new HttpError(
        409,
        `"${section.name}" needs ${section.questionCount} published questions${section.topic ? ` on "${section.topic}"` : ""}, but the bank has ${available}.`,
      );
    }
  }
}

export async function getPaperSpec(paperId: number): Promise<PaperSpec> {
  const paper = await prisma.paper.findUnique({ where: { id: paperId }, include: paperInclude });
  if (!paper) throw new HttpError(404, "That paper no longer exists.");
  if (!paper.sections.length) throw new HttpError(409, `"${paper.name}" has no sections yet.`);
  return toPaperSpec(paper);
}

/** The paper used when nobody picked one — the oldest live paper. */
export async function defaultPaper(): Promise<FullPaper> {
  const paper = await prisma.paper.findFirst({
    where: { archived: false },
    orderBy: { id: "asc" },
    include: paperInclude,
  });
  if (!paper) {
    throw new HttpError(503, "No papers have been set up yet. Create one in the examiner console.");
  }
  return paper;
}

export function listPapersQuery() {
  return { include: paperInclude, orderBy: { createdAt: "desc" } } as const;
}
