import { route } from "@/lib/auth-server";
import { clearedCookieHeader, isSecureRequest } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/** Ends this device's examiner session; other devices stay signed in. */
export const POST = route(async (req) => {
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": clearedCookieHeader(isSecureRequest(req)) } },
  );
});
