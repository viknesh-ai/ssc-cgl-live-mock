import { z } from "zod";
import { HttpError, requireExaminer, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { listExams } from "@/lib/bank";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  region: z.string().trim().max(60).nullable().optional(),
  correctMark: z.number().min(0).max(100).optional(),
  wrongMark: z.number().min(-100).max(0).optional(),
  archived: z.boolean().optional(),
  sections: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(120),
        shortName: z.string().trim().min(1).max(40),
      }),
    )
    .min(1)
    .optional(),
});

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireExaminer(req);
  const id = Number((await ctx.params).id);
  const exam = await prisma.exam.findUnique({ where: { id }, include: { sections: true } });
  if (!exam) throw new HttpError(404, "No such exam.");

  const body = schema.parse(await req.json());

  await prisma.exam.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.region !== undefined ? { region: body.region } : {}),
      ...(body.correctMark !== undefined ? { correctMark: body.correctMark } : {}),
      ...(body.wrongMark !== undefined ? { wrongMark: body.wrongMark } : {}),
      ...(body.archived !== undefined ? { archived: body.archived } : {}),
    },
  });

  if (body.sections) {
    // Sections carry questions, so existing ones are renamed in place and only
    // genuinely new ones are added. Removing a section is refused while it
    // still holds questions.
    const keep = new Set<number>();
    for (const [order, section] of body.sections.entries()) {
      if (section.id) {
        const existing = exam.sections.find((s) => s.id === section.id);
        if (!existing) throw new HttpError(400, "A section does not belong to this exam.");
        await prisma.examSection.update({
          where: { id: section.id },
          data: { order, name: section.name, shortName: section.shortName },
        });
        keep.add(section.id);
      } else {
        const created = await prisma.examSection.create({
          data: { examId: id, order, name: section.name, shortName: section.shortName },
        });
        keep.add(created.id);
      }
    }
    for (const section of exam.sections) {
      if (keep.has(section.id)) continue;
      const questions = await prisma.question.count({ where: { sectionId: section.id } });
      if (questions > 0) {
        throw new HttpError(
          409,
          `"${section.name}" still holds ${questions} question${questions === 1 ? "" : "s"}. Move or delete them before removing the section.`,
        );
      }
      await prisma.examSection.delete({ where: { id: section.id } });
    }
  }

  const exams = await listExams();
  return Response.json({ exam: exams.find((e) => e.id === id) });
});
