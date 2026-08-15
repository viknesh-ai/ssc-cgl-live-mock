import { requireUser, route } from "@/lib/auth-server";
import { syncClock, toAttemptState } from "@/lib/attempt";
import { loadOwnAttempt } from "@/lib/attempt-access";

export const dynamic = "force-dynamic";

/** The candidate's current exam state, with the clock brought up to date. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const attempt = await syncClock(await loadOwnAttempt(user, id));
  return Response.json({ state: toAttemptState(attempt) });
});
