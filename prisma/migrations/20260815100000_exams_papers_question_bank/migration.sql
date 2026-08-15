-- Exams, papers and a managed question bank.
--
-- The paper's shape stops being hardcoded: an Exam owns its sections and
-- marking, a Paper says how many questions to draw from each, and a room runs
-- one paper. Existing data is migrated onto the SSC CGL Tier-I exam and a
-- default paper, so rooms, attempts and results already in the database keep
-- working.

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "correctMark" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "wrongMark" DOUBLE PRECISION NOT NULL DEFAULT -0.5,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamSection" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,

    CONSTRAINT "ExamSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Paper" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperSection" (
    "id" SERIAL NOT NULL,
    "paperId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 25,
    "minutes" INTEGER NOT NULL DEFAULT 15,
    "topic" TEXT,

    CONSTRAINT "PaperSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_slug_key" ON "Exam"("slug");
CREATE UNIQUE INDEX "ExamSection_examId_order_key" ON "ExamSection"("examId", "order");
CREATE INDEX "Paper_examId_idx" ON "Paper"("examId");
CREATE UNIQUE INDEX "PaperSection_paperId_sectionId_key" ON "PaperSection"("paperId", "sectionId");

-- AddForeignKey
ALTER TABLE "ExamSection" ADD CONSTRAINT "ExamSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperSection" ADD CONSTRAINT "PaperSection_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperSection" ADD CONSTRAINT "PaperSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ExamSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The exam that until now was written into the code.
INSERT INTO "Exam" ("slug", "name", "description", "correctMark", "wrongMark")
VALUES ('ssc-cgl-tier-1', 'SSC CGL Tier-I', 'Staff Selection Commission, Combined Graduate Level, Tier-I pattern.', 2, -0.5);

INSERT INTO "ExamSection" ("examId", "order", "name", "shortName")
SELECT e.id, v.ord, v.name, v.short
FROM "Exam" e,
     (VALUES (0, 'General Intelligence & Reasoning', 'Reasoning'),
             (1, 'General Awareness', 'General Awareness'),
             (2, 'Quantitative Aptitude', 'Quantitative'),
             (3, 'English Language & Comprehension', 'English')) AS v(ord, name, short)
WHERE e.slug = 'ssc-cgl-tier-1';

INSERT INTO "Paper" ("examId", "name", "description")
SELECT e.id, 'Full mock', 'Standard full-length paper: 25 questions and 15 minutes per section.'
FROM "Exam" e WHERE e.slug = 'ssc-cgl-tier-1';

INSERT INTO "PaperSection" ("paperId", "sectionId", "questionCount", "minutes")
SELECT p.id, s.id, 25, 15
FROM "Paper" p
JOIN "ExamSection" s ON s."examId" = p."examId"
WHERE p."name" = 'Full mock';

-- Question: point every row at the new exam and section, then retire the enum.
ALTER TABLE "Question"
    ADD COLUMN "examId" INTEGER,
    ADD COLUMN "sectionId" INTEGER,
    ADD COLUMN "topic" TEXT,
    ADD COLUMN "difficulty" "Difficulty",
    ADD COLUMN "status" "QuestionStatus" NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Question" q
SET "examId" = s."examId", "sectionId" = s.id
FROM "ExamSection" s
JOIN "Exam" e ON e.id = s."examId"
WHERE e.slug = 'ssc-cgl-tier-1'
  AND s."order" = CASE q."section"::text
      WHEN 'REASONING' THEN 0
      WHEN 'GENERAL_AWARENESS' THEN 1
      WHEN 'QUANTITATIVE' THEN 2
      WHEN 'ENGLISH' THEN 3
  END;

ALTER TABLE "Question"
    ALTER COLUMN "examId" SET NOT NULL,
    ALTER COLUMN "sectionId" SET NOT NULL,
    ALTER COLUMN "updatedAt" DROP DEFAULT;

DROP INDEX "Question_section_idx";
ALTER TABLE "Question" DROP COLUMN "section";

CREATE INDEX "Question_sectionId_idx" ON "Question"("sectionId");
CREATE INDEX "Question_examId_status_idx" ON "Question"("examId", "status");
CREATE INDEX "Question_topic_idx" ON "Question"("topic");

ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ExamSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TYPE "Section";

-- Rooms and attempts now name the paper they run.
ALTER TABLE "Room" ADD COLUMN "paperId" INTEGER;
UPDATE "Room" SET "paperId" = (SELECT id FROM "Paper" WHERE "name" = 'Full mock' LIMIT 1);
ALTER TABLE "Room" ALTER COLUMN "paperId" SET NOT NULL;
ALTER TABLE "Room" DROP COLUMN "sectionMinutes";
ALTER TABLE "Room" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE "Room" ADD CONSTRAINT "Room_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attempt" ADD COLUMN "paperId" INTEGER;
UPDATE "Attempt" a SET "paperId" = COALESCE(
    (SELECT r."paperId" FROM "Room" r WHERE r.id = a."roomId"),
    (SELECT id FROM "Paper" WHERE "name" = 'Full mock' LIMIT 1)
);
ALTER TABLE "Attempt" ALTER COLUMN "paperId" SET NOT NULL;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Section membership was implied by position; make it explicit.
ALTER TABLE "AttemptQuestion" ADD COLUMN "sectionIndex" INTEGER NOT NULL DEFAULT 0;
UPDATE "AttemptQuestion" SET "sectionIndex" = "order" / 25;
CREATE INDEX "AttemptQuestion_questionId_idx" ON "AttemptQuestion"("questionId");
