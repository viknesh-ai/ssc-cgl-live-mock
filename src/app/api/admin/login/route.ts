import { z } from "zod";
import { route } from "@/lib/auth-server";
import {
  examinerUser,
  isSecureRequest,
  issueSession,
  sessionCookieHeader,
  verifyCredentials,
} from "@/lib/admin-session";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

/** Examiner sign-in. Several devices may hold a session at the same time. */
export const POST = route(async (req) => {
  const { username, password } = schema.parse(await req.json().catch(() => ({})));
  await verifyCredentials(username, password);

  const user = await examinerUser();
  const token = await issueSession(user.id);
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    photoUrl: null,
    role: "EXAMINER",
  };

  return Response.json(session, {
    headers: {
      "set-cookie": sessionCookieHeader(token, isSecureRequest(req)),
    },
  });
});
