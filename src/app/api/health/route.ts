import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Railway health check: the app is only healthy if the database answers. */
export async function GET() {
  try {
    const questions = await prisma.question.count();
    return Response.json({ ok: true, questions });
  } catch (err) {
    console.error("[health]", err);
    return Response.json({ ok: false, error: "database unavailable" }, { status: 503 });
  }
}
