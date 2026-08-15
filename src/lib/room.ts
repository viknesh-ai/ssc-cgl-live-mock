/** Exam rooms: creation, the examiner's start/pause/end controls, and listing. */
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-server";
import { DEFAULT_SECTION_MINUTES, generateRoomCode } from "@/lib/exam";
import { getAttempt, submitAttempt, syncClock } from "@/lib/attempt";
import type { RoomView } from "@/lib/types";
import type { Room, User } from "@/generated/prisma/client";

export async function createRoom(examiner: User, title?: string): Promise<Room> {
  for (let tries = 0; tries < 8; tries++) {
    const code = generateRoomCode();
    const clash = await prisma.room.findUnique({ where: { code } });
    if (clash) continue;
    return prisma.room.create({
      data: {
        code,
        title: title?.trim() || "SSC CGL Tier-I Mock",
        examinerId: examiner.id,
        sectionMinutes: DEFAULT_SECTION_MINUTES,
      },
    });
  }
  throw new HttpError(500, "Could not allocate a room code. Try again.");
}

export async function requireRoom(code: string): Promise<Room> {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) throw new HttpError(404, "That room code does not exist.");
  return room;
}

export type RoomControl = "start" | "pause" | "resume" | "end";

export async function controlRoom(room: Room, action: RoomControl): Promise<Room> {
  const now = new Date();

  switch (action) {
    case "start": {
      if (room.status === "ENDED") throw new HttpError(409, "This exam has already ended.");
      if (room.status === "RUNNING") return room;
      // Everyone waiting in the room starts their first section together.
      await prisma.attempt.updateMany({
        where: { roomId: room.id, status: "WAITING" },
        data: {
          status: "IN_PROGRESS",
          currentSection: 0,
          currentIndex: 0,
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

export async function listRooms(examinerId: number): Promise<RoomView[]> {
  const rooms = await prisma.room.findMany({
    where: { examinerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { examiner: true, _count: { select: { attempts: true } } },
  });
  return rooms.map(toRoomView);
}

export function toRoomView(
  room: Room & { examiner: { name: string }; _count: { attempts: number } },
): RoomView {
  return {
    code: room.code,
    title: room.title,
    status: room.status,
    sectionMinutes: room.sectionMinutes,
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
