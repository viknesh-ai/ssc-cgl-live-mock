import { z } from "zod";
import { requireExaminer, route } from "@/lib/auth-server";
import { createRoom, listRooms, toRoomView } from "@/lib/room";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireExaminer(req);
  return Response.json({ rooms: await listRooms() });
});

const createSchema = z.object({
  paperId: z.number().int().positive(),
  title: z.string().max(120).optional(),
});

export const POST = route(async (req) => {
  const examiner = await requireExaminer(req);
  const body = createSchema.parse(await req.json().catch(() => ({})));
  const room = await createRoom(examiner, body.paperId, body.title);
  return Response.json({ room: toRoomView(room) }, { status: 201 });
});
