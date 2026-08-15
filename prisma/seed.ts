/**
 * Seeds the starting exam, its default paper, and the question bank.
 *
 * Safe to run on every deploy: everything is matched on a natural key (exam
 * slug, section order, paper name, question text) and updated rather than
 * duplicated. Once the bank is being edited in the console, this only tops up
 * questions that are missing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "../src/lib/load-env";
import { prisma } from "../src/lib/prisma";

const EXAM = {
  slug: "ssc-cgl-tier-1",
  name: "SSC CGL Tier-I",
  description: "Staff Selection Commission, Combined Graduate Level, Tier-I pattern.",
  correctMark: 2,
  wrongMark: -0.5,
  sections: [
    { key: "REASONING", name: "General Intelligence & Reasoning", shortName: "Reasoning" },
    { key: "GENERAL_AWARENESS", name: "General Awareness", shortName: "General Awareness" },
    { key: "QUANTITATIVE", name: "Quantitative Aptitude", shortName: "Quantitative" },
    { key: "ENGLISH", name: "English Language & Comprehension", shortName: "English" },
  ],
};

const PAPER = {
  name: "Full mock",
  description: "Standard full-length paper: 25 questions and 15 minutes per section.",
  questionCount: 25,
  minutes: 15,
};

type SeedQuestion = {
  section: string;
  text: string;
  options: string[];
  answerIndex: number;
};

async function main() {
  loadLocalEnv();

  const exam = await prisma.exam.upsert({
    where: { slug: EXAM.slug },
    create: {
      slug: EXAM.slug,
      name: EXAM.name,
      description: EXAM.description,
      correctMark: EXAM.correctMark,
      wrongMark: EXAM.wrongMark,
    },
    update: { name: EXAM.name, description: EXAM.description },
  });

  const sectionByKey = new Map<string, number>();
  for (const [order, section] of EXAM.sections.entries()) {
    const row = await prisma.examSection.upsert({
      where: { examId_order: { examId: exam.id, order } },
      create: { examId: exam.id, order, name: section.name, shortName: section.shortName },
      update: { name: section.name, shortName: section.shortName },
    });
    sectionByKey.set(section.key, row.id);
  }

  let paper = await prisma.paper.findFirst({ where: { examId: exam.id, name: PAPER.name } });
  if (!paper) {
    paper = await prisma.paper.create({
      data: { examId: exam.id, name: PAPER.name, description: PAPER.description },
    });
  }
  for (const sectionId of sectionByKey.values()) {
    await prisma.paperSection.upsert({
      where: { paperId_sectionId: { paperId: paper.id, sectionId } },
      create: {
        paperId: paper.id,
        sectionId,
        questionCount: PAPER.questionCount,
        minutes: PAPER.minutes,
      },
      update: {},
    });
  }

  const file = join(process.cwd(), "prisma", "questions.json");
  const questions: SeedQuestion[] = JSON.parse(readFileSync(file, "utf8"));

  let created = 0;
  let updated = 0;
  for (const q of questions) {
    const sectionId = sectionByKey.get(q.section);
    if (!sectionId) throw new Error(`Unknown section "${q.section}" in questions.json`);

    const existing = await prisma.question.findFirst({ where: { text: q.text } });
    if (existing) {
      await prisma.question.update({
        where: { id: existing.id },
        data: { examId: exam.id, sectionId, options: q.options, answerIndex: q.answerIndex },
      });
      updated++;
    } else {
      await prisma.question.create({
        data: {
          examId: exam.id,
          sectionId,
          text: q.text,
          options: q.options,
          answerIndex: q.answerIndex,
        },
      });
      created++;
    }
  }

  console.log(`Seed complete — ${created} questions created, ${updated} updated.`);
  for (const [order, section] of EXAM.sections.entries()) {
    const count = await prisma.question.count({
      where: { sectionId: sectionByKey.get(section.key), status: "PUBLISHED" },
    });
    console.log(`  ${String(order + 1)}. ${section.shortName.padEnd(18)} ${count}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
