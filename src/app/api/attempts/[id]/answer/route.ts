import { z } from "zod";
import { requireUser, route } from "@/lib/auth-server";
import { saveAnswer, syncClock, toAttemptState } from "@/lib/attempt";
import { loadOwnAttempt } from "@/lib/attempt-access";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

const schema = z.object({
  order: z.number().int().min(0).max(99),
  selected: z.number().int().min(0).max(3).nullable().optional(),
  marked: z.boolean().optional(),
  currentIndex: z.number().int().min(0).max(24).optional(),
});

/** Records one answer, review flag or navigation step. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const attempt = await syncClock(await loadOwnAttempt(user, id));
  const updated = await saveAnswer(attempt, schema.parse(await req.json()));

  // The examiner's live view follows the candidate keystroke by keystroke.
  if (updated.roomId) void hub.publishRoom(updated.roomId);

  return Response.json({ state: toAttemptState(updated) });
});
