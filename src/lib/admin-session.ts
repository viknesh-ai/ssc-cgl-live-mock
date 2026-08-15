/**
 * Examiner sign-in with a shared username and password.
 *
 * Candidates sign in with Google, but an examiner needs to get into the console
 * from any device — including a phone in an exam hall — and several people may
 * need to invigilate the same room at once. So examiners share one credential
 * and each browser gets its own signed session cookie; sessions do not conflict
 * with one another.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { HttpError } from "@/lib/auth-server";
import type { User } from "@/generated/prisma/client";

export const SESSION_COOKIE = "examiner_session";
const SESSION_DAYS = 30;
const ISSUER = "ssc-mock:examiner";

const key = () => createHash("sha256").update(serverEnv.sessionSecret).digest();

/** Constant-time comparison, so a wrong password leaks nothing through timing. */
function matches(given: string, expected: string) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function verifyCredentials(username: string, password: string) {
  const expectedPassword = serverEnv.adminPassword;
  if (!expectedPassword) {
    throw new HttpError(503, "Examiner sign-in is not configured on this server.");
  }
  const ok =
    matches(username.trim().toLowerCase(), serverEnv.adminUsername.toLowerCase()) &&
    matches(password, expectedPassword);
  if (!ok) throw new HttpError(401, "Wrong username or password.");
}

/** The examiner identity every shared login maps onto. */
export async function examinerUser(): Promise<User> {
  const username = serverEnv.adminUsername.toLowerCase();
  const email = `${username}@examiner.local`;
  return prisma.user.upsert({
    where: { firebaseUid: `examiner:${username}` },
    create: {
      firebaseUid: `examiner:${username}`,
      email,
      name: "Examiner",
      role: "EXAMINER",
    },
    update: { role: "EXAMINER", lastSeenAt: new Date() },
  });
}

export async function issueSession(userId: number) {
  return new SignJWT({ kind: "examiner" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function userFromSessionToken(token: string | null | undefined): Promise<User | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER });
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) return null;
    const user = await prisma.user.findUnique({ where: { id } });
    return user?.role === "EXAMINER" ? user : null;
  } catch {
    return null;
  }
}

/** Reads our cookie out of a raw Cookie header (works for HTTP and websockets). */
export function sessionCookieFrom(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** True when the browser reached us over https, proxy hops included. */
export function isSecureRequest(req: Request) {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}

export function sessionCookieHeader(token: string, secure: boolean) {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearedCookieHeader(secure: boolean) {
  const attrs = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
