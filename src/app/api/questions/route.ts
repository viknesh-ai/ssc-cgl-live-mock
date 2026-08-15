import { z } from "zod";
import { requireExaminer, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { assertSectionInExam, listQuestions, questionWithRelations, toBankQuestion } from "@/lib/bank";

export const dynamic = "force-dynamic";

/** Browse the bank: filter by exam, section, topic, difficulty, status or text. */
export const GET = route(async (req) => {
  await requireExaminer(req);
  const params = new URL(req.url).searchParams;
  const num = (key: string) => {
    const value = Number(params.get(key));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  };

  const result = await listQuestions({
    examId: num("examId"),
    sectionId: num("sectionId"),
    topic: params.get("topic") || undefined,
    difficulty: (params.get("difficulty") as "EASY" | "MEDIUM" | "HARD" | null) ?? undefined,
    status: (params.get("status") as "DRAFT" | "PUBLISHED" | null) ?? undefined,
    search: params.get("search")?.trim() || undefined,
    page: num("page") ?? 1,
    perPage: Math.min(num("perPage") ?? 25, 100),
  });

  const topics = await prisma.question.findMany({
    where: { topic: { not: null } },
    distinct: ["topic"],
    select: { topic: true },
    orderBy: { topic: "asc" },
  });

  return Response.json({
    ...result,
    topics: topics.map((t) => t.topic).filter((t): t is string => Boolean(t)),
  });
});

const questionSchema = z.object({
  examId: z.number().int().positive(),
  sectionId: z.number().int().positive(),
  text: z.string().trim().min(5).max(4000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  answerIndex: z.number().int().min(0),
  topic: z.string().trim().max(80).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const POST = route(async (req) => {
  await requireExaminer(req);
  const body = questionSchema.parse(await req.json());
  if (body.answerIndex >= body.options.length) {
    return Response.json({ error: "The correct answer must be one of the options." }, { status: 400 });
  }
  await assertSectionInExam(body.examId, body.sectionId);

  const created = await prisma.question.create({
    data: {
      examId: body.examId,
      sectionId: body.sectionId,
      text: body.text,
      options: body.options,
      answerIndex: body.answerIndex,
      topic: body.topic ?? null,
      difficulty: body.difficulty ?? null,
      status: body.status ?? "PUBLISHED",
    },
  });
  const row = await questionWithRelations(created.id);
  return Response.json({ question: row ? toBankQuestion(row) : null }, { status: 201 });
});
