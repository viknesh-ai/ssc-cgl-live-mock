-- Exams are grouped by where they are sat, so the public catalogue can be
-- browsed by country or region.
ALTER TABLE "Exam" ADD COLUMN "region" TEXT;
UPDATE "Exam" SET "region" = 'India' WHERE "slug" = 'ssc-cgl-tier-1';
