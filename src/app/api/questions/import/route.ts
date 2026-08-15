import { z } from "zod";
import { requireExaminer, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { assertSectionInExam } from "@/lib/bank";

export const dynamic = "force-dynamic";

const schema = z.object({
  examId: z.number().int().positive(),
  /** Fallback section for rows that do not name one. */
  sectionId: z.number().int().positive().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  questions: z
    .array(
      z.object({
        sectionId: z.number().int().positive().optional(),
        section: z.string().trim().optional(),
        text: z.string().trim().min(5).max(4000),
        options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
        answerIndex: z.number().int().min(0),
        topic: z.string().trim().max(80).nullable().optional(),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable().optional(),
        /** Worked solution supplied with the question, used instead of asking the AI. */
        explanation: z.string().trim().max(4000).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Bulk import. Rows may name their section by id or by name/short name;
 * anything already in the bank (matched on exact text) is skipped rather than
 * duplicated, and every row is reported back so nothing fails silently.
 */
export const POST = route(async (req) => {
  await requireExaminer(req);
  const body = schema.parse(await req.json());

  const sections = await prisma.examSection.findMany({ where: { examId: body.examId } });
  const byName = new Map<string, number>();
  for (const s of sections) {
    byName.set(s.name.toLowerCase(), s.id);
    byName.set(s.shortName.toLowerCase(), s.id);
  }
  if (body.sectionId) await assertSectionInExam(body.examId, body.sectionId);

  let created = 0;
  const skipped: string[] = [];
  const failed: { row: number; reason: string }[] = [];

  for (const [index, q] of body.questions.entries()) {
    const sectionId =
      q.sectionId ?? (q.section ? byName.get(q.section.toLowerCase()) : undefined) ?? body.sectionId;
    if (!sectionId) {
      failed.push({ row: index + 1, reason: `Unknown section${q.section ? ` "${q.section}"` : ""}` });
      continue;
    }
    if (!sections.some((s) => s.id === sectionId)) {
      failed.push({ row: index + 1, reason: "Section belongs to another exam" });
      continue;
    }
    if (q.answerIndex >= q.options.length) {
      failed.push({ row: index + 1, reason: "answerIndex is outside the options" });
      continue;
    }
    if (await prisma.question.findFirst({ where: { text: q.text }, select: { id: true } })) {
      skipped.push(q.text.slice(0, 60));
      continue;
    }

    const question = await prisma.question.create({
      data: {
        examId: body.examId,
        sectionId,
        text: q.text,
        options: q.options,
        answerIndex: q.answerIndex,
        topic: q.topic ?? null,
        difficulty: q.difficulty ?? null,
        status: body.status,
      },
    });
    // An explanation that came with the question saves an AI call later.
    if (q.explanation) {
      await prisma.explanation.create({
        data: { questionId: question.id, content: q.explanation, model: "imported" },
      });
    }
    created++;
  }

  return Response.json({ created, skipped: skipped.length, duplicates: skipped, failed });
});
