"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button, cx } from "@/components/ui";

/**
 * One header everywhere. The right-hand slot is where a page puts the thing
 * that must always be visible — the exam clock, or the room status.
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
          "mx-auto flex items-center justify-between gap-4 px-5",
          compact ? "h-14 max-w-none" : "h-14 max-w-6xl",
        )}
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight text-ink">
            SSC CGL Tier-I Mock
          </Link>
          {subtitle ? (
            <span className="hidden truncate text-[13px] text-ink-2 sm:block">{subtitle}</span>
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
