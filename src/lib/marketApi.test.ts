import { beforeEach, describe, expect, it, vi } from "vitest";

// What the screens of slice A ask the database (docs/BROKER_READINESS_PRD.md BR-1.3, BR-1.4, BR-2.2; 20261127090000_sendable.sql). The database decides
// who may ask; these hold the calls' names and arguments, the shape read back, and the words a refusal is shown in.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const api = await import("./marketApi");

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const refused = (code: string, message: string) => Promise.resolve({ data: null, error: { code, message } });

describe("a firm's own contacts at a market", () => {
  beforeEach(() => { rpc.mockReset(); });

  // Break caught: a contact filed under the wrong market, so a send to one PEO offers another's person.
  it("reads the firm's contacts, each under its market", async () => {
    rpc.mockReturnValue(ok([{ id: 4, peo_id: 2, peo_name: "Harbor PEO", name: "Lee Ortiz", role: null, email: "lee@harbor.example", phone: null, added_by: "Gus", created_at: "2026-11-27T10:00:00Z" }]));
    expect(await api.loadFirmMarketContacts("f1")).toEqual([{ id: 4, peoId: 2, peoName: "Harbor PEO", name: "Lee Ortiz", role: null, email: "lee@harbor.example", phone: null, addedBy: "Gus" }]);
    expect(rpc).toHaveBeenCalledWith("firm_market_contacts_list", { p_firm_id: "f1" });
  });

  it("adds one with what was typed, an empty role or phone sent as none", async () => {
    rpc.mockReturnValue(ok({ id: 5 }));
    await api.addFirmMarketContact("f1", 2, { name: "Lee Ortiz", role: " ", email: "lee@harbor.example", phone: "" });
    expect(rpc).toHaveBeenCalledWith("add_firm_market_contact", { p_firm_id: "f1", p_peo_id: 2, p_name: "Lee Ortiz", p_role: null, p_email: "lee@harbor.example", p_phone: null });
  });

  // Break caught: the database's own sentence ("…is already one of your firm's contacts at Harbor PEO") replaced by "Something went wrong".
  it("says a refused add in the database's words", async () => {
    rpc.mockReturnValue(refused("22023", "lee@harbor.example is already one of your firm's contacts at Harbor PEO"));
    await expect(api.addFirmMarketContact("f1", 2, { name: "Lee", role: "", email: "lee@harbor.example", phone: "" })).rejects.toThrow("lee@harbor.example is already one of your firm's contacts at Harbor PEO");
  });

  it("says a closing firm or a support session can't change it, in the database's words", async () => {
    rpc.mockReturnValue(refused("PT423", "This firm is closing and can't be changed"));
    await expect(api.removeFirmMarketContact("f1", 4)).rejects.toThrow("This firm is closing and can't be changed");
  });

  it("says its own words for a failure the database gave no sentence for", async () => {
    rpc.mockReturnValue(refused("XX000", "relation does not exist"));
    await expect(api.loadFirmMarketContacts("f1")).rejects.toThrow("Couldn't load your firm's contacts. Try again.");
  });

  it("removes one by its id", async () => {
    rpc.mockReturnValue(ok(null));
    await api.removeFirmMarketContact("f1", 4);
    expect(rpc).toHaveBeenCalledWith("remove_firm_market_contact", { p_firm_id: "f1", p_contact_id: 4 });
  });
});

describe("asking for a market that isn't listed", () => {
  beforeEach(() => { rpc.mockReset(); });

  it("asks with the name, what it quotes, and a contact and note when given", async () => {
    rpc.mockReturnValue(ok({ id: 1, status: "open" }));
    await api.requestMarket("f1", { name: "Summit PEO", line: "peo", contactName: "Sam Cole", contactEmail: "", note: " " });
    expect(rpc).toHaveBeenCalledWith("request_market", { p_firm_id: "f1", p_name: "Summit PEO", p_line: "peo", p_contact_name: "Sam Cole", p_contact_email: null, p_note: null });
  });

  // Break caught: an answered request shown as still waiting, or the admin's reason dropped.
  it("reads the firm's requests with each one's answer", async () => {
    rpc.mockReturnValue(ok([{ id: 1, name: "Summit PEO", line: "peo", contact_name: null, contact_email: null, note: null, status: "declined", answer: "A carrier.", answered_at: "2026-11-28T09:00:00Z", peo_id: null, requested_by: "Gus", created_at: "2026-11-27T10:00:00Z" }]));
    expect(await api.loadFirmMarketRequests("f1")).toEqual([
      { id: 1, firmName: null, name: "Summit PEO", line: "peo", contactName: null, contactEmail: null, note: null, status: "declined", answer: "A carrier.", requestedBy: "Gus", createdAt: "2026-11-27T10:00:00Z" },
    ]);
  });

  it("reads every firm's for a platform admin, each with its firm's name, and a line it doesn't know as a PEO's", async () => {
    rpc.mockReturnValue(ok([{ id: 1, firm_id: "f1", firm_name: "Acme Brokers", name: "Summit PEO", contact_name: null, contact_email: null, note: null, status: "open", answer: null, created_at: "2026-11-27T10:00:00Z" }]));
    const [r] = await api.loadAdminMarketRequests();
    expect(rpc).toHaveBeenCalledWith("admin_market_requests");
    expect(r.firmName).toBe("Acme Brokers");
    expect(r.line).toBe("peo");
  });

  it("answers a request as listed, naming the market, or as declined, with the reason", async () => {
    rpc.mockReturnValue(ok(null));
    await api.answerMarketRequest(1, { listed: true, peoId: 9, answer: "" });
    expect(rpc).toHaveBeenLastCalledWith("admin_answer_market_request", { p_request_id: 1, p_listed: true, p_answer: null, p_peo_id: 9 });
    // A market chosen and then declined instead names no market: the database holds a declined request to none.
    await api.answerMarketRequest(1, { listed: false, peoId: 9, answer: "Not a PEO." });
    expect(rpc).toHaveBeenLastCalledWith("admin_answer_market_request", { p_request_id: 1, p_listed: false, p_answer: "Not a PEO.", p_peo_id: null });
  });
});

describe("the firm's licences on record", () => {
  beforeEach(() => { rpc.mockReset(); });

  // Break caught: a lapsed licence shown as good, or an agent offered a form the database will refuse.
  it("reads the number, each licence with whether it has lapsed, the check, and whether the reader may change it", async () => {
    rpc.mockReturnValue(ok({ npn: "1234567", licences: [{ id: 3, state: "TX", line: "property_casualty", licence_number: "L-1", expires_on: "2026-01-01", expired: true }], checked_at: "2026-11-20T09:00:00Z", changed_since_check: true, can_change: false }));
    expect(await api.loadFirmLicenceRecord("f1")).toEqual({
      npn: "1234567", licences: [{ id: 3, state: "TX", line: "property_casualty", licenceNumber: "L-1", expiresOn: "2026-01-01", expired: true }],
      checkedAt: "2026-11-20T09:00:00Z", changedSinceCheck: true, canChange: false,
    });
    expect(rpc).toHaveBeenCalledWith("firm_licence_record", { p_firm_id: "f1" });
  });

  it("reads a firm's record for a platform admin, who changes nothing in it", async () => {
    rpc.mockReturnValue(ok({ npn: null, licences: [], checked_at: null, changed_since_check: false }));
    expect((await api.loadAdminFirmLicenceRecord("f1")).canChange).toBe(false);
    expect(rpc).toHaveBeenCalledWith("admin_firm_licence_record", { p_firm_id: "f1" });
  });

  it("sets the number, adds a licence with an empty number or date as none, removes one, and records the admin's check", async () => {
    rpc.mockReturnValue(ok(null));
    await api.setFirmNpn("f1", " ");
    expect(rpc).toHaveBeenLastCalledWith("set_firm_npn", { p_firm_id: "f1", p_npn: null });
    await api.addFirmLicence("f1", { state: "tx", line: "property_casualty", licenceNumber: "", expiresOn: "" });
    expect(rpc).toHaveBeenLastCalledWith("add_firm_licence", { p_firm_id: "f1", p_state: "tx", p_line: "property_casualty", p_licence_number: null, p_expires_on: null });
    await api.removeFirmLicence("f1", 3);
    expect(rpc).toHaveBeenLastCalledWith("remove_firm_licence", { p_firm_id: "f1", p_licence_id: 3 });
    await api.recordLicenceCheck("f1");
    expect(rpc).toHaveBeenLastCalledWith("admin_record_licence_check", { p_firm_id: "f1" });
  });

  it("tells an agent only an owner keeps the licences, in the database's words", async () => {
    rpc.mockReturnValue(refused("42501", "Only an owner of the firm keeps its licences."));
    await expect(api.setFirmNpn("f1", "1")).rejects.toThrow("Only an owner of the firm keeps its licences.");
  });
});
