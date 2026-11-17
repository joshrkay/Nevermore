import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Record a quote form on its own (CRM-Q3.3, slice 7.8). The page's behaviour (who sees it, what it reads again) is tested in QuotePage.test.tsx.

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const advisor = { recordQuote: vi.fn(), attachQuoteDocument: vi.fn(), uploadQuoteDocument: vi.fn() };
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), ...advisor }));

const { RecordQuoteForm } = await import("./RecordQuoteForm");

const request = { id: 7, peo_name: "TriNet" } as never;

beforeEach(() => {
  for (const f of Object.values(advisor)) f.mockReset();
  advisor.recordQuote.mockResolvedValue({ id: 3 });
});
afterEach(cleanup);

describe("RecordQuoteForm: a draft to start from", () => {
  // Catches: a proposed draft (slice 7.6, in recordQuote's own input shape) that does not fill the form, or one that is saved before the agent saves: nothing is recorded until Save.
  it("is filled from a draft in recordQuote's shape, and records nothing until the agent saves", async () => {
    render(<RecordQuoteForm request={request} mailFiles={[]} onRecorded={() => {}} onCancel={() => {}} initial={{
      kind: "estimate", receivedOn: "2026-11-10", expiresOn: "2026-12-05", startOn: "2027-01-01", adminFee: 3.5, adminFeeBasis: "percent_of_payroll",
      oneOffFees: [{ name: "Setup", amount: 500 }], workersComp: [{ state: "OR", class_code: "8810", rate: 0.45 }],
      unemployment: [{ state: "OR", charge: "peo_rate", rate: 2.7 }], medical: [{ plan: "Gold PPO", tier: "family", monthly: 1200 }], note: "From the PDF",
    }} />);
    const form = screen.getByRole("form", { name: "Record the quote from TriNet" });
    expect(within(form).getByLabelText("Estimate or firm offer")).toHaveValue("estimate");
    expect(within(form).getByLabelText("Admin fee")).toHaveValue(3.5);
    expect(within(form).getByLabelText("Expires on")).toHaveValue("2026-12-05");
    expect(within(form).getByLabelText("One-off fee 1 name")).toHaveValue("Setup");
    expect(within(form).getByLabelText("Unemployment line 1 percent of taxable wages")).toHaveValue(2.7);
    expect(advisor.recordQuote).not.toHaveBeenCalled();
    await userEvent.click(within(form).getByRole("button", { name: "Save the quote" }));
    await waitFor(() => expect(advisor.recordQuote).toHaveBeenCalledTimes(1));
    expect(advisor.recordQuote).toHaveBeenCalledWith(7, {
      kind: "estimate", receivedOn: "2026-11-10", expiresOn: "2026-12-05", startOn: "2027-01-01", adminFee: 3.5, adminFeeBasis: "percent_of_payroll",
      oneOffFees: [{ name: "Setup", amount: 500 }], workersComp: [{ state: "OR", class_code: "8810", rate: 0.45 }],
      unemployment: [{ state: "OR", charge: "peo_rate", rate: 2.7 }], medical: [{ plan: "Gold PPO", tier: "family", monthly: 1200 }], note: "From the PDF",
    });
  });
});

describe("RecordQuoteForm: figures read from the document (slice 7.9, D-790)", () => {
  // Catches: a figure filled from a reading that is not marked as a suggestion with the page it came from, so the broker cannot tell what to check.
  it("marks each figure that came from the document Suggested, with its page", () => {
    render(<RecordQuoteForm request={request} mailFiles={[]} onRecorded={() => {}} onCancel={() => {}} initial={{ adminFee: 3.5 }} sources={{ adminFee: "Page 2" }} />);
    expect(screen.getByLabelText("Admin fee")).toHaveAccessibleDescription("Suggested, from Page 2");
  });

  // Catches: a list of figures (one-off fees) read from the document with no Suggested mark or page, while the single figures have one.
  it("marks a list of lines read from the document Suggested, with its page", () => {
    render(<RecordQuoteForm request={request} mailFiles={[]} onRecorded={() => {}} onCancel={() => {}} initial={{ oneOffFees: [{ name: "Setup", amount: 500 }] }} sources={{ oneOffFees: "Page 3" }} />);
    expect(screen.getByRole("group", { name: "One-off fees" })).toHaveAccessibleDescription("Suggested, from Page 3");
  });

  // Catches: kind and the three dates filled from the document without the Suggested mark and page.
  it("marks kind and the dates read from the document Suggested, with their pages", () => {
    render(<RecordQuoteForm request={request} mailFiles={[]} onRecorded={() => {}} onCancel={() => {}} initial={{ kind: "firm_offer", receivedOn: "2026-11-10", expiresOn: "2026-12-05", startOn: "2027-01-01" }}
      sources={{ kind: "Page 1", receivedOn: "Page 1", expiresOn: "Page 4", startOn: "Page 5" }} />);
    expect(screen.getByLabelText("Estimate or firm offer")).toHaveAccessibleDescription("Suggested, from Page 1");
    expect(screen.getByLabelText("Received on")).toHaveAccessibleDescription("Suggested, from Page 1");
    expect(screen.getByLabelText("Expires on")).toHaveAccessibleDescription("Suggested, from Page 4");
    expect(screen.getByLabelText("Proposed start")).toHaveAccessibleDescription("Suggested, from Page 5");
  });
});

describe("RecordQuoteForm: the rest of the marks (slice 7.9, D-790)", () => {
  // Catches: a cost area wired to the wrong figure's page, or one with no mark, and a figure the document did not state wearing a mark anyway.
  it("marks workers' comp, unemployment and medical each with its own page, and nothing the document did not state", () => {
    render(<RecordQuoteForm request={request} mailFiles={[]} onRecorded={() => {}} onCancel={() => {}}
      initial={{ workersComp: [{ state: "OR", class_code: "8810", rate: 0.45 }], unemployment: [{ state: "OR", charge: "employer_rate" }], medical: [{ plan: "Gold", tier: "family", monthly: 1200 }] }}
      sources={{ workersComp: "Page 6", unemployment: "Page 7", medical: "Page 8", oneOffFees: "Page 9" }} />);
    expect(screen.getByRole("group", { name: "Workers' comp rates" })).toHaveAccessibleDescription("Suggested, from Page 6");
    expect(screen.getByRole("group", { name: "Unemployment tax" })).toHaveAccessibleDescription("Suggested, from Page 7");
    expect(screen.getByRole("group", { name: "Medical rates" })).toHaveAccessibleDescription("Suggested, from Page 8");
    expect(screen.getByRole("group", { name: "One-off fees" })).not.toHaveAccessibleDescription();
    expect(screen.getByLabelText("Admin fee")).not.toHaveAccessibleDescription();
    expect(screen.getByLabelText("Estimate or firm offer")).toHaveValue("");
  });

  // Catches: a figure read with no page (the reader gave none) shown with a dangling "from".
  it("says only Suggested when the reader gave no page", () => {
    render(<RecordQuoteForm request={request} mailFiles={[]} onRecorded={() => {}} onCancel={() => {}} initial={{ adminFee: 3 }} sources={{}} />);
    expect(screen.getByLabelText("Admin fee")).toHaveAccessibleDescription("Suggested");
  });
});
