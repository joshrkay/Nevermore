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

describe("RecordQuoteForm: a carrier's quote on a workers' comp search (ADR 0029)", () => {
  const carrier = { id: 9, peo_name: "Granite Ridge Mutual" } as never;

  // Catches: a carrier's quote asked for a PEO's figures (an administrative fee, unemployment, medical), which the database refuses on a workers' comp quote, and
  // given nowhere to put its premium; or the premium typed on screen and dropped before the save.
  it("asks for the premium, the experience modification, the minimum premium, the rates and the fees, nothing a PEO alone quotes, and saves them", async () => {
    const user = userEvent.setup();
    render(<RecordQuoteForm request={carrier} line="workers_comp" mailFiles={[]} onRecorded={() => {}} onCancel={() => {}} />);
    const form = screen.getByRole("form", { name: "Record the quote from Granite Ridge Mutual" });
    for (const gone of ["Admin fee", "Admin fee basis"]) expect(within(form).queryByLabelText(gone)).toBeNull();
    for (const gone of ["Unemployment tax", "Medical rates"]) expect(within(form).queryByRole("group", { name: gone })).toBeNull();
    expect(within(form).getByRole("group", { name: "Workers' comp rates" })).toBeInTheDocument();
    expect(within(form).getByRole("group", { name: "One-off fees" })).toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText("Estimate or firm offer"), "firm_offer");
    await user.type(within(form).getByLabelText("Annual premium"), "18450");
    await user.type(within(form).getByLabelText("Experience modification"), "0.92");
    await user.type(within(form).getByLabelText("Minimum premium"), "0");
    await user.click(within(form).getByRole("button", { name: "Save the quote" }));
    await waitFor(() => expect(advisor.recordQuote).toHaveBeenCalledTimes(1));
    const [id, offer] = advisor.recordQuote.mock.calls[0];
    expect(id).toBe(9);
    // A minimum premium of 0 is a figure the carrier gave, not a blank (D-721).
    expect(offer).toMatchObject({ kind: "firm_offer", annualPremium: 18450, experienceMod: 0.92, minimumPremium: 0 });
    expect(offer.adminFee ?? null).toBeNull();
    expect(offer.adminFeeBasis ?? null).toBeNull();
    expect(offer.unemployment ?? null).toBeNull();
    expect(offer.medical ?? null).toBeNull();
  });

  // Catches: a draft of a carrier's quote (the same seam a PEO's draft comes through) opening the form with its premium, modification or minimum blank, so the
  // agent retypes what the draft already held, or saves a quote that lost them.
  it("is filled from a draft's premium, experience modification and minimum premium, and saves them as given", async () => {
    render(<RecordQuoteForm request={carrier} line="workers_comp" mailFiles={[]} onRecorded={() => {}} onCancel={() => {}}
      initial={{ kind: "estimate", annualPremium: 18450, experienceMod: 0.92, minimumPremium: 0 }} />);
    const form = screen.getByRole("form", { name: "Record the quote from Granite Ridge Mutual" });
    expect(within(form).getByLabelText("Annual premium")).toHaveValue(18450);
    expect(within(form).getByLabelText("Experience modification")).toHaveValue(0.92);
    expect(within(form).getByLabelText("Minimum premium")).toHaveValue(0);
    await userEvent.click(within(form).getByRole("button", { name: "Save the quote" }));
    await waitFor(() => expect(advisor.recordQuote).toHaveBeenCalledTimes(1));
    expect(advisor.recordQuote.mock.calls[0][1]).toMatchObject({ kind: "estimate", annualPremium: 18450, experienceMod: 0.92, minimumPremium: 0 });
  });

  // Catches: a draft that holds a PEO's figures (a fee, unemployment, medical) saved from a carrier's form, which shows none of them: the agent would send what
  // they cannot see, and the database would refuse the whole quote.
  it("sends nothing a workers' comp quote does not hold, even from a draft that holds it", async () => {
    render(<RecordQuoteForm request={carrier} line="workers_comp" mailFiles={[]} onRecorded={() => {}} onCancel={() => {}} initial={{
      kind: "estimate", adminFee: 45, adminFeeBasis: "per_employee_per_month", annualPremium: 100,
      unemployment: [{ state: "OR", charge: "peo_rate", rate: 2.7 }], medical: [{ plan: "Gold PPO", tier: "family", monthly: 1200 }],
    }} />);
    const form = screen.getByRole("form", { name: "Record the quote from Granite Ridge Mutual" });
    await userEvent.click(within(form).getByRole("button", { name: "Save the quote" }));
    await waitFor(() => expect(advisor.recordQuote).toHaveBeenCalledTimes(1));
    const offer = advisor.recordQuote.mock.calls[0][1];
    expect(offer).toMatchObject({ kind: "estimate", annualPremium: 100, adminFee: null, adminFeeBasis: null, unemployment: null, medical: null });
  });
});

describe("RecordQuoteForm: a PEO's quote holds no workers' comp figure (ADR 0029)", () => {
  // Catches: a draft that holds a premium saved from a PEO's form, which shows no premium: the database refuses a premium on a PEO's quote.
  it("names no premium, experience modification or minimum premium, even from a draft that holds them", async () => {
    render(<RecordQuoteForm request={request} mailFiles={[]} onRecorded={() => {}} onCancel={() => {}}
      initial={{ kind: "estimate", adminFee: 45, adminFeeBasis: "per_employee_per_month", annualPremium: 18450, experienceMod: 0.92, minimumPremium: 1500 }} />);
    const form = screen.getByRole("form", { name: "Record the quote from TriNet" });
    await userEvent.click(within(form).getByRole("button", { name: "Save the quote" }));
    await waitFor(() => expect(advisor.recordQuote).toHaveBeenCalledTimes(1));
    const offer = advisor.recordQuote.mock.calls[0][1] as Record<string, unknown>;
    expect(offer).toMatchObject({ adminFee: 45 });
    for (const figure of ["annualPremium", "experienceMod", "minimumPremium"]) expect(offer[figure] ?? null).toBeNull();
  });
});
