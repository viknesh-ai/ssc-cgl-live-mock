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
    body: "Own the question bank: commission papers, check keys and explanations, and decide what a good mock actually looks like for SSC, banking and railways.",
  },
  {
    title: "Full-stack engineer",
    type: "Full time · Remote",
    body: "TypeScript, Next.js and Postgres. You would work across the exam engine, the invigilation stack and the studio that content is made in.",
  },
  {
    title: "Institutional partnerships",
    type: "Full time · Hybrid (Chennai)",
    body: "Work with coaching centres running weekly batches: understand how they test, get their papers onto the platform, and keep them happy.",
  },
];

export default function CareersPage() {
  return (
    <SitePage>
      <div className="mx-auto max-w-4xl px-5 py-14">
        <p className="eyebrow block">Careers</p>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
          Help make practice count for something
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          {APP_NAME} is small. Everyone here works close to candidates and to the people who set
          their papers, and the work shows up in the product within the week.
        </p>

        <div className="mt-10 space-y-4">
          {ROLES.map((role) => (
            <Panel key={role.title}>
              <div className="flex flex-wrap items-start justify-between gap-4 p-6">
                <div className="max-w-xl">
                  <h2 className="font-display text-lg tracking-tight text-ink">{role.title}</h2>
                  <p className="mt-1 text-[12.5px] text-ink-3">{role.type}</p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{role.body}</p>
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
          <h2 className="font-display text-xl tracking-tight text-ink">
            Nothing here that fits you?
          </h2>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-2">
            Write to us anyway with what you would want to work on. Tell us about something you have
            built or taught, rather than sending a résumé alone.
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
