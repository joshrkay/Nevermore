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
