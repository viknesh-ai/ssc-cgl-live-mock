import { requireUser, route } from "@/lib/auth-server";
import { joinRoom, specOf, toAttemptState } from "@/lib/attempt";
import { hub } from "@/server/hub";

export const dynamic = "force-dynamic";

/**
 * Checks a candidate into a room. Called on every visit — re-joining returns
 * the paper already drawn for them rather than a new one.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const user = await requireUser(req);
  const attempt = await joinRoom(user.id, code.toUpperCase());
  if (attempt.roomId) await hub.publishRoom(attempt.roomId);
  return Response.json({ state: toAttemptState(attempt, await specOf(attempt)) });
});
