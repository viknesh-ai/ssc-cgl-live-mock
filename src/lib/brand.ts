/**
 * Product identity, in one place.
 *
 * The platform is deliberately named for what it does — invigilated mock
 * examinations — not for any single exam, so further papers can be added
 * alongside SSC CGL without the name going stale. Change APP_NAME here and it
 * changes everywhere.
 */
export const APP_NAME = "Invigil";
export const APP_TAGLINE = "Invigilated mock examinations";

/** The papers on offer. More entries can be added as they are built. */
export const PAPERS = [
  {
    id: "ssc-cgl-tier-1",
    name: "SSC CGL Tier-I",
    summary: "Staff Selection Commission, Combined Graduate Level, Tier-I pattern.",
    sections: ["Reasoning", "General Awareness", "Quantitative Aptitude", "English"],
    questions: 100,
    minutes: 60,
    marks: 200,
    available: true,
  },
] as const;

export const DEFAULT_PAPER = PAPERS[0];
