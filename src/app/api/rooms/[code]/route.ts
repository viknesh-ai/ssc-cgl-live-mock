import { HttpError, requireUser, route } from "@/lib/auth-server";
import { fullRoom, requireRoom, roomAttempts, toRoomView } from "@/lib/room";
import { getPaperSpec } from "@/lib/paper";
import { toCandidateLive } from "@/lib/attempt";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

type RoomContext = { params: Promise<{ code: string }> };

/** Examiner: the full candidate table. Candidate: just enough to show status. */
export const GET = route(async (req: Request, ctx: RoomContext) => {
  const { code } = await ctx.params;
  const user = await requireUser(req);
  const room = await requireRoom(code);
  const full = await fullRoom(room.id);

  if (user.role !== "EXAMINER") {
    return Response.json({ room: toRoomView(full), candidates: [] });
  }

  const spec = await getPaperSpec(room.paperId);
  const attempts = await roomAttempts(room.id);
  return Response.json({
    room: toRoomView(full),
    candidates: attempts.map((a) => toCandidateLive(a, spec, hub.presenceOf(a.id))),
  });
});

void HttpError;
