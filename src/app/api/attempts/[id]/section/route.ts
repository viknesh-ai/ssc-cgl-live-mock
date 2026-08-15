import { requireUser, route } from "@/lib/auth-server";
import { advanceSection, specOf, syncClock, toAttemptState } from "@/lib/attempt";
import { loadOwnAttempt } from "@/lib/attempt-access";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

/** Submits the current section early and opens the next on a fresh clock. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const attempt = await syncClock(await loadOwnAttempt(user, id));
  const updated = await advanceSection(attempt);
  if (updated.roomId) await hub.publishRoom(updated.roomId);
  return Response.json({ state: toAttemptState(updated, await specOf(updated)) });
});
