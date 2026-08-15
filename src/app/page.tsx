"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { SitePage } from "@/components/site/site-chrome";
import { ExamCard } from "@/components/site/exam-card";
import { GoogleMark } from "@/components/google-mark";
import { Button, Notice, Spinner } from "@/components/ui";
import { catalogueGroups, useCatalogue } from "@/lib/catalogue";

export default function HomePage() {
  const { session, ready, signIn, configured, error } = useAuth();
  const exams = useCatalogue();

  // Whatever is actually sittable comes first, then the nearest coming soon.
  const entries = exams ? catalogueGroups(exams).flatMap((g) => g.entries) : [];
  const featured = [...entries.filter((e) => e.live), ...entries.filter((e) => !e.live)].slice(0, 6);

  return (
    <SitePage>
      {/* -------------------------------- hero -------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-14 pt-16 lg:pt-20">
        <h1 className="max-w-3xl font-display text-[42px] leading-[1.1] tracking-tight text-ink sm:text-[56px]">
          Mock tests that feel like the real exam.
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Timed, marked instantly, explained by AI. Free to practise.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {ready && session ? (
            <Link href="/dashboard">
              <Button variant="primary" className="h-12 px-6 text-[15px]">
                My papers
              </Button>
            </Link>
          ) : (
            <Button
              variant="primary"
              className="h-12 px-6 text-[15px]"
              disabled={!configured}
              onClick={() => void signIn()}
            >
              <GoogleMark />
              Start free
            </Button>
          )}
          <Link href="/exams">
            <Button className="h-12 px-6 text-[15px]">See all exams</Button>
          </Link>
        </div>

        {!configured ? (
          <div className="mt-6 max-w-md">
            <Notice tone="warn">Sign-in is not configured on this deployment yet.</Notice>
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 max-w-md">
            <Notice tone="bad">{error}</Notice>
          </div>
        ) : null}
      </section>

      {/* ------------------------------- exams -------------------------------- */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-[28px] tracking-tight text-ink">Popular exams</h2>
            <Link href="/exams" className="text-[15px] font-medium text-accent hover:underline">
              See all
            </Link>
          </div>

          {exams === null ? (
            <div className="flex justify-center py-14">
              <Spinner />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((entry) => (
                <ExamCard key={entry.name} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------- how it works --------------------------- */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-[28px] tracking-tight text-ink">How it works</h2>
        <div className="mt-8 grid gap-10 md:grid-cols-3">
          {[
            ["01", "Sit the paper", "Section timers, exactly like the hall."],
            ["02", "See the score", "Marked instantly, section by section."],
            ["03", "Fix the mistakes", "AI works through any answer you missed."],
          ].map(([step, title, body]) => (
            <div key={step}>
              <span className="eyebrow block">{step}</span>
              <h3 className="mt-2 font-display text-[21px] tracking-tight text-ink">{title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------- invigilation ---------------------------- */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <p className="eyebrow block">For coaching centres</p>
            <h2 className="mt-2 font-display text-[28px] leading-tight tracking-tight text-ink">
              Run a supervised mock
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">
              Share a code. Watch every candidate on camera while their answers are marked live.
              Nothing to install.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pricing#institutions">
                <Button className="h-11 px-5">Pricing</Button>
              </Link>
              <Link href="/admin">
                <Button variant="quiet" className="h-11 px-5">
                  Examiner sign-in
                </Button>
              </Link>
            </div>
          </div>

          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {[
              ["Live camera", "Video and audio, in the browser"],
              ["Marked live", "Right or wrong as they answer"],
              ["One clock", "Pause the room, all timers stop"],
              ["Exit flags", "Leaving the window is recorded"],
            ].map(([title, body]) => (
              <li key={title} className="bg-surface p-5">
                <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-[14px] text-ink-2">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SitePage>
  );
}
