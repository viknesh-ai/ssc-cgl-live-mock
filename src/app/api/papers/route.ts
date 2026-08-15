import { z } from "zod";
import { HttpError, requireExaminer, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { listPaperSummaries } from "@/lib/bank";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireExaminer(req);
  return Response.json({ papers: await listPaperSummaries() });
});

const schema = z.object({
  examId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable().optional(),
  sections: z
    .array(
      z.object({
        sectionId: z.number().int().positive(),
        questionCount: z.number().int().min(1).max(200),
        minutes: z.number().int().min(1).max(300),
        topic: z.string().trim().max(80).nullable().optional(),
      }),
    )
    .min(1),
});

/** Creates a blueprint: which sections to draw from, how many and for how long. */
export const POST = route(async (req) => {
  await requireExaminer(req);
  const body = schema.parse(await req.json());

  const sections = await prisma.examSection.findMany({ where: { examId: body.examId } });
  const valid = new Set(sections.map((s) => s.id));
  for (const s of body.sections) {
    if (!valid.has(s.sectionId)) throw new HttpError(400, "A section does not belong to that exam.");
  }

  const paper = await prisma.paper.create({
    data: {
      examId: body.examId,
      name: body.name,
      description: body.description ?? null,
      sections: {
        create: body.sections.map((s) => ({
          sectionId: s.sectionId,
          questionCount: s.questionCount,
          minutes: s.minutes,
          topic: s.topic ?? null,
        })),
      },
    },
  });

  const summaries = await listPaperSummaries();
  return Response.json({ paper: summaries.find((p) => p.id === paper.id) }, { status: 201 });
});
