import { z } from "zod";
import { HttpError, requireExaminer, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { assertSectionInExam, questionWithRelations, toBankQuestion } from "@/lib/bank";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  sectionId: z.number().int().positive().optional(),
  text: z.string().trim().min(5).max(4000).optional(),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6).optional(),
  answerIndex: z.number().int().min(0).optional(),
  topic: z.string().trim().max(80).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireExaminer(req);
  const id = Number((await ctx.params).id);
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "No such question.");

  const body = patchSchema.parse(await req.json());
  const options = body.options ?? existing.options;
  const answerIndex = body.answerIndex ?? existing.answerIndex;
  if (answerIndex >= options.length) {
    throw new HttpError(400, "The correct answer must be one of the options.");
  }
  if (body.sectionId) await assertSectionInExam(existing.examId, body.sectionId);

  await prisma.question.update({
    where: { id },
    data: {
      ...(body.sectionId ? { sectionId: body.sectionId } : {}),
      ...(body.text ? { text: body.text } : {}),
      options,
      answerIndex,
      ...(body.topic !== undefined ? { topic: body.topic } : {}),
      ...(body.difficulty !== undefined ? { difficulty: body.difficulty } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
  });

  // The wording may have changed, so a cached explanation no longer applies.
  if (body.text && body.text !== existing.text) {
    await prisma.explanation.deleteMany({ where: { questionId: id } });
  }

  const row = await questionWithRelations(id);
  return Response.json({ question: row ? toBankQuestion(row) : null });
});

/**
 * Questions that have already been served are retired rather than deleted, so
 * past results keep their questions.
 */
export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireExaminer(req);
  const id = Number((await ctx.params).id);
  const used = await prisma.attemptQuestion.count({ where: { questionId: id } });

  if (used > 0) {
    await prisma.question.update({ where: { id }, data: { status: "DRAFT" } });
    return Response.json({
      deleted: false,
      message: `This question has been used in ${used} paper${used === 1 ? "" : "s"}, so it was moved to drafts instead of deleted.`,
    });
  }

  await prisma.question.delete({ where: { id } });
  return Response.json({ deleted: true });
});
