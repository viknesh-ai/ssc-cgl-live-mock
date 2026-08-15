"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Wordmark } from "@/components/wordmark";
import { Button, cx } from "@/components/ui";

/**
 * One header everywhere. The right-hand slot holds whatever must stay visible
 * on that page — the exam clock, or the room's connection state.
 */
export function AppHeader({
  subtitle,
  right,
  compact = false,
}: {
  subtitle?: string;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  const { session, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div
        className={cx(
          "mx-auto flex h-14 items-center justify-between gap-4 px-5",
          compact ? "max-w-none" : "max-w-6xl",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Home">
            <Wordmark />
          </Link>
          {subtitle ? (
            <>
              <span aria-hidden className="h-4 w-px bg-line-strong" />
              <span className="hidden truncate text-[13px] text-ink-2 sm:block">{subtitle}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {right}
          {session ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-[13px] font-medium text-ink">{session.name}</div>
                <div className="text-[11px] text-ink-3">
                  {session.role === "EXAMINER" ? "Examiner" : session.email}
                </div>
              </div>
              <Button variant="quiet" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
