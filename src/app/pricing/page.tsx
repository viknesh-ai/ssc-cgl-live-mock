import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/components/site/site-chrome";
import { Badge, Button, Panel } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Pricing",
  description: "What Invigil costs for candidates, and for institutions running supervised sittings.",
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
    summary: "For a candidate working through papers on their own.",
    features: [
      "Unlimited practice papers",
      "Section-wise scoring and accuracy",
      "AI explanation on any question",
      "Full attempt history",
    ],
    cta: { label: "Start a paper", href: "/exams" },
    highlight: false,
  },
  {
    name: "Supervised",
    price: "₹149",
    cadence: "per candidate, per sitting",
    summary: "For a proctored mock where the result has to mean something.",
    features: [
      "Everything in Practice",
      "Live camera and microphone invigilation",
      "Examiner marks answers as they are given",
      "Exit and tab-switch flags on the report",
      "Message thread with the examiner",
    ],
    cta: { label: "Talk to us", href: "mailto:hello@invigil.app?subject=Supervised%20sittings" },
    highlight: true,
  },
  {
    name: "Institution",
    price: "Custom",
    cadence: "",
    summary: "For coaching centres running batches every week.",
    features: [
      "Unlimited sittings and examiners",
      "Your own question bank, imported from your papers",
      "Custom exams, sections and marking schemes",
      "Batch results and exports",
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
          <h1 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Free to practise. Paid when someone has to watch.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Practising on {APP_NAME} costs nothing — the paper, the marking and the AI review are
            all included. You pay only when a sitting has to be invigilated.
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
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{plan.summary}</p>

                <ul className="mt-5 flex-1 space-y-2 border-t border-line pt-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-[13.5px] text-ink-2">
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
          <h2 className="font-display text-2xl tracking-tight text-ink">For institutions</h2>
          <div className="mt-5 grid gap-8 md:grid-cols-3">
            {[
              [
                "Your papers, your bank",
                "Send us the question papers you already use as PDF or Word and they are imported into your own bank — with the explanations you wrote.",
              ],
              [
                "Any exam shape",
                "Sections, timings and marking are configured per exam, so a banking mock and a UPSC mock behave differently, as they should.",
              ],
              [
                "Nothing to install",
                "Candidates need a browser and a camera. Examiners watch from the same screen they set the paper on.",
              ],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-line pt-10">
          <h2 className="font-display text-2xl tracking-tight text-ink">Questions people ask</h2>
          <dl className="mt-5 divide-y divide-line border-y border-line">
            {[
              [
                "Is the practice tier really free?",
                "Yes. Papers, marking and AI explanations are included with no card and no trial period.",
              ],
              [
                "Is anything recorded during a supervised sitting?",
                "No. Camera and microphone are relayed live to the examiner and never written to disk.",
              ],
              [
                "Can we use our own question papers?",
                "That is the usual case. Papers are imported from PDF or Word into your own bank, and stay yours.",
              ],
              [
                "Do candidates need to install anything?",
                "No. Everything runs in a normal browser, including the camera.",
              ],
            ].map(([q, a]) => (
              <div key={q} className="py-4">
                <dt className="text-[14px] font-medium text-ink">{q}</dt>
                <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </SitePage>
  );
}
