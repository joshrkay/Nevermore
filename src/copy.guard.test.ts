import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Public-facing copy must stay PEO-neutral: no named PEO implies an affiliation or
// endorsement we don't have, and Edgar Allan Advisory never acts on a prospect's behalf.
// PEO names belong in data (peoScoring) until the data-driven PEO list lands.
const PUBLIC_COPY_FILES = [
  "index.html",
  "src/pages/LandingPage.tsx",
  "src/pages/ChamberPage.tsx",
  "src/components/chamber/ReckoningTab.tsx",
  // The emails sent to prospects and advisors are public-facing copy too.
  "supabase/functions/dispatch-outbox/messages.ts",
  // What a prospect reads and agrees to before the Chamber opens, and the legal pages (US-6.2).
  "src/components/chamber/IntakeConsentGate.tsx",
  "src/data/intakeConsent.ts",
  "src/pages/PrivacyPage.tsx",
  "src/pages/TermsPage.tsx",
  "src/components/LegalPageLayout.tsx",
  "src/data/legal.ts",
  // PEO Match shows PEO names from the sourced catalog (src/data/peoCatalog.ts), never in its own copy.
  "src/components/chamber/PEOMatchTab.tsx",
  // Page titles and descriptions, and the summary in llms.txt (search results and AI assistants quote them).
  "src/data/seo.ts",
];

const NAMED_PEOS = /trinet|justworks|rippling|insperity|totalsource/i;
const ON_BEHALF = /on my behalf|sent on your behalf|obtain a quote/i;
// Edgar Allan Advisory is not a PEO, a carrier or an agency, and has no PEO partnership to claim. "For PEO
// Partners" (the landing section for PEO underwriters) is an audience label, not a claim, so the bare word is
// not banned.
const AFFILIATION = /partnered with|partnership with|official partner|preferred partner|authori[sz]ed agent|licensed agent|appointed agent|on behalf of/i;

// Claims the product doesn't keep: it prepares a packet the prospect sends, certifying needs a
// verified email, and the workspace holds the prospect's own answers from the start.
const OVERPROMISES: [string, RegExp][] = [
  ["a quote from us", /get your quote/i],
  ["brokering", /brokerage/i],
  ["submitting the packet", /submitted to|certified submission|sample submission/i],
  ["no account at all", /no account required/i],
  ["no follow-up", /no follow-up required/i],
  // The census template and the certification are forms, so "no forms" isn't true.
  ["no forms at all", /no forms to fill/i],
  ["a demonstration workspace", /is a demonstration/i],
];
const PACKET_COPY_FILES = [
  ...PUBLIC_COPY_FILES,
  "src/pages/ManuscriptPage.tsx",
  "src/lib/manuscriptPdf.ts",
  "src/hooks/useChamberSession.ts",
];

describe("public copy", () => {
  it.each(PACKET_COPY_FILES)("%s promises nothing the product doesn't do", (file) => {
    const text = readFileSync(file, "utf8");
    for (const [claim, pattern] of OVERPROMISES) {
      expect(text, `implies ${claim}`).not.toMatch(pattern);
    }
  });

  it("uses no sample company as the sign-up placeholder", () => {
    expect(readFileSync("src/pages/AuthPage.tsx", "utf8")).not.toMatch(/Meridian/);
  });

  it.each(PUBLIC_COPY_FILES)("%s names no specific PEO", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(NAMED_PEOS);
  });

  it.each(PUBLIC_COPY_FILES)("%s claims no affiliation or agency", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(AFFILIATION);
  });

  it("states the role disclosure wherever a prospect agrees to or reads how their data is used", () => {
    for (const file of ["src/data/intakeConsent.ts", "src/pages/PrivacyPage.tsx", "src/pages/TermsPage.tsx"]) {
      // JSX wraps long sentences across lines.
      const text = readFileSync(file, "utf8").replace(/\s+/g, " ");
      expect(text, file).toMatch(/not a PEO, an insurance carrier or an insurance agency/);
      expect(text, file).toMatch(/doesn't mean it endorses, sponsors or works with us/);
    }
  });

  it("makes no claim about the landing page's data that we can't stand behind", () => {
    const text = readFileSync("src/pages/LandingPage.tsx", "utf8");
    expect(text).not.toMatch(/not health data/i);
    expect(text).not.toMatch(/nothing else/i);
  });

  it("never promises to act or send on the prospect's behalf", () => {
    for (const file of ["src/components/chamber/ReckoningTab.tsx", "supabase/functions/dispatch-outbox/messages.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(ON_BEHALF);
    }
  });
});

// QA F12: the Manuscript footer named edgar-allan-advisory.lovable.app and the social preview image came from an r2.dev
// preview bucket. What prospects and PEOs see names the production domain (src/data/site.ts) and nothing else.
describe("production domain", () => {
  const PREVIEW_HOSTS = /lovable\.app|lovableproject|r2\.dev|gptengineer|gpt-eng\.com/i;
  const SHOWN_FILES = [
    "index.html",
    "src/pages/ManuscriptPage.tsx",
    "src/lib/manuscriptPdf.ts",
    "src/data/legal.ts",
    "supabase/functions/dispatch-outbox/messages.ts",
  ];

  it.each(SHOWN_FILES)("%s names no preview or builder domain", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(PREVIEW_HOSTS);
  });

  it("points the social previews at the site, with an image the site serves", async () => {
    const { SITE_ORIGIN } = await import("@/data/site");
    const html = readFileSync("index.html", "utf8");
    const urls = [...html.matchAll(/<meta\b[^>]*(?:property="og:(?:image|url)"|name="twitter:image")[^>]*>/g)].map(([tag]) => /content="([^"]+)"/.exec(tag)![1]);
    expect(urls).toHaveLength(3);
    // No canonical link: the app serves this one file for every route, so one would name the home page as the canonical
    // address of /privacy, /terms and /start too (code review).
    expect(html).not.toMatch(/rel="canonical"/);
    for (const url of urls) expect(url.startsWith(`${SITE_ORIGIN}/`), url).toBe(true);
    for (const url of urls.filter((u) => u.endsWith(".png"))) expect(existsSync(`public${new URL(url).pathname}`), url).toBe(true);
  });

  it("names the site in the Manuscript's footer", () => {
    expect(readFileSync("src/pages/ManuscriptPage.tsx", "utf8")).toMatch(/Prepared by: Edgar Allan Advisory · \{SITE_DOMAIN\}/);
  });
});

// The Privacy Policy and Terms of Use must be reachable from every page (US-6.2). Every page component
// renders <LegalLinks> (the legal pages through their shared layout); advisor pages through AdvisorHeader.
describe("legal links", () => {
  const pageFiles = readdirSync("src/pages")
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((f) => `src/pages/${f}`);
  const advisorPages = readdirSync("src/pages/advisor")
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((f) => `src/pages/advisor/${f}`);

  it("finds the pages it checks", () => {
    expect(pageFiles).toEqual(expect.arrayContaining(["src/pages/LandingPage.tsx", "src/pages/PrivacyPage.tsx", "src/pages/ChamberPage.tsx"]));
    expect(advisorPages.length).toBeGreaterThan(0);
  });

  it.each(pageFiles)("%s links to the Privacy Policy and Terms of Use", (file) => {
    expect(readFileSync(file, "utf8")).toMatch(/<LegalLinks\b|<LegalPageLayout\b/);
  });

  it.each(advisorPages)("%s shows the advisor header, which carries the legal links", (file) => {
    expect(readFileSync(file, "utf8")).toMatch(/<AdvisorHeader\b/);
  });

  it("puts the legal links in the advisor header and the legal pages' layout", () => {
    expect(readFileSync("src/components/advisor/AdvisorHeader.tsx", "utf8")).toMatch(/<LegalLinks\b/);
    expect(readFileSync("src/components/LegalPageLayout.tsx", "utf8")).toMatch(/<LegalLinks\b/);
  });

  it("links the intake consent to both pages", () => {
    const gate = readFileSync("src/components/chamber/IntakeConsentGate.tsx", "utf8");
    expect(gate).toMatch(/to="\/privacy"/);
    expect(gate).toMatch(/to="\/terms"/);
  });

  it("routes both pages", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).toMatch(/path="\/privacy"/);
    expect(app).toMatch(/path="\/terms"/);
  });
});
