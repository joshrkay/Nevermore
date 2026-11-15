import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { searchRecords, noteRecentRecord, myRecentRecords, SearchError } = await import("./searchApi");

const account = { kind: "account", id: "a1", name: "Alpine Roofing", trade_name: null, web_domain: "alpine-roof.com", phone: "(503) 555-0142", city: "Portland", state: "OR", archived: false };
const contact = { kind: "contact", id: "c1", name: "Casey Contactson", title: null, email: "casey@alpine-roof.com", phone: null, account_id: "a1", account_name: "Alpine Roofing", archived: false };
const opportunity = { kind: "opportunity", id: "o1", name: "Alpine 2027 renewal", stage: "in_market", file_id: "EAA-2026-0001", submission_id: "s1", account_id: "a1", account_name: "Alpine Roofing", archived: false };
const quote = {
  kind: "quote",
  id: "7",
  peo_name: "Paychex Prime",
  status: "sent",
  file_id: "EAA-2026-0001",
  submission_id: "s1",
  opportunity_id: "o1",
  opportunity_name: "Alpine 2027 renewal",
  account_id: "a1",
  account_name: "Alpine Roofing",
  archived: false,
};
const empty = { rows: [], more: false };

beforeEach(() => rpc.mockReset());

describe("searchRecords", () => {
  it("sends the words as one value of one call and answers the four kinds in the box's shape", async () => {
    rpc.mockResolvedValue({
      data: { query: "alpine", accounts: { rows: [account], more: true }, contacts: { rows: [contact], more: false }, opportunities: { rows: [opportunity], more: false }, quotes: { rows: [quote], more: false } },
      error: null,
    });
    const r = await searchRecords("f1", "alpine");
    expect(rpc).toHaveBeenCalledWith("search_records", { p_firm_id: "f1", p_query: "alpine" });
    expect(r.accounts).toEqual({ rows: [expect.objectContaining({ kind: "account", name: "Alpine Roofing", webDomain: "alpine-roof.com", archived: false })], more: true });
    expect(r.contacts.rows[0]).toMatchObject({ kind: "contact", accountName: "Alpine Roofing", email: "casey@alpine-roof.com" });
    expect(r.opportunities.rows[0]).toMatchObject({ kind: "opportunity", fileId: "EAA-2026-0001", stage: "in_market" });
    expect(r.quotes.rows[0]).toMatchObject({ kind: "quote", peoName: "Paychex Prime", opportunityName: "Alpine 2027 renewal" });
  });

  it("passes what was typed as a value, quotes and all", async () => {
    rpc.mockResolvedValue({ data: { query: "x", accounts: empty, contacts: empty, opportunities: empty, quotes: empty }, error: null });
    await searchRecords("f1", `'; drop table accounts; --`);
    expect(rpc).toHaveBeenCalledWith("search_records", { p_firm_id: "f1", p_query: `'; drop table accounts; --` });
  });

  it("refuses an answer with more than five of a kind or a missing group (a failure, never half a result)", async () => {
    rpc.mockResolvedValue({ data: { query: "x", accounts: { rows: Array(6).fill(account), more: true }, contacts: empty, opportunities: empty, quotes: empty }, error: null });
    await expect(searchRecords("f1", "alpine")).rejects.toBeInstanceOf(SearchError);
    rpc.mockResolvedValue({ data: { query: "x", accounts: empty }, error: null });
    await expect(searchRecords("f1", "alpine")).rejects.toThrow("Couldn't search just now. Try again.");
  });

  it("says a person who belongs to no such firm has no access, in words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not a member of that firm" } });
    await expect(searchRecords("f2", "alpine")).rejects.toThrow("You don't have access to this firm's records.");
  });
});

describe("refusals", () => {
  it("keeps an ended session as unauthenticated, so the page signs the person out instead of retrying", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
    const e = await searchRecords("f1", "alpine").catch((x) => x);
    expect(e).toBeInstanceOf(SearchError);
    expect(e.unauthenticated).toBe(true);
    expect(e.forbidden).toBe(false);
    expect(e.message).toBe("Your session has expired. Sign in again to continue.");
  });

  it("keeps a refused firm as forbidden, from each of the three calls", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not a member of that firm" } });
    for (const call of [() => searchRecords("f2", "alpine"), () => noteRecentRecord("f2", "account", "a1"), () => myRecentRecords("f2")]) {
      const e = await call().catch((x) => x);
      expect(e.forbidden).toBe(true);
      expect(e.unauthenticated).toBe(false);
    }
  });

  it("keeps an ended session from the recent records too", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST303", message: "JWT expired" } });
    expect((await myRecentRecords("f1").catch((x) => x)).unauthenticated).toBe(true);
    expect((await noteRecentRecord("f1", "account", "a1").catch((x) => x)).unauthenticated).toBe(true);
  });
});

describe("recent records", () => {
  it("notes a record and says whether it was noted", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await noteRecentRecord("f1", "account", "a1")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("note_recent_record", { p_kind: "account", p_id: "a1", p_firm_id: "f1" });
    expect(await noteRecentRecord("f1", "account", "a2")).toBe(false);
  });

  it("says a closing firm or a support session can't note one", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT423", message: "Nevermore support can look, not change" } });
    await expect(noteRecentRecord("f1", "account", "a1")).rejects.toThrow("This firm can only be looked at, not changed.");
  });

  it("reads the last five, each with when it was opened", async () => {
    rpc.mockResolvedValue({ data: { rows: [{ ...quote, opened_at: "2026-11-15T10:00:00+00:00" }, { ...account, opened_at: "2026-11-15T09:00:00+00:00" }] }, error: null });
    const rows = await myRecentRecords("f1");
    expect(rpc).toHaveBeenCalledWith("my_recent_records", { p_firm_id: "f1", p_limit: 5 });
    expect(rows.map((r) => r.kind)).toEqual(["quote", "account"]);
    expect(rows[0]).toMatchObject({ peoName: "Paychex Prime", openedAt: "2026-11-15T10:00:00+00:00" });
  });
});
