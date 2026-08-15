/**
 * Verifies Firebase ID tokens without the Admin SDK.
 *
 * Google publishes the token-signing keys as a JWKS, so a plain JWT verify is
 * enough — no service-account credentials to store or rotate. The verified
 * token is then mapped onto a row in our own `User` table, which is the
 * identity the rest of the app works with.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import type { User } from "@/generated/prisma/client";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type FirebaseClaims = JWTPayload & {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function verifyIdToken(token: string | null | undefined): Promise<FirebaseClaims | null> {
  if (!token) return null;
  const projectId = serverEnv.firebaseProjectId;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) return null;
    return payload as FirebaseClaims;
  } catch {
    return null;
  }
}

/** Maps a verified token onto our own user row, creating it on first sign-in. */
export async function userFromClaims(claims: FirebaseClaims): Promise<User> {
  const email = (claims.email ?? "").trim().toLowerCase();
  if (!email) throw new HttpError(403, "Your Google account did not share an email address.");

  const role = email === serverEnv.examinerEmail ? "EXAMINER" : "CANDIDATE";
  const name = (claims.name ?? "").trim() || email.split("@")[0];

  return prisma.user.upsert({
    where: { firebaseUid: claims.sub },
    create: {
      firebaseUid: claims.sub,
      email,
      name,
      photoUrl: claims.picture ?? null,
      role,
    },
    update: {
      email,
      name,
      photoUrl: claims.picture ?? null,
      role,
      lastSeenAt: new Date(),
    },
  });
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** Resolves the signed-in user for an API route, or throws a 401. */
export async function requireUser(req: Request): Promise<User> {
  const claims = await verifyIdToken(bearerToken(req));
  if (!claims) throw new HttpError(401, "Please sign in again.");
  return userFromClaims(claims);
}

export async function requireExaminer(req: Request): Promise<User> {
  const user = await requireUser(req);
  if (user.role !== "EXAMINER") throw new HttpError(403, "Examiner access only.");
  return user;
}

/** Wraps a route handler so thrown HttpErrors become clean JSON responses. */
export function route<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<Response>,
) {
  return async (req: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      console.error("[api]", err);
      const message = err instanceof Error ? err.message : "Unexpected server error";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
