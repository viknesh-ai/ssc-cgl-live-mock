"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Wordmark } from "@/components/wordmark";
import { Button, cx } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

const NAV = [
  { href: "/exams", label: "Exams" },
  { href: "/pricing", label: "Pricing" },
  { href: "/careers", label: "Careers" },
];

/** Header for the public pages. The studio is never linked from here. */
export function SiteHeader() {
  const { session, ready, signIn, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-15 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-7">
          <Link href="/" aria-label={`${APP_NAME} home`}>
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "text-[13.5px] transition-colors",
                  pathname.startsWith(item.href)
                    ? "font-medium text-ink"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {ready && session ? (
            <>
              <Link href="/dashboard" className="hidden sm:block">
                <Button size="sm">My papers</Button>
              </Link>
              <Button variant="quiet" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : ready ? (
            <Button variant="primary" size="sm" onClick={() => void signIn()}>
              Sign in
            </Button>
          ) : null}
          <button
            aria-label="Menu"
            className="rounded-md border border-line-strong px-2.5 py-1.5 text-[13px] text-ink-2 md:hidden"
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-line bg-surface md:hidden">
          <ul className="mx-auto max-w-6xl px-5 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-[14px] text-ink-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-2">
            Timed mock examinations with live invigilation and an AI review of every answer.
          </p>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { href: "/exams", label: "Exams" },
            { href: "/pricing", label: "Pricing" },
            { href: "/dashboard", label: "My papers" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { href: "/careers", label: "Careers" },
            { href: "mailto:hello@invigil.app", label: "Contact" },
          ]}
        />
        <FooterColumn
          title="For institutions"
          links={[
            { href: "/pricing#institutions", label: "Run a proctored sitting" },
            { href: "/admin", label: "Examiner sign-in" },
          ]}
        />
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-[12.5px] text-ink-3">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <span>Mock examinations for practice. Not affiliated with any examining authority.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="eyebrow block">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-[13px] text-ink-2 hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Wraps a public page in the header and footer. */
export function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
