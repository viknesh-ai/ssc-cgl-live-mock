import { requireExaminer, route } from "@/lib/auth-server";
import { listExams } from "@/lib/bank";

export const dynamic = "force-dynamic";

/** Exams and their sections, with how many published questions each holds. */
export const GET = route(async (req) => {
  await requireExaminer(req);
  return Response.json({ exams: await listExams() });
});
