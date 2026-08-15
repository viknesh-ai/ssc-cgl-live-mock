import { HttpError, requireUser, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { requireRoom, roomAttempts, toRoomView } from "@/lib/room";
import { toCandidateLive } from "@/lib/attempt";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

type RoomContext = { params: Promise<{ code: string }> };

/** Examiner: the full candidate table. Candidate: just enough to show status. */
export const GET = route(async (req: Request, ctx: RoomContext) => {
  const { code } = await ctx.params;
  const user = await requireUser(req);
  const room = await requireRoom(code);

  const full = await prisma.room.findUniqueOrThrow({
    where: { id: room.id },
    include: { examiner: true, _count: { select: { attempts: true } } },
  });

  if (user.role !== "EXAMINER") {
    return Response.json({ room: toRoomView(full), candidates: [] });
  }
  if (room.examinerId !== user.id) {
    throw new HttpError(403, "This room belongs to another examiner.");
  }

  const attempts = await roomAttempts(room.id);
  return Response.json({
    room: toRoomView(full),
    candidates: attempts.map((a) => toCandidateLive(a, hub.presenceOf(a.id))),
  });
});
