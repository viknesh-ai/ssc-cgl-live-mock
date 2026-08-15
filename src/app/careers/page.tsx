import type { Metadata } from "next";
import { SitePage } from "@/components/site/site-chrome";
import { Button, Panel } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Careers",
  description: "Open roles at Invigil.",
};

/** Placeholder openings — edit this list as roles actually open. */
const ROLES = [
  {
    title: "Content lead — Indian competitive exams",
    type: "Full time · Remote (India)",
    body: "Own the question bank for SSC, banking and railways.",
  },
  {
    title: "Full-stack engineer",
    type: "Full time · Remote",
    body: "TypeScript, Next.js, Postgres. Exam engine and invigilation.",
  },
  {
    title: "Institutional partnerships",
    type: "Full time · Hybrid (Chennai)",
    body: "Get coaching centres running weekly batches with us.",
  },
];

export default function CareersPage() {
  return (
    <SitePage>
      <div className="mx-auto max-w-4xl px-5 py-14">
        <p className="eyebrow block">Careers</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">Work with us</h1>
        <p className="mt-4 max-w-xl text-[17px] text-ink-2">
          {APP_NAME} is small. What you build ships the same week.
        </p>

        <div className="mt-10 space-y-4">
          {ROLES.map((role) => (
            <Panel key={role.title}>
              <div className="flex flex-wrap items-start justify-between gap-4 p-6">
                <div className="max-w-xl">
                  <h2 className="font-display text-[21px] tracking-tight text-ink">{role.title}</h2>
                  <p className="mt-1 text-[14px] text-ink-3">{role.type}</p>
                  <p className="mt-3 text-[15px] text-ink-2">{role.body}</p>
                </div>
                <a
                  href={`mailto:careers@invigil.app?subject=${encodeURIComponent(role.title)}`}
                  className="shrink-0"
                >
                  <Button>Apply</Button>
                </a>
              </div>
            </Panel>
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-8">
          <h2 className="font-display text-[24px] tracking-tight text-ink">Nothing fits?</h2>
          <p className="mt-2 max-w-xl text-[15px] text-ink-2">
            Write anyway. Tell us what you have built or taught.
          </p>
          <div className="mt-4">
            <a href="mailto:careers@invigil.app">
              <Button variant="primary">careers@invigil.app</Button>
            </a>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
