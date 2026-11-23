import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { getQuoteComparison, addComparisonNote } = await import("./quoteComparisonApi");
const { OpportunityError } = await import("./opportunityPageApi");

// What the comparison of an opportunity's quotes asks the database (N-3.1, N-3.2, slice 7.7: opportunity_quote_comparison, add_comparison_note). The database decides
// who may see it and what a note must hold; these tests hold that the answer is read in the screen's words and that each refusal is said as the screen needs it.

const quote = {
  id: 7, kind: "firm_offer", received_on: "2026-11-10", expires_on: "2026-12-10", proposed_start_on: "2027-01-01", admin_fee: 40, admin_fee_basis: "per_employee_per_month",
  one_off_fees: [{ name: "Setup", amount: 500 }], workers_comp: [{ state: "CA", class_code: "8810", rate: 0.42 }], unemployment: [{ state: "CA", charge: "employer_rate" }],
  medical: null, note: "By phone",
};
const answer = {
  can_add: true,
  columns: [
    { quote_request_id: 1, peo_name: "Insperity", status: "quoted", quote },
    { quote_request_id: 2, peo_name: "TriNet", status: "sent", quote: null },
  ],
  notes: [{ id: 3, quote_request_id: 1, area: "admin_fee", visibility: "internal", body: "Waived the first year", author: "dana@acme.example", created_at: "2026-11-11T10:00:00+00:00" }],
};

beforeEach(() => rpc.mockReset());

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

describe("getQuoteComparison (one read: opportunity_quote_comparison)", () => {
  // Catches: the comparison read from several tables, or asked of no firm, so another firm's address could be mixed in.
  it("asks the database's one read with the firm and the opportunity", async () => {
    rpc.mockResolvedValue({ data: answer, error: null });
    await getQuoteComparison("f1", "o1");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("opportunity_quote_comparison", { p_firm_id: "f1", p_opportunity_id: "o1" });
  });

  // Catches: a workers' comp comparison read as a PEO's (its line lost), a carrier's premium lost or its 0 minimum read as left out, or a note about the premium
  // failing the whole read because only a PEO's areas were known.
  it("reads the comparison's line, each quote's workers' comp figures (0 as 0) and a note about one of the line's areas", async () => {
    rpc.mockResolvedValue({
      data: {
        line: "workers_comp", can_add: true,
        columns: [{ quote_request_id: 5, peo_name: "Granite Ridge Mutual", status: "quoted", quote: {
          id: 9, kind: "firm_offer", received_on: null, expires_on: null, proposed_start_on: null, admin_fee: null, admin_fee_basis: null, one_off_fees: null,
          workers_comp: [{ state: "OR", class_code: "2003", rate: 4.12 }], unemployment: null, medical: null, note: null, annual_premium: 18450, experience_mod: 0.92, minimum_premium: 0,
        } }],
        notes: [{ id: 4, quote_request_id: 5, area: "annual_premium", visibility: "internal", body: "Includes the audit", author: null, created_at: "2026-11-11T10:00:00+00:00" }],
      },
      error: null,
    });
    const got = await getQuoteComparison("f1", "o1");
    expect(got.line).toBe("workers_comp");
    expect(got.columns[0].quote).toMatchObject({ annualPremium: 18450, experienceMod: 0.92, minimumPremium: 0 });
    expect(got.notes[0].area).toBe("annual_premium");
  });

  // The site is deployed apart from the database: an answer from a database that has no lines yet names no line and no workers' comp figure.
  // Catches: every comparison failing to load on that database.
  it("reads an answer with no line as a PEO search's, its quotes holding no workers' comp figure", async () => {
    rpc.mockResolvedValue({ data: answer, error: null });
    const got = await getQuoteComparison("f1", "o1");
    expect(got.line).toBe("peo");
    expect(got.columns[0].quote).toMatchObject({ annualPremium: null, experienceMod: null, minimumPremium: null });
  });

  // Catches: a figure left out read as 0 or an empty list (the screen would say "free" for "not quoted"), a fee that loses its basis, or a note that loses who may read it.
  it("reads each column's current quote in the screen's words, a left-out area as null, and the notes", async () => {
    rpc.mockResolvedValue({ data: answer, error: null });
    expect(await getQuoteComparison("f1", "o1")).toEqual({
      line: "peo",
      canAdd: true,
      columns: [
        {
          quoteRequestId: 1, peoName: "Insperity", status: "quoted",
          quote: {
            id: 7, kind: "firm_offer", receivedOn: "2026-11-10", expiresOn: "2026-12-10", proposedStartOn: "2027-01-01", adminFee: 40, adminFeeBasis: "per_employee_per_month",
            oneOffFees: [{ name: "Setup", amount: 500 }], workersComp: [{ state: "CA", classCode: "8810", rate: 0.42 }], unemployment: [{ state: "CA", charge: "employer_rate" }],
            medical: null, note: "By phone", annualPremium: null, experienceMod: null, minimumPremium: null,
          },
        },
        { quoteRequestId: 2, peoName: "TriNet", status: "sent", quote: null },
      ],
      notes: [{ id: 3, quoteRequestId: 1, area: "admin_fee", visibility: "internal", body: "Waived the first year", author: "dana@acme.example", createdAt: "2026-11-11T10:00:00+00:00" }],
    });
  });

  // Catches: the one refusal (another firm's opportunity, one that isn't there, one the person may not see) shown as a broken page instead of "not available".
  it("says an opportunity that is not there, is another firm's or may not be seen is not available", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "That opportunity isn't available" } });
    const e = await caught(() => getQuoteComparison("f1", "o1"));
    expect(e).toBeInstanceOf(OpportunityError);
    expect((e as InstanceType<typeof OpportunityError>).kind).toBe("notFound");
  });

  // Catches: a note that loses its target, its mark (internal or client) or the firm it is written for.
  it("adds a note through the one writer, with its target, mark and firm", async () => {
    rpc.mockResolvedValue({ data: { id: 9, body: "Waived" }, error: null });
    await addComparisonNote("f1", "o1", { quoteRequestId: 1, area: "admin_fee", visibility: "client", body: "Waived" });
    expect(rpc).toHaveBeenCalledWith("add_comparison_note", { p_firm_id: "f1", p_opportunity_id: "o1", p_quote_request_id: 1, p_area: "admin_fee", p_visibility: "client", p_body: "Waived" });
  });

  // Catches: a refused note (blank, too long, a PEO of another opportunity) shown as "something went wrong" with the database's reason lost.
  it("gives the database's reason when it refuses a note's words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "A note has words, at most 2000 characters" } });
    const e = await caught(() => addComparisonNote("f1", "o1", { quoteRequestId: null, area: null, visibility: "internal", body: " " }));
    expect((e as InstanceType<typeof OpportunityError>).kind).toBe("invalid");
    expect((e as Error).message).toBe("A note has words, at most 2000 characters");
  });

  // Catches: a closing firm, a support session or an archived account refused with a message that tells the broker to fix their words.
  it.each([["PT423", "Nevermore support can look, not change"], ["55000", "This account is archived. Nothing on its opportunities can be changed."]])(
    "says a note can't be added now when the database answers %s",
    async (code, message) => {
      rpc.mockResolvedValue({ data: null, error: { code, message } });
      const e = await caught(() => addComparisonNote("f1", "o1", { quoteRequestId: null, area: null, visibility: "internal", body: "A note" }));
      expect((e as InstanceType<typeof OpportunityError>).kind).toBe("readOnly");
      expect((e as Error).message).toBe(message);
    },
  );

  // Catches: an answer that is not the agreed shape (a fee with no basis, a quote with no kind) drawn anyway, so the broker compares figures nobody checked.
  it("treats an answer that is not the agreed shape as a failure", async () => {
    rpc.mockResolvedValue({ data: { ...answer, columns: [{ quote_request_id: 1, peo_name: "Insperity", status: "quoted", quote: { ...quote, kind: "guess" } }] }, error: null });
    const e = await caught(() => getQuoteComparison("f1", "o1"));
    expect(e).toBeInstanceOf(OpportunityError);
    expect((e as InstanceType<typeof OpportunityError>).kind).toBe("failed");
  });
});
