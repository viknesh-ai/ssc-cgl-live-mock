import { z } from "zod";
import { HttpError, requireExaminer, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { listPaperSummaries } from "@/lib/bank";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  archived: z.boolean().optional(),
  sections: z
    .array(
      z.object({
        sectionId: z.number().int().positive(),
        questionCount: z.number().int().min(1).max(200),
        minutes: z.number().int().min(1).max(300),
        topic: z.string().trim().max(80).nullable().optional(),
      }),
    )
    .min(1)
    .optional(),
});

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireExaminer(req);
  const id = Number((await ctx.params).id);
  const paper = await prisma.paper.findUnique({ where: { id } });
  if (!paper) throw new HttpError(404, "No such paper.");

  const body = schema.parse(await req.json());

  await prisma.paper.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.archived !== undefined ? { archived: body.archived } : {}),
    },
  });

  if (body.sections) {
    const sections = await prisma.examSection.findMany({ where: { examId: paper.examId } });
    const valid = new Set(sections.map((s) => s.id));
    for (const s of body.sections) {
      if (!valid.has(s.sectionId)) throw new HttpError(400, "A section does not belong to that exam.");
    }
    await prisma.paperSection.deleteMany({ where: { paperId: id } });
    await prisma.paperSection.createMany({
      data: body.sections.map((s) => ({
        paperId: id,
        sectionId: s.sectionId,
        questionCount: s.questionCount,
        minutes: s.minutes,
        topic: s.topic ?? null,
      })),
    });
  }

  const summaries = await listPaperSummaries();
  return Response.json({ paper: summaries.find((p) => p.id === id) });
});

/** A paper that has been sat is archived rather than deleted. */
export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireExaminer(req);
  const id = Number((await ctx.params).id);
  const used = await prisma.room.count({ where: { paperId: id } });

  if (used > 0) {
    await prisma.paper.update({ where: { id }, data: { archived: true } });
    return Response.json({
      deleted: false,
      message: `This paper has been used in ${used} session${used === 1 ? "" : "s"}, so it was archived instead of deleted.`,
    });
  }

  await prisma.paper.delete({ where: { id } });
  return Response.json({ deleted: true });
});
