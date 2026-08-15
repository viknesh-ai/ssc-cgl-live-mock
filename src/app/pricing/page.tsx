import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/components/site/site-chrome";
import { Badge, Button, Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free to practise. Paid when a sitting has to be invigilated.",
};

/**
 * Placeholder commercial terms. The numbers are the one thing here that has to
 * come from the business rather than the code — change them in this file.
 */
const PLANS = [
  {
    name: "Practice",
    price: "Free",
    cadence: "",
    summary: "Practising on your own.",
    features: [
      "Unlimited mock tests",
      "Instant section-wise scores",
      "AI explanations",
      "Full history",
    ],
    cta: { label: "Start a paper", href: "/exams" },
    highlight: false,
  },
  {
    name: "Supervised",
    price: "₹149",
    cadence: "per candidate, per sitting",
    summary: "A proctored mock that counts.",
    features: [
      "Everything in Practice",
      "Live camera invigilation",
      "Answers marked as they are given",
      "Exit flags on the report",
      "Chat with the examiner",
    ],
    cta: { label: "Talk to us", href: "mailto:hello@invigil.app?subject=Supervised%20sittings" },
    highlight: true,
  },
  {
    name: "Institution",
    price: "Custom",
    cadence: "",
    summary: "Batches, every week.",
    features: [
      "Unlimited sittings and examiners",
      "Your own question bank",
      "Custom exams and marking",
      "Batch results",
    ],
    cta: { label: "Request a quote", href: "mailto:hello@invigil.app?subject=Institution%20plan" },
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <SitePage>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="max-w-2xl">
          <p className="eyebrow block">Pricing</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">
            Free to practise
          </h1>
          <p className="mt-4 text-[17px] text-ink-2">
            You pay only when a sitting has to be watched.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Panel
              key={plan.name}
              className={plan.highlight ? "border-ink ring-1 ring-ink" : undefined}
            >
              <div className="flex h-full flex-col p-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-xl tracking-tight text-ink">{plan.name}</h2>
                  {plan.highlight ? <Badge tone="accent">Most used</Badge> : null}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl tracking-tight text-ink">{plan.price}</span>
                  {plan.cadence ? (
                    <span className="text-[12.5px] text-ink-3">{plan.cadence}</span>
                  ) : null}
                </div>
                <p className="mt-3 text-[15px] text-ink-2">{plan.summary}</p>

                <ul className="mt-5 flex-1 space-y-2 border-t border-line pt-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-[15px] text-ink-2">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Link href={plan.cta.href}>
                    <Button variant={plan.highlight ? "primary" : "secondary"} className="w-full">
                      {plan.cta.label}
                    </Button>
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>

        <section id="institutions" className="mt-16 border-t border-line pt-10">
          <h2 className="font-display text-[28px] tracking-tight text-ink">For institutions</h2>
          <div className="mt-5 grid gap-8 md:grid-cols-3">
            {[
              ["Your papers", "Send us your PDFs. They become your own question bank."],
              ["Any exam", "Sections, timing and marking set per exam."],
              ["No install", "A browser and a camera is all anyone needs."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-line pt-10">
          <h2 className="font-display text-[28px] tracking-tight text-ink">Common questions</h2>
          <dl className="mt-5 divide-y divide-line border-y border-line">
            {[
              ["Is practice really free?", "Yes. No card, no trial period."],
              ["Is the camera recorded?", "No. It is relayed live and never stored."],
              ["Can we use our own papers?", "Yes — import them as PDF or Word."],
              ["Any installation?", "None. It all runs in the browser."],
            ].map(([q, a]) => (
              <div key={q} className="py-4">
                <dt className="text-[16px] font-medium text-ink">{q}</dt>
                <dd className="mt-1 text-[15px] text-ink-2">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </SitePage>
  );
}
