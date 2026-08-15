import { HttpError, requireUser, route } from "@/lib/auth-server";
import { syncClock, toCandidateSheet } from "@/lib/attempt";
import { loadVisibleAttempt } from "@/lib/attempt-access";

export const dynamic = "force-dynamic";

/**
 * The examiner's view of a candidate's paper: every question, what they picked
 * and what the key says, so answers can be marked live while the exam runs.
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  if (user.role !== "EXAMINER") throw new HttpError(403, "Examiner access only.");
  const attempt = await syncClock(await loadVisibleAttempt(user, id));
  return Response.json({ sheet: toCandidateSheet(attempt) });
});
