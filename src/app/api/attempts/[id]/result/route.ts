import { HttpError, requireUser, route } from "@/lib/auth-server";
import { specOf, toAttemptResult } from "@/lib/attempt";
import { loadVisibleAttempt } from "@/lib/attempt-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The marked paper, plus any AI explanations already generated for it. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const attempt = await loadVisibleAttempt(user, id);
  if (attempt.status !== "SUBMITTED") {
    throw new HttpError(409, "This paper has not been submitted yet.");
  }

  const cached = await prisma.explanation.findMany({
    where: { questionId: { in: attempt.items.map((i) => i.questionId) } },
    select: { questionId: true, content: true },
  });

  return Response.json({
    result: toAttemptResult(attempt, await specOf(attempt)),
    candidateName: attempt.user.name,
    explanations: Object.fromEntries(cached.map((e) => [e.questionId, e.content])),
  });
});
