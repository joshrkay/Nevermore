import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComparedQuote, QuoteComparison as Comparison } from "@/lib/quoteComparisonApi";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { QuoteComparison } = await import("./QuoteComparison");

// The broker's comparison of an opportunity's quotes (N-3.1, slice 7.7, D-770 to D-779): one column for each PEO, one row for each cost area, the same rows for every
// PEO. The database decides which quote is current and what is left out; this holds how it is drawn.

const quote = (over: Partial<ComparedQuote> = {}): ComparedQuote => ({
  id: 1, kind: "firm_offer", receivedOn: "2026-11-10", expiresOn: "2099-12-10", proposedStartOn: "2027-01-01", adminFee: 40, adminFeeBasis: "per_employee_per_month",
  oneOffFees: null, workersComp: null, unemployment: null, medical: null, note: null, ...over,
});
const comparison = (over: Partial<Comparison> = {}): Comparison => ({
  canAdd: true,
  columns: [
    { quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote() },
    { quoteRequestId: 2, peoName: "TriNet", status: "sent", quote: null },
  ],
  notes: [],
  ...over,
});
/** The cells of one row of the table, by its row header. */
const cells = (row: string) => {
  const th = within(screen.getByRole("table", { name: "Quotes side by side" })).getByRole("rowheader", { name: row });
  return within(th.closest("tr") as HTMLElement).getAllByRole("cell");
};
const draw = (c: Comparison = comparison()) => render(<QuoteComparison comparison={c} onAddNote={vi.fn()} />);

describe("what a quote leaves out (D-721)", () => {
  // Catches: a cost area a quote leaves out drawn as blank, 0 or "$0.00", which reads as free; and a PEO that has not quoted drawn as an empty column.
  it("reads Not quoted for each left-out area, and for every area of a PEO with no quote yet", () => {
    draw();
    expect(cells("One-off fees").map((c) => c.textContent)).toEqual(["Not quoted", "Not quoted"]);
    expect(cells("Workers' comp").map((c) => c.textContent)).toEqual(["Not quoted", "Not quoted"]);
    expect(cells("Unemployment tax").map((c) => c.textContent)).toEqual(["Not quoted", "Not quoted"]);
    expect(cells("Medical").map((c) => c.textContent)).toEqual(["Not quoted", "Not quoted"]);
    expect(cells("Administrative fee")[1].textContent).toBe("Not quoted");
  });
});

describe("what each column is (D-722)", () => {
  // Catches: an estimate drawn as a firm offer (the broker compares a guess with a commitment), or a PEO that has not quoted drawn with no word on where it stands.
  it("labels a quote Estimate or Firm offer, and a PEO with no quote by its status", () => {
    draw(comparison({
      columns: [
        { quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ kind: "firm_offer" }) },
        { quoteRequestId: 2, peoName: "Justworks", status: "quoted", quote: quote({ id: 2, kind: "estimate" }) },
        { quoteRequestId: 3, peoName: "TriNet", status: "sent", quote: null },
      ],
    }));
    expect(cells("Status").map((c) => c.textContent)).toEqual(["Firm offer", "Estimate", "Sent"]);
  });
});

describe("when a quote expires", () => {
  // Catches: a lapsed quote compared as if it still stood (the broker recommends a price the PEO no longer honours), or a live one marked expired.
  it("marks an expired quote Expired with its date, shows a live one's date and says when none was given", () => {
    draw(comparison({
      columns: [
        { quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ expiresOn: "2020-01-15" }) },
        { quoteRequestId: 2, peoName: "Justworks", status: "quoted", quote: quote({ id: 2, expiresOn: "2099-12-10" }) },
        { quoteRequestId: 3, peoName: "Paychex", status: "quoted", quote: quote({ id: 3, expiresOn: null }) },
        { quoteRequestId: 4, peoName: "TriNet", status: "sent", quote: null },
      ],
    }));
    expect(cells("Expires").map((c) => c.textContent)).toEqual(["Expired Jan 15, 2020", "Dec 10, 2099", "Not given", "Not yet quoted"]);
  });
});

describe("the cost areas that are lists", () => {
  const lines = (row: string, column = 0) => within(cells(row)[column]).getAllByRole("listitem").map((l) => l.textContent);

  // Catches: several one-off fees run together into one figure, or a waived one (0) left out of the list.
  it("lists each one-off fee with its amount, a waived one as $0.00", () => {
    draw(comparison({ columns: [{ quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ oneOffFees: [{ name: "Setup", amount: 500 }, { name: "Onboarding", amount: 0 }] }) }] }));
    expect(lines("One-off fees")).toEqual(["Setup: $500.00", "Onboarding: $0.00"]);
  });

  // Catches: workers' comp rates shown without the state and class code they apply to, or without what the rate is a rate of.
  it("lists each workers' comp rate by state and class code, per $100 of payroll", () => {
    draw(comparison({ columns: [{ quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ workersComp: [{ state: "CA", classCode: "8810", rate: 0.42 }, { state: "TX", classCode: "5183", rate: 1.1 }] }) }] }));
    expect(lines("Workers' comp")).toEqual(["CA 8810: $0.42 per $100 of payroll", "TX 5183: $1.10 per $100 of payroll"]);
  });

  // Catches: the employer's own unemployment rate drawn as 0%, or the PEO's rate drawn without its percent.
  it("lists each state's unemployment tax as the employer's own rate or the PEO's rate with its percent", () => {
    draw(comparison({ columns: [{ quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ unemployment: [{ state: "CA", charge: "employer_rate" }, { state: "TX", charge: "peo_rate", rate: 2.7 }] }) }] }));
    expect(lines("Unemployment tax")).toEqual(["CA: the employer's own rate", "TX: the PEO's rate, 2.7% of taxable wages"]);
  });

  // Catches: a medical rate drawn without its plan or tier (a family rate read as an employee-only one), or per year instead of per month.
  it("lists each medical rate by plan and tier, a month for each employee", () => {
    draw(comparison({ columns: [{ quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ medical: [{ plan: "Gold PPO", tier: "employee_only", monthly: 612 }, { plan: "Gold PPO", tier: "family", monthly: 1704.5 }] }) }] }));
    expect(lines("Medical")).toEqual(["Gold PPO, employee only: $612.00 a month", "Gold PPO, family: $1,704.50 a month"]);
  });
});

describe("the administrative fee", () => {
  // Catches: a fee drawn with no basis ($40 a month and 4% of payroll look alike), or a percent drawn as dollars.
  it("says the amount with the basis it is charged on", () => {
    draw(comparison({
      columns: [
        { quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ adminFee: 40, adminFeeBasis: "per_employee_per_month" }) },
        { quoteRequestId: 2, peoName: "TriNet", status: "quoted", quote: quote({ id: 2, adminFee: 3.5, adminFeeBasis: "percent_of_payroll" }) },
      ],
    }));
    expect(cells("Administrative fee").map((c) => c.textContent)).toEqual(["$40.00 per employee per month", "3.5% of payroll"]);
  });

  // Catches: a waived fee (a real 0) drawn as Not quoted, or a blank.
  it("reads a waived fee as $0.00, not as Not quoted", () => {
    draw(comparison({ columns: [{ quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ adminFee: 0, adminFeeBasis: "per_employee_per_month" }) }] }));
    expect(cells("Administrative fee")[0].textContent).toBe("$0.00 per employee per month");
  });

  // Catches: a quote that leaves the fee out (null) drawn as a fee of 0.
  it("reads Not quoted when the quote leaves the fee out", () => {
    draw(comparison({ columns: [{ quoteRequestId: 1, peoName: "Insperity", status: "quoted", quote: quote({ adminFee: null, adminFeeBasis: null }) }] }));
    expect(cells("Administrative fee")[0].textContent).toBe("Not quoted");
  });
});

describe("the comparison's frame", () => {
  // Catches: PEOs in the order they were sent instead of the database's alphabetical order, or a row missing for one cost area so two PEOs are not compared on the same lines.
  it("has a column for each PEO in the order given and a row for each cost area", () => {
    draw();
    const table = screen.getByRole("table", { name: "Quotes side by side" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Cost area", "Insperity", "TriNet"]);
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Status", "Expires", "Administrative fee", "One-off fees", "Workers' comp", "Unemployment tax", "Medical",
    ]);
  });
});
