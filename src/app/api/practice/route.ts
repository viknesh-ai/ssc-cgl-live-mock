import { z } from "zod";
import { requireUser, route } from "@/lib/auth-server";
import { specOf, startSoloAttempt, toAttemptState } from "@/lib/attempt";
import { defaultPaper } from "@/lib/paper";

export const dynamic = "force-dynamic";

const schema = z.object({ paperId: z.number().int().positive().optional() });

/** Starts (or resumes) an unproctored solo paper — no room, no examiner. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = schema.parse(await req.json().catch(() => ({})));
  const paperId = body.paperId ?? (await defaultPaper()).id;
  const attempt = await startSoloAttempt(user.id, paperId);
  return Response.json({ state: toAttemptState(attempt, await specOf(attempt)) });
});
