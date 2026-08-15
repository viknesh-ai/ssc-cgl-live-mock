"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ExaminerLogin } from "@/components/admin/console-shell";
import { Mark } from "@/components/wordmark";
import { Button, Spinner, cx } from "@/components/ui";

/**
 * The content studio — where exams, papers and questions are made.
 *
 * Deliberately unlinked: nothing in the public site or the proctoring console
 * points here. It is reached by typing the address, and still requires the
 * examiner login on top of that.
 */
const NAV = [
  { href: "/studio", label: "Overview", hint: "What the library holds" },
  { href: "/studio/exams", label: "Exams", hint: "Sections and marking" },
  { href: "/studio/papers", label: "Papers", hint: "What candidates sit" },
  { href: "/studio/questions", label: "Question bank", hint: "Write and edit" },
  { href: "/studio/import", label: "Import", hint: "PDF, Word or text" },
];

export function StudioShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { ready, session, signOut } = useAuth();
  const pathname = usePathname();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (session?.role !== "EXAMINER") return <ExaminerLogin />;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-40 border-b border-line bg-ink text-white">
        <div className="flex h-14 items-center justify-between gap-4 px-5">
          <Link href="/studio" className="flex items-center gap-2.5">
            <span className="rounded-sm bg-white/10 p-1">
              <Mark className="size-4" />
            </span>
            <span className="font-display text-[17px] font-semibold tracking-tight">Studio</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-[12.5px] text-white/60 underline-offset-4 hover:text-white hover:underline"
            >
              Proctoring console
            </Link>
            <Button
              variant="quiet"
              size="sm"
              className="text-white/70 hover:bg-white/10 hover:text-white"
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="shrink-0 border-b border-line bg-surface md:w-56 md:border-b-0 md:border-r">
          <ul className="flex gap-1 overflow-x-auto p-3 md:flex-col md:gap-0.5">
            {NAV.map((item) => {
              const active =
                item.href === "/studio" ? pathname === "/studio" : pathname.startsWith(item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className={cx(
                      "block rounded-md px-3 py-2 text-[13.5px] transition-colors",
                      active ? "bg-ink text-white" : "text-ink-2 hover:bg-subtle hover:text-ink",
                    )}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span
                      className={cx(
                        "mt-0.5 hidden text-[11.5px] md:block",
                        active ? "text-white/60" : "text-ink-3",
                      )}
                    >
                      {item.hint}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 px-5 py-7">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl tracking-tight text-ink">{title}</h1>
                {description ? (
                  <p className="mt-1 max-w-2xl text-[13.5px] text-ink-2">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
