import { readFileSync } from "node:fs";
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
];

const NAMED_PEOS = /trinet|justworks|rippling|insperity|totalsource/i;
const ON_BEHALF = /on my behalf|sent on your behalf|obtain a quote/i;

// Claims the product doesn't keep: it prepares a packet the prospect sends, certifying needs a
// verified email, and the workspace holds the prospect's own answers from the start.
const OVERPROMISES: [string, RegExp][] = [
  ["a quote from us", /get your quote/i],
  ["brokering", /brokerage/i],
  ["submitting the packet", /submitted to|certified submission|sample submission/i],
  ["no account at all", /no account required/i],
  ["no follow-up", /no follow-up required/i],
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

  it("never promises to act or send on the prospect's behalf", () => {
    for (const file of ["src/components/chamber/ReckoningTab.tsx", "supabase/functions/dispatch-outbox/messages.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(ON_BEHALF);
    }
  });
});
