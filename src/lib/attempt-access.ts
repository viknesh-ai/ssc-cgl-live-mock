import { HttpError } from "@/lib/auth-server";
import { getAttempt, type FullAttempt } from "@/lib/attempt";
import type { User } from "@/generated/prisma/client";

/** Loads an attempt, refusing anyone who is not the candidate who owns it. */
export async function loadOwnAttempt(user: User, id: string | number): Promise<FullAttempt> {
  const attemptId = Number(id);
  if (!Number.isInteger(attemptId)) throw new HttpError(400, "Invalid paper id.");
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new HttpError(404, "No such paper.");
  if (attempt.userId !== user.id) throw new HttpError(403, "This paper belongs to someone else.");
  return attempt;
}

/** Loads an attempt for its examiner, or for the candidate who owns it. */
export async function loadVisibleAttempt(user: User, id: string | number): Promise<FullAttempt> {
  const attemptId = Number(id);
  if (!Number.isInteger(attemptId)) throw new HttpError(400, "Invalid paper id.");
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new HttpError(404, "No such paper.");
  const isOwner = attempt.userId === user.id;
  const isExaminer = user.role === "EXAMINER" && attempt.room?.examinerId === user.id;
  if (!isOwner && !isExaminer) throw new HttpError(403, "You cannot view this paper.");
  return attempt;
}
