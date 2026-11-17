import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { ComparedQuote, NewComparisonNote, QuoteComparison as Comparison } from "@/lib/quoteComparisonApi";

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
const draw = (c: Comparison = comparison(), onAddNote: (n: NewComparisonNote) => Promise<void> = vi.fn().mockResolvedValue(undefined)) =>
  render(<QuoteComparison comparison={c} onAddNote={onAddNote} />);

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

describe("the broker's notes (N-3.2)", () => {
  const note = (over: Record<string, unknown> = {}) => ({ id: 1, quoteRequestId: 1, area: "admin_fee", visibility: "internal", body: "Waived the first year", author: "dana@acme.example", createdAt: "2026-11-11T10:00:00+00:00", ...over });

  // Catches: a note that does not say whom it is about or who may read it: an internal remark that could be taken for one for the client.
  it("lists each note with its words, who wrote it, what it is about and whether it is internal or for the client", () => {
    draw(comparison({ notes: [note(), note({ id: 2, quoteRequestId: null, area: null, visibility: "client", body: "Insperity is our pick", author: null })] }));
    const list = within(screen.getByRole("region", { name: "Notes" })).getAllByRole("listitem");
    expect(list[0]).toHaveTextContent("Waived the first year");
    expect(list[0]).toHaveTextContent("Internal");
    expect(list[0]).toHaveTextContent("Insperity, administrative fee");
    expect(list[0]).toHaveTextContent("dana@acme.example");
    expect(list[1]).toHaveTextContent("For the client");
    expect(list[1]).toHaveTextContent("The comparison");
    expect(list[1]).not.toHaveTextContent("Internal");
  });
});

describe("adding a note", () => {
  // Catches: a note saved for the client without the broker choosing that (the safe default is internal), or sent with a target nobody picked.
  it("sends the words as an internal note about the whole comparison unless told otherwise", async () => {
    const onAddNote = vi.fn().mockResolvedValue(undefined);
    draw(comparison(), onAddNote);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Note"), "  Ask about the first-year waiver  ");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(onAddNote).toHaveBeenCalledWith({ quoteRequestId: null, area: null, visibility: "internal", body: "Ask about the first-year waiver" });
  });
});

describe("an opportunity sent to no PEO", () => {
  // Catches: an empty table (headings and no columns) where the broker needs to be told why there is nothing to compare.
  it("says there is nothing to compare yet instead of drawing a table", () => {
    draw(comparison({ columns: [] }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No quotes to compare yet. Quotes appear here once the opportunity is sent to a PEO.")).toBeInTheDocument();
  });
});

describe("an account that takes no notes", () => {
  // Catches: an Add note form offered on an archived account that the database would refuse (D-432), so the broker types a note and loses it.
  it("shows the notes but no form, and says why", () => {
    draw(comparison({ canAdd: false, notes: [{ id: 1, quoteRequestId: null, area: null, visibility: "internal", body: "Kept", author: null, createdAt: "2026-11-11T10:00:00+00:00" }] }));
    expect(screen.queryByRole("button", { name: "Add note" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Note")).not.toBeInTheDocument();
    expect(screen.getByText("Kept")).toBeInTheDocument();
    expect(screen.getByText("This account is archived, so notes can't be added.")).toBeInTheDocument();
  });
});

describe("a note the database refuses", () => {
  // Catches: a refused note (a closing firm, an archived account) lost without a word, with the broker's text gone or an unhandled error in the console.
  it("says why and keeps the words", async () => {
    draw(comparison(), vi.fn().mockRejectedValue(new Error("This account is archived. Nothing on its opportunities can be changed.")));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Note"), "Waived the first year");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This account is archived. Nothing on its opportunities can be changed.");
    expect(screen.getByLabelText("Note")).toHaveValue("Waived the first year");
    expect(screen.getByRole("button", { name: "Add note" })).toBeEnabled();
  });
});

describe("after a note is sent", () => {
  // Catches: the words left in the box after a save (a second click adds the same note twice).
  it("empties the box once the note is saved", async () => {
    draw();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Note"), "Waived the first year");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(screen.getByLabelText("Note")).toHaveValue(""));
  });
});

describe("a note with nothing in it", () => {
  // Catches: a blank note sent to the database (an empty line on the client's page) or a button that looks live with nothing to add.
  it("can't be added until it has words", async () => {
    const onAddNote = vi.fn().mockResolvedValue(undefined);
    draw(comparison(), onAddNote);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled();
    await user.type(screen.getByLabelText("Note"), "   ");
    expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled();
    await user.type(screen.getByLabelText("Note"), "x");
    expect(screen.getByRole("button", { name: "Add note" })).toBeEnabled();
    expect(onAddNote).not.toHaveBeenCalled();
  });
});

describe("choosing what a note is about and who may read it", () => {
  // Catches: the PEO, the cost area or the mark chosen on the form dropped on the way to the writer, so every note lands on the whole comparison as internal.
  it("sends the PEO, the cost area and the mark the broker chose", async () => {
    const onAddNote = vi.fn().mockResolvedValue(undefined);
    draw(comparison(), onAddNote);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("About"), "Insperity");
    await user.selectOptions(screen.getByLabelText("Cost area"), "Administrative fee");
    await user.click(screen.getByLabelText("For the client"));
    await user.type(screen.getByLabelText("Note"), "Waived the first year");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(onAddNote).toHaveBeenCalledWith({ quoteRequestId: 1, area: "admin_fee", visibility: "client", body: "Waived the first year" });
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
