import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The public prospectus: which exams are on offer and what papers exist for
 * each. Open to anyone — it advertises the product and contains no exam
 * content, only its shape.
 */
export async function GET() {
  const exams = await prisma.exam.findMany({
    where: { archived: false },
    orderBy: { id: "asc" },
    include: {
      sections: { orderBy: { order: "asc" } },
      papers: {
        where: { archived: false },
        orderBy: { createdAt: "asc" },
        include: { sections: { include: { section: true }, orderBy: { section: { order: "asc" } } } },
      },
    },
  });

  const published = await prisma.question.groupBy({
    by: ["examId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const bank = new Map(published.map((row) => [row.examId, row._count._all]));

  return Response.json({
    exams: exams.map((exam) => ({
      id: exam.id,
      slug: exam.slug,
      name: exam.name,
      description: exam.description,
      region: exam.region,
      correctMark: exam.correctMark,
      wrongMark: exam.wrongMark,
      questionCount: bank.get(exam.id) ?? 0,
      sections: exam.sections.map((s) => ({ name: s.name, shortName: s.shortName })),
      papers: exam.papers.map((paper) => {
        const questions = paper.sections.reduce((n, s) => n + s.questionCount, 0);
        return {
          id: paper.id,
          name: paper.name,
          description: paper.description,
          questions,
          minutes: paper.sections.reduce((n, s) => n + s.minutes, 0),
          maxScore: Math.round(questions * exam.correctMark * 100) / 100,
          sections: paper.sections.map((s) => ({
            name: s.section.name,
            shortName: s.section.shortName,
            questionCount: s.questionCount,
            minutes: s.minutes,
          })),
          /** Whether the bank can actually supply this paper right now. */
          ready: paper.sections.every((s) => s.questionCount > 0),
        };
      }),
    })),
  });
}
