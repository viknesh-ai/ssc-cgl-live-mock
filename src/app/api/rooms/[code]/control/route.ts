import { z } from "zod";
import { requireExaminer, route } from "@/lib/auth-server";
import { controlRoom, fullRoom, requireRoom, toRoomView } from "@/lib/room";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["start", "pause", "resume", "end"]) });

/** Start, pause, resume or end an exam. Everyone watching is told immediately. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  await requireExaminer(req);
  const room = await requireRoom(code);

  const { action } = schema.parse(await req.json().catch(() => ({})));
  const updated = await controlRoom(room, action);

  await hub.publishRoomCandidates(updated.id);
  await hub.publishRoom(updated.id);

  return Response.json({ room: toRoomView(await fullRoom(updated.id)) });
});
