import { describe, expect, it } from "vitest";
import { expectedCommissionYearly, lostReasonWords, outcomeBannerWords, renewalAfter, quoteCloseWords } from "./opportunityClose";

// The pure rules of closing an opportunity (CRM-O1.3b): the commission the dialog works out (D-466), the default renewal (D-465), the banner's words (D-472).

describe("expectedCommissionYearly (D-466)", () => {
  // Catches: a share worked as a fraction of the wrong base: (percent / 100) x admin fee x employees x 12, rounded to the cent half up.
  it("works a share out from the admin fee, the employees and twelve months", () => {
    expect(expectedCommissionYearly({ basis: "share", rate: 20, adminFeePepm: 118, employees: 45 })).toBe(12744);
    expect(expectedCommissionYearly({ basis: "share", rate: 12.5, adminFeePepm: 99.99, employees: 7 })).toBe(1049.9);
  });
  // Catches: dollars per employee left as the monthly figure, not a year's.
  it("works per employee out from the employees and twelve months, and flat as it is", () => {
    expect(expectedCommissionYearly({ basis: "per_employee", rate: 10, adminFeePepm: 118, employees: 45 })).toBe(5400);
    expect(expectedCommissionYearly({ basis: "flat", rate: 7650, adminFeePepm: null, employees: null })).toBe(7650);
  });
  // Catches: a figure made up from a number the opportunity does not have (employees, or the quote's admin fee).
  it("works nothing out when what it needs is missing", () => {
    expect(expectedCommissionYearly({ basis: "share", rate: 20, adminFeePepm: null, employees: 45 })).toBeNull();
    expect(expectedCommissionYearly({ basis: "per_employee", rate: 10, adminFeePepm: 100, employees: null })).toBeNull();
    expect(expectedCommissionYearly({ basis: "", rate: 10, adminFeePepm: 100, employees: 4 })).toBeNull();
  });
  // Catches: floating-point drift turning a half cent down (1.005 is kept as 1.01 here, half up).
  it("rounds half up to the cent", () => {
    expect(expectedCommissionYearly({ basis: "share", rate: 1, adminFeePepm: 8.375, employees: 1 })).toBe(1.01);
  });
});

describe("renewalAfter (D-465)", () => {
  // Catches: a renewal that is not a year after the start (and a 29 February start that has no next year).
  it("is a year after the start", () => {
    expect(renewalAfter("2027-01-01")).toBe("2028-01-01");
    expect(renewalAfter("2028-02-29")).toBe("2029-03-01");
    expect(renewalAfter("nonsense")).toBe("");
  });
});

describe("the banner's words (D-472)", () => {
  // Catches: a won banner that leaves out the PEO, the start or the renewal.
  it("words a win with the PEO, the start and the renewal", () => {
    expect(outcomeBannerWords({ stage: "won", peoName: "PEO B", startDate: "2027-01-01", renewsOn: "2028-01-01", lostReason: null, lostNote: null }))
      .toBe("Won · PEO B · from Jan 1, 2027 · renews Jan 1, 2028");
  });
  // Catches: a lost banner that shows the stored code ("went_direct") instead of the reason in words, or drops the note on Other.
  it("words a loss with its reason, and the note when there is one", () => {
    expect(outcomeBannerWords({ stage: "lost", peoName: null, startDate: null, renewsOn: null, lostReason: "went_direct", lostNote: null })).toBe("Lost · Went direct to a PEO");
    expect(outcomeBannerWords({ stage: "lost", peoName: null, startDate: null, renewsOn: null, lostReason: "other", lostNote: "Closed the practice" })).toBe("Lost · Other: Closed the practice");
    expect(lostReasonWords("stayed_with_current_provider")).toBe("Stayed with current provider");
  });
  // Catches: a closed quote that says nothing of why, or says a code.
  it("words a closed quote's reason", () => {
    expect(quoteCloseWords("went_elsewhere")).toBe("The employer went elsewhere");
    expect(quoteCloseWords("search_ended")).toBe("The search ended");
    expect(quoteCloseWords(null)).toBeNull();
  });
});
