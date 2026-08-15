import { requireUser, route } from "@/lib/auth-server";
import { startSoloAttempt, toAttemptState } from "@/lib/attempt";

export const dynamic = "force-dynamic";

/** Starts (or resumes) an unproctored solo paper — no room, no examiner. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const attempt = await startSoloAttempt(user.id);
  return Response.json({ state: toAttemptState(attempt) });
});
