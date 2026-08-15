/** Exam sessions: creation, the examiner's start/pause/end controls, and listing. */
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-server";
import { generateRoomCode } from "@/lib/exam";
import { assertDrawable, getPaperSpec } from "@/lib/paper";
import { getAttempt, submitAttempt, syncClock } from "@/lib/attempt";
import type { RoomView } from "@/lib/types";
import type { Prisma, Room, User } from "@/generated/prisma/client";

const roomInclude = {
  examiner: true,
  paper: { include: { exam: true } },
  _count: { select: { attempts: true } },
} satisfies Prisma.RoomInclude;

export type FullRoom = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

export async function createRoom(
  examiner: User,
  paperId: number,
  title?: string,
): Promise<FullRoom> {
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!paper) throw new HttpError(404, "That paper does not exist.");
  // Fails early if the paper cannot actually be drawn, rather than at exam time.
  await assertDrawable(await getPaperSpec(paperId));

  for (let tries = 0; tries < 8; tries++) {
    const code = generateRoomCode();
    if (await prisma.room.findUnique({ where: { code } })) continue;
    return prisma.room.create({
      data: {
        code,
        title: title?.trim() || paper.name,
        paperId,
        examinerId: examiner.id,
      },
      include: roomInclude,
    });
  }
  throw new HttpError(500, "Could not allocate a room code. Try again.");
}

export async function requireRoom(code: string): Promise<Room> {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) throw new HttpError(404, "That room code does not exist.");
  return room;
}

export function fullRoom(id: number) {
  return prisma.room.findUniqueOrThrow({ where: { id }, include: roomInclude });
}

export type RoomControl = "start" | "pause" | "resume" | "end";

export async function controlRoom(room: Room, action: RoomControl): Promise<Room> {
  const now = new Date();

  switch (action) {
    case "start": {
      if (room.status === "ENDED") throw new HttpError(409, "This exam has already ended.");
      if (room.status === "RUNNING") return room;
      const spec = await getPaperSpec(room.paperId);
      // Everyone waiting in the room starts their first section together.
      await prisma.attempt.updateMany({
        where: { roomId: room.id, status: "WAITING" },
        data: {
          status: "IN_PROGRESS",
          currentSection: 0,
          currentIndex: 0,
          sectionMinutes: spec.sections[0].minutes,
          sectionStartedAt: now,
          pausedMs: 0,
        },
      });
      return prisma.room.update({
        where: { id: room.id },
        data: { status: "RUNNING", startedAt: room.startedAt ?? now, pausedAt: null },
      });
    }

    case "pause": {
      if (room.status !== "RUNNING") throw new HttpError(409, "The exam is not running.");
      return prisma.room.update({
        where: { id: room.id },
        data: { status: "PAUSED", pausedAt: now },
      });
    }

    case "resume": {
      if (room.status !== "PAUSED" || !room.pausedAt) {
        throw new HttpError(409, "The exam is not paused.");
      }
      // Give every candidate back exactly the time the room stood still.
      const frozenMs = Math.max(0, now.getTime() - room.pausedAt.getTime());
      await prisma.attempt.updateMany({
        where: { roomId: room.id, status: "IN_PROGRESS" },
        data: { pausedMs: { increment: frozenMs } },
      });
      return prisma.room.update({
        where: { id: room.id },
        data: { status: "RUNNING", pausedAt: null },
      });
    }

    case "end": {
      const open = await prisma.attempt.findMany({
        where: { roomId: room.id, status: { not: "SUBMITTED" } },
        select: { id: true },
      });
      for (const { id } of open) {
        const attempt = await getAttempt(id);
        if (attempt) await submitAttempt(attempt, now);
      }
      return prisma.room.update({
        where: { id: room.id },
        data: { status: "ENDED", endedAt: now, pausedAt: null },
      });
    }
  }
}

/**
 * Sessions are shared: examiners use one login, so the list is not scoped to
 * whoever happens to be signed in.
 */
export async function listRooms(): Promise<RoomView[]> {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: roomInclude,
  });
  return rooms.map(toRoomView);
}

export function toRoomView(room: FullRoom): RoomView {
  return {
    code: room.code,
    title: room.title,
    status: room.status,
    paperId: room.paperId,
    paperName: room.paper.name,
    examName: room.paper.exam.name,
    startedAt: room.startedAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
    examinerName: room.examiner.name,
    candidateCount: room._count.attempts,
  };
}

/** Every attempt in a room, with each candidate's clock brought up to date. */
export async function roomAttempts(roomId: number) {
  const rows = await prisma.attempt.findMany({
    where: { roomId },
    orderBy: { joinedAt: "asc" },
    select: { id: true },
  });
  const out = [];
  for (const { id } of rows) {
    const attempt = await getAttempt(id);
    if (attempt) out.push(await syncClock(attempt));
  }
  return out;
}
