import { z } from "zod";
import { HttpError, requireExaminer, route } from "@/lib/auth-server";
import { controlRoom, requireRoom, toRoomView } from "@/lib/room";
import { prisma } from "@/lib/prisma";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["start", "pause", "resume", "end"]) });

/** Start, pause, resume or end an exam. Everyone watching is told immediately. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const examiner = await requireExaminer(req);
  const room = await requireRoom(code);
  if (room.examinerId !== examiner.id) {
    throw new HttpError(403, "This room belongs to another examiner.");
  }

  const { action } = schema.parse(await req.json().catch(() => ({})));
  const updated = await controlRoom(room, action);

  await hub.publishRoomCandidates(updated.id);
  await hub.publishRoom(updated.id);

  const full = await prisma.room.findUniqueOrThrow({
    where: { id: updated.id },
    include: { examiner: true, _count: { select: { attempts: true } } },
  });
  return Response.json({ room: toRoomView(full) });
});
