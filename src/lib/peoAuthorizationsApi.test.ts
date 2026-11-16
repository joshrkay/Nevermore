import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
/** The filters a query asked for, and the rows it answers. */
const asked: unknown[][] = [];
let rows: { data: unknown; error: unknown } = { data: [], error: null };
const chain = {
  select: (...a: unknown[]) => (asked.push(["select", ...a]), chain),
  eq: (...a: unknown[]) => (asked.push(["eq", ...a]), chain),
  order: (...a: unknown[]) => (asked.push(["order", ...a]), Promise.resolve(rows)),
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (table: string) => (asked.push(["from", table]), chain) },
}));

const { listMyCertifiedIntakes, loadPeoAuthorizations, setPeoAuthorization } = await import("./peoAuthorizationsApi");

beforeEach(() => {
  rpc.mockReset();
  asked.length = 0;
});

describe("setPeoAuthorization", () => {
  // Break caught: the wording recorded is not the wording the employer was shown (or the withdrawal is recorded with the authorizing words); the
  // version is not sent, so the database can't refuse an out-of-date page; the PEO or the intake is sent under the wrong name.
  it("records the employer's words for that PEO under the wording's version", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await setPeoAuthorization("s1", "TriNet", true);
    expect(rpc).toHaveBeenLastCalledWith("set_peo_authorization", {
      p_session_id: "s1", p_peo: "TriNet", p_authorized: true, p_version: "2026-11-draft-1",
      p_text: "I authorize TriNet to receive my company's packet, including my employees' personal information, so that it can consider my company for a quote. I can withdraw this at any time.",
    });
    await setPeoAuthorization("s1", "TriNet", false);
    expect(rpc).toHaveBeenLastCalledWith("set_peo_authorization", {
      p_session_id: "s1", p_peo: "TriNet", p_authorized: false, p_version: "2026-11-draft-1",
      p_text: "I withdraw my authorization for TriNet to receive my company's packet. Nothing more is to be sent to TriNet.",
    });
  });

  // Break caught: a refusal is swallowed, so the box shows a change the database never made; its words are lost.
  it("fails with the database's words when it refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "EA005", message: "This wording is out of date. Reload the page to read the current version." } });
    await expect(setPeoAuthorization("s1", "TriNet", true)).rejects.toMatchObject({
      code: "EA005", message: "This wording is out of date. Reload the page to read the current version.",
    });
  });
});

describe("loadPeoAuthorizations", () => {
  // Break caught: the states are read under the wrong names, so a withdrawn PEO reads as never asked; an answer of another shape is taken as states.
  it("reads each PEO's state, and refuses an answer of another shape", async () => {
    rpc.mockResolvedValue({
      data: [
        { peo: "Justworks", state: "withdrawn", signed_at: "2026-11-15T10:00:00Z", wording_version: "2026-11-draft-1" },
        { peo: "TriNet", state: "not_asked", signed_at: null, wording_version: null },
      ],
      error: null,
    });
    expect(await loadPeoAuthorizations("s1")).toEqual([
      { peo: "Justworks", state: "withdrawn", signedAt: "2026-11-15T10:00:00Z", wordingVersion: "2026-11-draft-1" },
      { peo: "TriNet", state: "not_asked", signedAt: null, wordingVersion: null },
    ]);
    expect(rpc).toHaveBeenLastCalledWith("peo_authorization_states", { p_session_id: "s1" });
    rpc.mockResolvedValue({ data: [{ peo: "TriNet", state: "maybe" }], error: null });
    await expect(loadPeoAuthorizations("s1")).rejects.toThrow();
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "Submission not found" } });
    await expect(loadPeoAuthorizations("s1")).rejects.toMatchObject({ code: "PT404" });
  });
});

describe("listMyCertifiedIntakes", () => {
  // Break caught: the profile offers boxes for an intake that is not the employer's own (row security lets a firm member read their firm's intakes too),
  // or for one not yet certified; an intake with no company name shows a blank heading.
  it("reads the employer's own certified intakes, by company", async () => {
    rows = { data: [{ id: "s1", chamber_data: { company_name: "Acme Co" } }, { id: "s2", chamber_data: {} }], error: null };
    expect(await listMyCertifiedIntakes("u1")).toEqual([{ id: "s1", company: "Acme Co" }, { id: "s2", company: "Your company" }]);
    expect(asked).toContainEqual(["from", "chamber_sessions"]);
    expect(asked).toContainEqual(["eq", "user_id", "u1"]);
    expect(asked).toContainEqual(["eq", "status", "submitted"]);
  });
});
