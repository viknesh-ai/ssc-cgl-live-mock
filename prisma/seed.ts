/**
 * Loads the question bank from prisma/questions.json into Postgres.
 *
 * Safe to run on every deploy: a question already in the database (matched on
 * its exact text) is updated rather than duplicated, so redeploys do not grow
 * the bank. Run with `npm run db:seed`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "../src/lib/load-env";
import { prisma } from "../src/lib/prisma";
import type { Section } from "../src/generated/prisma/enums";

type SeedQuestion = {
  section: Section;
  text: string;
  options: string[];
  answerIndex: number;
};

async function main() {
  loadLocalEnv();
  const file = join(process.cwd(), "prisma", "questions.json");
  const questions: SeedQuestion[] = JSON.parse(readFileSync(file, "utf8"));

  let created = 0;
  let updated = 0;

  for (const q of questions) {
    const existing = await prisma.question.findFirst({ where: { text: q.text } });
    if (existing) {
      await prisma.question.update({
        where: { id: existing.id },
        data: { section: q.section, options: q.options, answerIndex: q.answerIndex },
      });
      updated++;
    } else {
      await prisma.question.create({ data: q });
      created++;
    }
  }

  const bySection = await prisma.question.groupBy({
    by: ["section"],
    _count: { _all: true },
  });

  console.log(`Seed complete — ${created} created, ${updated} updated.`);
  for (const row of bySection) {
    console.log(`  ${row.section.padEnd(18)} ${row._count._all}`);
  }

  const adminEmail = process.env.EXAMINER_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    const promoted = await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { role: "EXAMINER" },
    });
    if (promoted.count) console.log(`Promoted ${adminEmail} to EXAMINER.`);
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
