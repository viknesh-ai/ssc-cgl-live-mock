import { requireUser, route } from "@/lib/auth-server";
import { submitAttempt, syncClock, toAttemptResult } from "@/lib/attempt";
import { loadOwnAttempt } from "@/lib/attempt-access";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

/** Ends the paper and returns the marked result, answer key included. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const attempt = await syncClock(await loadOwnAttempt(user, id));
  const submitted = await submitAttempt(attempt);
  if (submitted.roomId) await hub.publishRoom(submitted.roomId);
  return Response.json({ result: toAttemptResult(submitted) });
});
