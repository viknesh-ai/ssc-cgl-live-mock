"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { SitePage } from "@/components/site/site-chrome";
import { GoogleMark } from "@/components/google-mark";
import { Button, Notice, Spinner } from "@/components/ui";
import { useCatalogue } from "@/lib/catalogue";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export default function HomePage() {
  const { session, ready, signIn, configured, error } = useAuth();
  const exams = useCatalogue();

  return (
    <SitePage>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 lg:pb-24 lg:pt-24">
        <div className="max-w-3xl">
          <p className="eyebrow block">{APP_TAGLINE}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.12] tracking-tight text-ink sm:text-5xl">
            Practise under the conditions you will actually sit in.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-2">
            Timed papers that lock section by section, marked the moment you finish, with an AI that
            works through anything you got wrong. When a paper has to be supervised, an examiner
            watches over camera from the same screen.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {ready && session ? (
              <Link href="/dashboard">
                <Button variant="primary" className="h-11 px-5">
                  Go to my papers
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                className="h-11 px-5"
                disabled={!configured}
                onClick={() => void signIn()}
              >
                <GoogleMark />
                Start a free paper
              </Button>
            )}
            <Link href="/exams">
              <Button className="h-11 px-5">Browse exams</Button>
            </Link>
          </div>

          {!configured ? (
            <div className="mt-6 max-w-md">
              <Notice tone="warn">
                Sign-in is not configured on this deployment yet. Set the Firebase variables and
                redeploy.
              </Notice>
            </div>
          ) : null}
          {error ? (
            <div className="mt-6 max-w-md">
              <Notice tone="bad">{error}</Notice>
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------ how it works ------------------------ */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Sit the paper",
              body: "Each section runs on its own clock and locks when the time is gone. Submit a section early and the next opens straight away — unused time does not carry over, exactly as in the hall.",
            },
            {
              step: "02",
              title: "Get it marked",
              body: "Scoring follows the exam's own scheme, including negative marking. Section-by-section accuracy shows where the marks actually went.",
            },
            {
              step: "03",
              title: "Understand the misses",
              body: "Ask for a worked explanation on any question. Where a solution came with the paper it is shown as written; otherwise an AI works it through.",
            },
          ].map((item) => (
            <div key={item.step}>
              <span className="eyebrow block">{item.step}</span>
              <h2 className="mt-2 font-display text-xl tracking-tight text-ink">{item.title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- exams ------------------------------ */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight text-ink">Exams on {APP_NAME}</h2>
            <p className="mt-1 text-[14px] text-ink-2">
              Competitive examinations from India and beyond, each with its own sections and marking.
            </p>
          </div>
          <Link href="/exams" className="text-[13.5px] font-medium text-accent hover:underline">
            See all
          </Link>
        </div>

        <div className="mt-7 border-t-2 border-ink">
          {exams === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : exams.length === 0 ? (
            <p className="py-8 text-[14px] text-ink-2">Papers are being prepared.</p>
          ) : (
            exams.slice(0, 6).map((exam) => (
              <Link
                key={exam.id}
                href={`/exams/${exam.slug}`}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-4 hover:bg-surface"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-lg tracking-tight text-ink">{exam.name}</h3>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    {exam.region ?? "International"} ·{" "}
                    {exam.sections.map((s) => s.shortName).join(", ")}
                  </p>
                </div>
                <div className="tabular shrink-0 text-[13px] text-ink-3">
                  {exam.papers.length} paper{exam.papers.length === 1 ? "" : "s"} ·{" "}
                  {exam.questionCount} questions
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* ---------------------------- invigilation -------------------------- */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <p className="eyebrow block">For coaching centres and institutions</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink">
              Supervised sittings, without installing anything
            </h2>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-2">
              Create a session, share its code, and watch candidates write in real time: camera and
              microphone, answers marked as they are picked, a message thread to each candidate, and
              a record of anyone who left the exam window. It runs in the browser — nothing to
              install, on either side.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pricing#institutions">
                <Button>See institution pricing</Button>
              </Link>
              <Link href="/admin">
                <Button variant="quiet">Examiner sign-in</Button>
              </Link>
            </div>
          </div>

          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {[
              ["Live camera", "WebRTC video, with a still-frame fallback on networks that block it"],
              ["Marked live", "Right and wrong shown to the examiner as answers are picked"],
              ["One clock", "Pause the room and every candidate's timer stops together"],
              ["Flagged exits", "Leaving the exam window is counted and shown"],
            ].map(([title, body]) => (
              <li key={title} className="bg-surface p-5">
                <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SitePage>
  );
}
