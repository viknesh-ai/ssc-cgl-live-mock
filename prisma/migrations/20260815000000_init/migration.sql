-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Section" AS ENUM ('REASONING', 'GENERAL_AWARENESS', 'QUANTITATIVE', 'ENGLISH');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CANDIDATE', 'EXAMINER');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'RUNNING', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('LIVE', 'SOLO');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "section" "Section" NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "answerIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Explanation" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Explanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeenQuestion" (
    "userId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeenQuestion_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'SSC CGL Tier-I Mock',
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "sectionMinutes" INTEGER NOT NULL DEFAULT 15,
    "examinerId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roomId" INTEGER,
    "mode" "AttemptMode" NOT NULL DEFAULT 'LIVE',
    "status" "AttemptStatus" NOT NULL DEFAULT 'WAITING',
    "sectionMinutes" INTEGER NOT NULL DEFAULT 15,
    "currentSection" INTEGER NOT NULL DEFAULT 0,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "sectionStartedAt" TIMESTAMP(3),
    "pausedMs" INTEGER NOT NULL DEFAULT 0,
    "tabSwitches" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "totalScore" DOUBLE PRECISION,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptQuestion" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "selected" INTEGER,
    "marked" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "AttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "fromExaminer" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Question_section_idx" ON "Question"("section");

-- CreateIndex
CREATE UNIQUE INDEX "Explanation_questionId_key" ON "Explanation"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_roomId_userId_key" ON "Attempt"("roomId", "userId");

-- CreateIndex
CREATE INDEX "AttemptQuestion_attemptId_idx" ON "AttemptQuestion"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptQuestion_attemptId_order_key" ON "AttemptQuestion"("attemptId", "order");

-- CreateIndex
CREATE INDEX "ChatMessage_attemptId_createdAt_idx" ON "ChatMessage"("attemptId", "createdAt");

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeenQuestion" ADD CONSTRAINT "SeenQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeenQuestion" ADD CONSTRAINT "SeenQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_examinerId_fkey" FOREIGN KEY ("examinerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
