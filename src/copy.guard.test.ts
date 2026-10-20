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
];

const NAMED_PEOS = /trinet|justworks|rippling|insperity|totalsource/i;
const ON_BEHALF = /on my behalf|sent on your behalf|obtain a quote/i;

describe("public copy", () => {
  it.each(PUBLIC_COPY_FILES)("%s names no specific PEO", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(NAMED_PEOS);
  });

  it("never promises to act or send on the prospect's behalf", () => {
    const reckoning = readFileSync("src/components/chamber/ReckoningTab.tsx", "utf8");
    expect(reckoning).not.toMatch(ON_BEHALF);
  });
});
