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

describe("public copy", () => {
  it.each(PUBLIC_COPY_FILES)("%s names no specific PEO", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(NAMED_PEOS);
  });

  it("never promises to act or send on the prospect's behalf", () => {
    for (const file of ["src/components/chamber/ReckoningTab.tsx", "supabase/functions/dispatch-outbox/messages.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(ON_BEHALF);
    }
  });
});
