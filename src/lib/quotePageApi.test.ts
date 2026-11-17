import { beforeEach, describe, expect, it, vi } from "vitest";

// What a quote's page asks (CRM-Q3.2, D-185: a quote is a quote request): the quote request's own row says which submission it is on, and the reads that already
// exist give the rest (the opportunity of the submission, the opportunity's page, the submission with its threads). This holds how they are put together.

const requestRow = { current: { data: { session_id: "s1" } as { session_id: string } | null, error: null as { code?: string; message: string } | null } };
const asked: [string, unknown[]][] = [];
const from = (table: string) => {
  const chain: Record<string, unknown> = { maybeSingle: () => Promise.resolve(requestRow.current) };
  for (const m of ["select", "eq"]) chain[m] = (...a: unknown[]) => (asked.push([`${table}.${m}`, a]), chain);
  return chain;
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => from(t) } }));
const getOpportunityOfSubmission = vi.fn();
const getOpportunityPage = vi.fn();
vi.mock("@/lib/opportunityPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityPageApi")), getOpportunityOfSubmission, getOpportunityPage }));
const loadSubmission = vi.fn();
vi.mock("@/lib/advisorApi", async () => ({ ...(await vi.importActual<object>("@/lib/advisorApi")), loadSubmission }));

const { getQuotePage } = await import("./quotePageApi");

beforeEach(() => {
  asked.length = 0;
  requestRow.current = { data: { session_id: "s1" }, error: null };
  for (const f of [getOpportunityOfSubmission, getOpportunityPage, loadSubmission]) f.mockReset();
});

describe("getQuotePage", () => {
  // Catches: a quote request that is gone, another firm's or on an account the person may not see drawing a page (or a failure) instead of "not available".
  it("is none when the quote request is not one the person can read", async () => {
    requestRow.current = { data: null, error: null };
    expect(await getQuotePage("f1", "7")).toBeNull();
    expect(asked).toContainEqual(["quote_requests.eq", ["id", 7]]);
    expect(loadSubmission).not.toHaveBeenCalled();
  });

  // Catches: the page drawn from another quote request's row of the same submission, or without the opportunity's account for its trail.
  it("gives the quote request with its submission and its opportunity's page", async () => {
    getOpportunityOfSubmission.mockResolvedValue({ id: "o1", firmId: "f1" });
    getOpportunityPage.mockResolvedValue({ opportunity: { id: "o1" }, account: { id: "a1", name: "Harborview" } });
    loadSubmission.mockResolvedValue({ id: "s1", quoteRequests: [{ id: 6, peo_name: "Justworks" }, { id: 7, peo_name: "TriNet" }] });
    const page = await getQuotePage("f1", "7");
    expect(page?.request.peo_name).toBe("TriNet");
    expect(page?.detail.id).toBe("s1");
    expect(page?.opportunity.account.name).toBe("Harborview");
    expect(getOpportunityOfSubmission).toHaveBeenCalledWith("s1");
    expect(getOpportunityPage).toHaveBeenCalledWith("f1", "o1");
    // The submission is read, not opened: looking at a quote is not opening the intake (D-1790).
    expect(loadSubmission).toHaveBeenCalledWith("s1", false);
  });

  // Catches: a quote request on an opportunity whose account the person may not see (the database shows no opportunity row) drawing a page with no trail.
  it("is none when its submission is on no opportunity the person can see, and reads nothing more", async () => {
    getOpportunityOfSubmission.mockResolvedValue(null);
    expect(await getQuotePage("f1", "7")).toBeNull();
    expect(getOpportunityPage).not.toHaveBeenCalled();
    expect(loadSubmission).not.toHaveBeenCalled();
  });

  // Catches: an address that is no number (or a number the database cannot hold) asking the database and showing "couldn't load" where "not available" is true.
  it("is none, with nothing asked, for an address that is not a quote request's number", async () => {
    for (const bad of ["abc", "7x", "-1", "0", "1.5", "99999999999999999999", ""]) expect(await getQuotePage("f1", bad)).toBeNull();
    expect(asked).toEqual([]);
  });

  // Catches: a page drawn with no header when one of the three reads finds nothing (a submission or opportunity that went between the reads, or a request not on it).
  it("is none when the submission, the opportunity or the request is missing from what the reads give", async () => {
    getOpportunityOfSubmission.mockResolvedValue({ id: "o1", firmId: "f1" });
    const page = { opportunity: { id: "o1" }, account: { id: "a1", name: "Harborview" } };
    const detail = { id: "s1", quoteRequests: [{ id: 7, peo_name: "TriNet" }] };
    for (const [o, d] of [[page, { ...detail, quoteRequests: [{ id: 6 }] }], [page, null], [null, detail]]) {
      getOpportunityPage.mockResolvedValue(o);
      loadSubmission.mockResolvedValue(d);
      expect(await getQuotePage("f1", "7")).toBeNull();
    }
  });
});
