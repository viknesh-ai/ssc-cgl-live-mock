import { requireUser, route } from "@/lib/auth-server";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Exchanges a Firebase ID token for this app's own user record. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl,
    role: user.role,
  };
  return Response.json(session);
});
