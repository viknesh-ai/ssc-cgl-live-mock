import { requireUser, route } from "@/lib/auth-server";
import { loadVisibleAttempt } from "@/lib/attempt-access";
import { prisma } from "@/lib/prisma";
import type { ChatLine } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Chat history for one candidate's thread; live messages arrive over /ws. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const attempt = await loadVisibleAttempt(user, id);

  const rows = await prisma.chatMessage.findMany({
    where: { attemptId: attempt.id },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { name: true } } },
  });

  const lines: ChatLine[] = rows.map((row) => ({
    id: row.id,
    attemptId: row.attemptId,
    body: row.body,
    fromExaminer: row.fromExaminer,
    senderName: row.sender.name,
    createdAt: row.createdAt.toISOString(),
  }));
  return Response.json({ lines });
});
