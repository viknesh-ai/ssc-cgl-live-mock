import { z } from "zod";
import { HttpError, requireExaminer, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { listExams } from "@/lib/bank";

export const dynamic = "force-dynamic";

/** Exams and their sections, with how many published questions each holds. */
export const GET = route(async (req) => {
  await requireExaminer(req);
  return Response.json({ exams: await listExams() });
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable().optional(),
  region: z.string().trim().max(60).nullable().optional(),
  correctMark: z.number().min(0).max(100).default(1),
  wrongMark: z.number().min(-100).max(0).default(0),
  sections: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        shortName: z.string().trim().min(1).max(40),
      }),
    )
    .min(1)
    .max(20),
});

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "exam";

/** Creates an exam with whatever sections and marking it needs. */
export const POST = route(async (req) => {
  await requireExaminer(req);
  const body = schema.parse(await req.json());

  let slug = slugify(body.name);
  for (let n = 2; await prisma.exam.findUnique({ where: { slug } }); n++) {
    slug = `${slugify(body.name)}-${n}`;
    if (n > 50) throw new HttpError(409, "Could not allocate a slug for that name.");
  }

  const exam = await prisma.exam.create({
    data: {
      slug,
      name: body.name,
      description: body.description ?? null,
      region: body.region ?? null,
      correctMark: body.correctMark,
      wrongMark: body.wrongMark,
      sections: {
        create: body.sections.map((section, order) => ({
          order,
          name: section.name,
          shortName: section.shortName,
        })),
      },
    },
  });

  const exams = await listExams();
  return Response.json({ exam: exams.find((e) => e.id === exam.id) }, { status: 201 });
});
