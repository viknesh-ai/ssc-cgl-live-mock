import { requireUser, route } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The signed-in candidate's recent papers, for the results list on the home page. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const attempts = await prisma.attempt.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    take: 20,
    include: { room: { select: { code: true, title: true } } },
  });

  return Response.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      mode: a.mode,
      status: a.status,
      totalScore: a.totalScore,
      joinedAt: a.joinedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      roomCode: a.room?.code ?? null,
      roomTitle: a.room?.title ?? null,
    })),
  });
});
