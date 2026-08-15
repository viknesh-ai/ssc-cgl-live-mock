import { z } from "zod";
import { requireExaminer, route } from "@/lib/auth-server";
import { createRoom, listRooms } from "@/lib/room";
import { prisma } from "@/lib/prisma";
import { toRoomView } from "@/lib/room";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const examiner = await requireExaminer(req);
  return Response.json({ rooms: await listRooms(examiner.id) });
});

const createSchema = z.object({ title: z.string().max(120).optional() });

export const POST = route(async (req) => {
  const examiner = await requireExaminer(req);
  const body = createSchema.parse(await req.json().catch(() => ({})));
  const room = await createRoom(examiner, body.title);
  const full = await prisma.room.findUniqueOrThrow({
    where: { id: room.id },
    include: { examiner: true, _count: { select: { attempts: true } } },
  });
  return Response.json({ room: toRoomView(full) }, { status: 201 });
});
