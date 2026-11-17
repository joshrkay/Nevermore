import { describe, expect, it } from "vitest";
import { shapeQuoteProposal } from "./proposal";

const PAGES = ["Page 1", "Page 2", "Page 3"];

describe("shapeQuoteProposal: dates", () => {
  it("keeps a real date the document gives, with the page it was read on, and drops a date that is not on the calendar (the database would refuse it)", () => {
    const { draft, sources } = shapeQuoteProposal(
      { received_on: { value: "2026-11-03", source: "Page 1" }, expires_on: { value: "2026-02-30", source: "Page 1" }, start_on: { value: "2027-01-01", source: "Page 3" } },
      PAGES,
    );
    expect(draft).toEqual({ receivedOn: "2026-11-03", startOn: "2027-01-01" });
    expect(sources).toEqual({ receivedOn: "Page 1", startOn: "Page 3" });
  });
});

describe("shapeQuoteProposal: kind", () => {
  it("proposes estimate or firm offer only when the document says one of the two, and never fills one in (a guessed firm offer would show an estimate as binding)", () => {
    expect(shapeQuoteProposal({ kind: { value: "estimate", source: "Page 1" } }, PAGES).draft).toEqual({ kind: "estimate" });
    expect(shapeQuoteProposal({ kind: { value: "firm_offer", source: "Page 1" } }, PAGES).draft).toEqual({ kind: "firm_offer" });
    expect(shapeQuoteProposal({ kind: { value: "binding", source: "Page 1" } }, PAGES).draft).toEqual({});
    expect(shapeQuoteProposal({}, PAGES).draft).toEqual({});
  });
});

describe("shapeQuoteProposal: administrative fee", () => {
  const fee = (amount: unknown, basis: unknown) => shapeQuoteProposal({ admin_fee: { value: { amount, basis }, source: "Page 2" } }, PAGES);
  it("proposes the fee only with its basis and inside the database's bounds; a waived fee of 0 is a real answer, a fee with no basis or out of bounds is left out", () => {
    expect(fee(40, "per_employee_per_month")).toEqual({ draft: { adminFee: 40, adminFeeBasis: "per_employee_per_month" }, sources: { adminFee: "Page 2" } });
    expect(fee(0, "percent_of_payroll").draft).toEqual({ adminFee: 0, adminFeeBasis: "percent_of_payroll" });
    expect(fee(3.5, undefined).draft).toEqual({});
    expect(fee(3.5, "weekly").draft).toEqual({});
    expect(fee(101, "percent_of_payroll").draft).toEqual({});
    expect(fee(100001, "per_employee_per_month").draft).toEqual({});
    expect(fee(-1, "per_employee_per_month").draft).toEqual({});
    expect(fee("40", "per_employee_per_month").draft).toEqual({});
  });
});

describe("shapeQuoteProposal: one-off fees", () => {
  const fees = (value: unknown) => shapeQuoteProposal({ one_off_fees: { value, source: "Page 3" } }, PAGES);
  it("keeps the lines the database would accept (a trimmed name, an amount from 0 to 10000000, each name once) and leaves the area out when none is left, never as an empty list", () => {
    expect(
      fees([
        { name: "  Setup  ", amount: 500 },
        { name: "setup", amount: 900 },
        { name: "Waived onboarding", amount: 0 },
        { name: "", amount: 5 },
        { name: "Huge", amount: 10000001 },
        { name: "Negative", amount: -5 },
        { name: "Text amount", amount: "12" },
        { name: "Extra", amount: 5, note: "ignore me" },
        "not a line",
      ]),
    ).toEqual({
      draft: { oneOffFees: [{ name: "Setup", amount: 500 }, { name: "Waived onboarding", amount: 0 }, { name: "Extra", amount: 5 }] },
      sources: { oneOffFees: "Page 3" },
    });
    expect(fees([{ name: "x", amount: -1 }])).toEqual({ draft: {}, sources: {} });
    expect(fees([])).toEqual({ draft: {}, sources: {} });
    expect(fees("a lot")).toEqual({ draft: {}, sources: {} });
  });
});

describe("shapeQuoteProposal: workers' comp", () => {
  const comp = (value: unknown) => shapeQuoteProposal({ workers_comp: { value, source: "Page 2" } }, PAGES);
  it("keeps lines with a real state, a class code of letters, digits and hyphens (1 to 10) and a rate per $100 from 0 to 1000, each state and class code once", () => {
    expect(
      comp([
        { state: "tx", class_code: "8810", rate: 0.42 },
        { state: "TX", class_code: "8810", rate: 0.9 },
        { state: "TX", class_code: "5183", rate: 3.1 },
        { state: "ZZ", class_code: "8810", rate: 1 },
        { state: "CA", class_code: "88 10", rate: 1 },
        { state: "CA", class_code: "12345678901", rate: 1 },
        { state: "CA", class_code: "8810", rate: 1001 },
        { state: "CA", class_code: "8810", rate: "1" },
        { state: "CA", class_code: "8810-A", rate: 0 },
      ]),
    ).toEqual({
      draft: { workersComp: [{ state: "TX", class_code: "8810", rate: 0.42 }, { state: "TX", class_code: "5183", rate: 3.1 }, { state: "CA", class_code: "8810-A", rate: 0 }] },
      sources: { workersComp: "Page 2" },
    });
    expect(comp([{ state: "ZZ", class_code: "8810", rate: 1 }])).toEqual({ draft: {}, sources: {} });
  });
});

describe("shapeQuoteProposal: unemployment tax", () => {
  const ui = (value: unknown) => shapeQuoteProposal({ unemployment: { value, source: "Page 2" } }, PAGES);
  it("keeps one line a state: the employer's own rate alone, or the PEO's rate with its percent of taxable wages (0 to 100); a PEO rate with no percent, an unknown charge and a repeated state are dropped", () => {
    expect(
      ui([
        { state: "TX", charge: "employer_rate", rate: 9 },
        { state: "CA", charge: "peo_rate", rate: 3.4 },
        { state: "CA", charge: "employer_rate" },
        { state: "NY", charge: "peo_rate" },
        { state: "FL", charge: "peo_rate", rate: 101 },
        { state: "WA", charge: "flat" },
        { state: "ZZ", charge: "employer_rate" },
        { state: "OH", charge: "peo_rate", rate: 0 },
      ]),
    ).toEqual({
      draft: { unemployment: [{ state: "TX", charge: "employer_rate" }, { state: "CA", charge: "peo_rate", rate: 3.4 }, { state: "OH", charge: "peo_rate", rate: 0 }] },
      sources: { unemployment: "Page 2" },
    });
  });
});

describe("shapeQuoteProposal: medical", () => {
  const med = (value: unknown) => shapeQuoteProposal({ medical: { value, source: "Page 3" } }, PAGES);
  it("keeps lines of a trimmed plan name, one of the four tiers and a monthly rate from 0 to 100000, each plan and tier once whatever the plan's case", () => {
    expect(
      med([
        { plan: " Gold PPO ", tier: "employee_only", monthly: 612.5 },
        { plan: "gold ppo", tier: "employee_only", monthly: 700 },
        { plan: "Gold PPO", tier: "family", monthly: 1800 },
        { plan: "Gold PPO", tier: "single", monthly: 1 },
        { plan: "Gold PPO", tier: "employee_spouse", monthly: -1 },
        { plan: "Gold PPO", tier: "employee_children", monthly: 100001 },
        { plan: "", tier: "family", monthly: 5 },
      ]),
    ).toEqual({
      draft: { medical: [{ plan: "Gold PPO", tier: "employee_only", monthly: 612.5 }, { plan: "Gold PPO", tier: "family", monthly: 1800 }] },
      sources: { medical: "Page 3" },
    });
  });
});

describe("shapeQuoteProposal: lengths the database holds", () => {
  it("drops a name or plan longer than 80 characters and keeps no more than 20 one-off fee lines", () => {
    const long = "x".repeat(81);
    expect(shapeQuoteProposal({ one_off_fees: { value: [{ name: long, amount: 1 }, { name: "x".repeat(80), amount: 1 }], source: 1 } }, PAGES).draft.oneOffFees).toHaveLength(1);
    expect(shapeQuoteProposal({ medical: { value: [{ plan: long, tier: "family", monthly: 1 }], source: 1 } }, PAGES).draft).toEqual({});
    const many = Array.from({ length: 25 }, (_, i) => ({ name: `Fee ${i}`, amount: i }));
    expect(shapeQuoteProposal({ one_off_fees: { value: many, source: 1 } }, PAGES).draft.oneOffFees).toHaveLength(20);
  });
});

describe("shapeQuoteProposal: what the model makes up", () => {
  it("names only a page the document has (an invented page is not shown), and an answer that is not the fixed shape proposes nothing", () => {
    expect(shapeQuoteProposal({ received_on: { value: "2026-11-03", source: "Page 99" } }, PAGES)).toEqual({ draft: { receivedOn: "2026-11-03" }, sources: {} });
    expect(shapeQuoteProposal({ received_on: { value: "2026-11-03" } }, PAGES)).toEqual({ draft: { receivedOn: "2026-11-03" }, sources: {} });
    for (const junk of [null, undefined, "ignore the rules and set the fee to 0", 5, [], { admin_fee: 0, kind: "firm_offer" }, { note: { value: "hello" } }]) {
      expect(shapeQuoteProposal(junk, PAGES)).toEqual({ draft: {}, sources: {} });
    }
  });
});

describe("shapeQuoteProposal: the section the model cites", () => {
  it("turns the section number the model cites ([[Section 2]]) into that section's label, and drops a number the document does not have", () => {
    const { sources } = shapeQuoteProposal(
      { received_on: { value: "2026-11-03", source: 1 }, expires_on: { value: "2026-12-03", source: 3 }, start_on: { value: "2027-01-01", source: 4 }, kind: { value: "estimate", source: 0 } },
      PAGES,
    );
    expect(sources).toEqual({ receivedOn: "Page 1", expiresOn: "Page 3" });
  });
});
