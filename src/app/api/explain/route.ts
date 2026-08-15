import { z } from "zod";
import { HttpError, requireUser, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { generateExplanation } from "@/lib/euri";

export const dynamic = "force-dynamic";

const schema = z.object({ questionId: z.number().int().positive() });

/**
 * AI explanation for one question, after the paper is done.
 *
 * The text depends only on the question, so the first candidate to ask pays
 * for it and everyone after reads the cached copy.
 */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { questionId } = schema.parse(await req.json());

  const cached = await prisma.explanation.findUnique({ where: { questionId } });
  if (cached) return Response.json({ questionId, content: cached.content, cached: true });

  // Explanations are only for papers you have finished — no peeking mid-exam.
  if (user.role !== "EXAMINER") {
    const allowed = await prisma.attemptQuestion.findFirst({
      where: { questionId, attempt: { userId: user.id, status: "SUBMITTED" } },
      select: { id: true },
    });
    if (!allowed) throw new HttpError(403, "You can only review questions from a paper you finished.");
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { section: true },
  });
  if (!question) throw new HttpError(404, "No such question.");

  const { content, model } = await generateExplanation({
    sectionName: question.section.name,
    text: question.text,
    options: question.options,
    answerIndex: question.answerIndex,
  });
  const saved = await prisma.explanation.upsert({
    where: { questionId },
    create: { questionId, content, model },
    update: { content, model },
  });

  return Response.json({ questionId, content: saved.content, cached: false });
});
