import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The papers on offer, for the signed-out landing page and the candidate's
 * home. Public: it is a prospectus, not exam content.
 */
export async function GET() {
  const papers = await prisma.paper.findMany({
    where: { archived: false, exam: { archived: false } },
    orderBy: { createdAt: "asc" },
    include: {
      exam: true,
      sections: { include: { section: true }, orderBy: { section: { order: "asc" } } },
    },
  });

  return Response.json({
    papers: papers.map((paper) => {
      const questions = paper.sections.reduce((n, s) => n + s.questionCount, 0);
      return {
        id: paper.id,
        name: paper.name,
        description: paper.description,
        examName: paper.exam.name,
        examDescription: paper.exam.description,
        correctMark: paper.exam.correctMark,
        wrongMark: paper.exam.wrongMark,
        questions,
        minutes: paper.sections.reduce((n, s) => n + s.minutes, 0),
        maxScore: Math.round(questions * paper.exam.correctMark * 100) / 100,
        sections: paper.sections.map((s) => ({
          name: s.section.name,
          shortName: s.section.shortName,
          questionCount: s.questionCount,
          minutes: s.minutes,
        })),
      };
    }),
  });
}
