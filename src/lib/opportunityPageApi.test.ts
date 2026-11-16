import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { getOpportunityPage, listOpportunityActivity, updateOpportunity, OpportunityError } = await import("./opportunityPageApi");
type OpportunityEdit = import("./opportunityPageApi").OpportunityEdit;

// What the opportunity's page asks the database (CRM-O1.1a: opportunity_page, opportunity_activity, update_opportunity). The database decides the rules; these
// tests hold that the answer is read in the page's words, that an answer that is not the agreed shape is a failure, and that each refusal is said as the
// screen needs it.

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

const fields = {
  id: "o1", version: 4, account_id: "a1", owner_id: "u1", name: "January 2027 PEO search", target_start: "2027-01-01", employees: 45, main_contact_id: "c1",
  expected_close: "2026-12-12", value: 7100, source: "Referral", next_step: "Send PEO B the loss run", submission_id: "i1",
  created_at: "2026-10-21T10:00:00+00:00", updated_at: "2026-11-11T10:00:00+00:00",
};
const page = {
  opportunity: { ...fields, stage: "in_market" },
  account: { id: "a1", name: "Harborview Dental Group", archived: false },
  owner: { id: "u1", name: "Dana Reyes" },
  main_contact: { id: "c1", name: "Elena Marsh" },
  can_change: true,
  can_add: true,
  quotes: [
    { id: 12, peo_name: "PEO A", status: "quoted", sent_on: "2026-10-29", quote_received_on: "2026-11-03", quote_expires_on: "2026-12-05", admin_fee_pepm: 132 },
    { id: 13, peo_name: "PEO B", status: "sent", sent_on: "2026-11-06", quote_received_on: null, quote_expires_on: null, admin_fee_pepm: null },
  ],
  intake: {
    submission_id: "i1", file_id: "EAA-2026-0117", pipeline_status: "sent_to_carrier", certified_by: "Elena Marsh", certified_at: "2026-10-28T10:00:00+00:00", version: 2,
    census_size: 45, answered: null, prospect_name: null, open_items: { count: 1, first_label: "Loss run for 2024", first_field: "loss_run" },
  },
  contacts: [
    { id: "c1", name: "Elena Marsh", title: "Practice Manager", email: "elena@x.example", phone: "(503) 555-0142", main: true, fills_in_intake: true },
    { id: "c2", name: "Dr. Owen Park", title: null, email: null, phone: null, main: false, fills_in_intake: false },
  ],
};

beforeEach(() => rpc.mockReset());

describe("getOpportunityPage", () => {
  // Catches: the page asking for more or less than the firm and the opportunity (the database decides who may see it).
  it("asks for the firm and the opportunity and nothing else", async () => {
    rpc.mockResolvedValue({ data: page, error: null });
    await getOpportunityPage("f1", "o1");
    expect(rpc).toHaveBeenCalledWith("opportunity_page", { p_firm_id: "f1", p_opportunity_id: "o1" });
  });

  // Catches: the referral partner dropped or renamed on the way to the screen (D-439), so "Referral · <partner>" has nothing to show; or an older answer without it failing the whole page.
  it("reads the referral partner as {code, name}, and an answer without one as none", async () => {
    rpc.mockResolvedValue({ data: { ...page, opportunity: { ...page.opportunity, referral_partner: { code: "harbor", name: "Harbor Brokers" } } }, error: null });
    expect((await getOpportunityPage("f1", "o1"))!.opportunity.referralPartner).toEqual({ code: "harbor", name: "Harbor Brokers" });
    rpc.mockResolvedValue({ data: { ...page, opportunity: { ...page.opportunity, referral_partner: null } }, error: null });
    expect((await getOpportunityPage("f1", "o1"))!.opportunity.referralPartner).toBeNull();
    rpc.mockResolvedValue({ data: page, error: null });
    expect((await getOpportunityPage("f1", "o1"))!.opportunity.referralPartner).toBeNull();
  });

  // Catches: a part of the answer (the stage, the main contact, the quotes, the intake, a contact's marks) lost or renamed on the way to the screen.
  it("reads the opportunity, its quotes, its intake and its contacts in the page's own words", async () => {
    rpc.mockResolvedValue({ data: page, error: null });
    const got = (await getOpportunityPage("f1", "o1"))!;
    expect(got.opportunity).toEqual({
      id: "o1", version: 4, accountId: "a1", ownerId: "u1", name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 45, mainContactId: "c1",
      expectedClose: "2026-12-12", value: 7100, source: "Referral", nextStep: "Send PEO B the loss run", submissionId: "i1", createdAt: "2026-10-21T10:00:00+00:00",
      updatedAt: "2026-11-11T10:00:00+00:00", referralPartner: null, stage: "in_market",
    });
    expect(got.account).toEqual({ id: "a1", name: "Harborview Dental Group", archived: false });
    expect(got.owner).toEqual({ id: "u1", name: "Dana Reyes" });
    expect(got.mainContact).toEqual({ id: "c1", name: "Elena Marsh" });
    expect(got.canChange).toBe(true);
    expect(got.canAdd).toBe(true);
    expect(got.quotes[1]).toEqual({ id: 13, peoName: "PEO B", status: "sent", sentOn: "2026-11-06", quoteReceivedOn: null, quoteExpiresOn: null, adminFeePepm: null });
    expect(got.intake).toEqual({
      submissionId: "i1", fileId: "EAA-2026-0117", pipelineStatus: "sent_to_carrier", certifiedBy: "Elena Marsh", certifiedAt: "2026-10-28T10:00:00+00:00", version: 2,
      censusSize: 45, answered: null, prospectName: null, openItems: { count: 1, firstLabel: "Loss run for 2024", firstField: "loss_run" },
    });
    expect(got.contacts[0]).toEqual({ id: "c1", name: "Elena Marsh", title: "Practice Manager", email: "elena@x.example", phone: "(503) 555-0142", main: true, fillsInIntake: true });
  });

  // Catches: an opportunity with no intake, no owner or no main contact breaking the page, or being drawn as if it had them.
  it("gives no intake, no owner and no main contact as null", async () => {
    rpc.mockResolvedValue({ data: { ...page, intake: null, owner: null, main_contact: null, quotes: [], contacts: [] }, error: null });
    const got = (await getOpportunityPage("f1", "o1"))!;
    expect(got.intake).toBeNull();
    expect(got.owner).toBeNull();
    expect(got.mainContact).toBeNull();
    expect(got.quotes).toEqual([]);
  });

  // Catches: the database's one refusal (PT404: not there, another firm's, or not the person's to see) shown as a failure to load instead of "isn't available".
  it("answers null for the database's one refusal, PT404", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "That opportunity isn't available" } });
    expect(await getOpportunityPage("f1", "o1")).toBeNull();
  });

  // Catches: an id that is no id (22P02) shown as a load that could work next time.
  it("passes any other refusal on, with the code", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22P02", message: "invalid input syntax for type uuid" } });
    const e = (await caught(() => getOpportunityPage("f1", "nope"))) as { code?: string };
    expect(e.code).toBe("22P02");
  });

  // Catches: a page drawn with something missing because the answer was not what was agreed.
  it("is a failure, never a page with something missing, when the answer is not the agreed shape", async () => {
    for (const bad of [{ ...page, quotes: undefined }, { ...page, opportunity: { ...fields, stage: "dreaming" } }, { ...page, can_change: "yes" }, { ...page, contacts: [{ id: "c1" }] }]) {
      rpc.mockResolvedValue({ data: bad, error: null });
      expect(await caught(() => getOpportunityPage("f1", "o1"))).toBeInstanceOf(OpportunityError);
    }
  });
});

describe("listOpportunityActivity", () => {
  const change = { type: "change", entry_key: "e1", at: "2026-11-11T10:00:00+00:00", change_id: "ch1", kind: "stage_changed", who: "dana@x.example", who_kind: "member", field: "stage", from_value: "ready_to_send", to_value: "in_market", cause: "quote_send", cause_peo: "PEO B", record_table: "opportunities", record_id: "o1", record_name: "January 2027 PEO search" };
  const quote = { type: "quote", entry_key: "quote_request_event:9", at: "2026-11-06T10:00:00+00:00", quote_request_id: 13, peo_name: "PEO B", event: "sent", who: "dana@x.example", who_kind: "member" };
  const note = { type: "note", id: "n1", entry_key: "n1", at: "2026-11-10T10:00:00+00:00", who: "Dana Reyes", author_id: "u1", contact: null, opportunity: { id: "o1", name: "January 2027 PEO search" }, outcome: null, title: null, body: "Elena wants all three", additions: [], assignee: null, due_on: null, done_at: null, done_by: null, can_edit: true, editable_until: null };

  // Catches: the filter or the page asked for in the wrong words (the database refuses anything but all, calls, notes, tasks or changes).
  it("asks for the filter and the page, from the first row by default", async () => {
    rpc.mockResolvedValue({ data: { count: 0, rows: [] }, error: null });
    await listOpportunityActivity("f1", "o1", { filter: "notes", limit: 50, offset: 100 });
    expect(rpc).toHaveBeenCalledWith("opportunity_activity", { p_firm_id: "f1", p_opportunity_id: "o1", p_filter: "notes", p_limit: 50, p_offset: 100 });
    await listOpportunityActivity("f1", "o1");
    expect(rpc).toHaveBeenLastCalledWith("opportunity_activity", { p_firm_id: "f1", p_opportunity_id: "o1", p_filter: "all", p_limit: 50, p_offset: 0 });
  });

  // Catches: a stage change that loses its cause, a quote request's event that is not read, or a note drawn with the account's own code unable to read it.
  it("reads a stage change with its cause, a quote request's event, and a note", async () => {
    rpc.mockResolvedValue({ data: { count: 3, rows: [change, quote, note] }, error: null });
    const got = (await listOpportunityActivity("f1", "o1"))!;
    expect(got.count).toBe(3);
    expect(got.rows[0]).toEqual({
      type: "change", entryKey: "e1", at: "2026-11-11T10:00:00+00:00", changeId: "ch1", kind: "stage_changed", who: "dana@x.example", whoKind: "member", field: "stage",
      from: "ready_to_send", to: "in_market", cause: "quote_send", causePeo: "PEO B", recordTable: "opportunities", recordId: "o1", recordName: "January 2027 PEO search",
    });
    expect(got.rows[1]).toEqual({ type: "quote", entryKey: "quote_request_event:9", at: "2026-11-06T10:00:00+00:00", quoteRequestId: 13, peoName: "PEO B", event: "sent", who: "dana@x.example", whoKind: "member" });
    expect(got.rows[2]).toMatchObject({ type: "note", id: "n1", body: "Elena wants all three", opportunity: { id: "o1", name: "January 2027 PEO search" } });
  });

  // Catches: an opportunity that has gone (PT404) shown as a failure of the activity panel.
  it("answers null when the person may not see the opportunity", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "That opportunity isn't available" } });
    expect(await listOpportunityActivity("f1", "o1")).toBeNull();
  });

  it("is a failure when a row is not one of the agreed kinds", async () => {
    rpc.mockResolvedValue({ data: { count: 1, rows: [{ type: "email", entry_key: "x" }] }, error: null });
    expect(await caught(() => listOpportunityActivity("f1", "o1"))).toBeInstanceOf(OpportunityError);
  });
});

describe("updateOpportunity", () => {
  const edit: OpportunityEdit = {
    name: "January 2027 PEO search", targetStart: "2027-01-01", employees: 52, mainContactId: "c1", expectedClose: "", value: 8000, source: "Referral", nextStep: "", ownerId: null,
  };

  // Catches: a field sent under the wrong parameter, the owner sent when "keep" was meant, or the version left out (D-46).
  it("sends every field, the firm and the version the person started from", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { ...fields, employees: 52, version: 5 } }, error: null });
    const saved = await updateOpportunity("f1", "o1", edit, 4);
    expect(rpc).toHaveBeenCalledWith("update_opportunity", {
      p_opportunity_id: "o1", p_name: "January 2027 PEO search", p_target_start: "2027-01-01", p_employees: 52, p_main_contact_id: "c1", p_expected_close: null, p_value: 8000,
      p_source: "Referral", p_next_step: "", p_owner_id: null, p_firm_id: "f1", p_version: 4,
    });
    expect(saved).toMatchObject({ conflict: false, opportunity: { id: "o1", version: 5, employees: 52 } });
  });

  // Catches: a save from an old version treated as saved, or the conflict dialog given the wrong "now" to set beside what was typed (D-46, D-183).
  it("answers a stale save with what is there now and who changed what, not as a failure", async () => {
    rpc.mockResolvedValue({
      data: {
        conflict: true, currentVersion: 6,
        current: { name: "January 2027 PEO search", target_start: "2027-02-01", employees: 45, main_contact_id: null, expected_close: null, value: null, source: null, next_step: "Call", owner_id: "u2" },
        changed: [{ field: "target_start", value: "2027-02-01", who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }],
      },
      error: null,
    });
    const got = await updateOpportunity("f1", "o1", edit, 4);
    expect(got).toEqual({
      conflict: true, currentVersion: 6,
      current: { name: "January 2027 PEO search", targetStart: "2027-02-01", employees: 45, mainContactId: null, expectedClose: null, value: null, source: null, nextStep: "Call", ownerId: "u2" },
      changed: [{ field: "target_start", value: "2027-02-01", who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }],
    });
  });

  // Catches: each refusal told as the wrong kind of failure, so the form says the wrong thing (the database's own words are kept where they say what to do).
  it("says each refusal as the screen needs it, with the database's own words", async () => {
    const cases: [string, string][] = [
      ["22023", "invalid"], ["40001", "invalid"], ["42501", "notAllowed"], ["PT404", "notFound"], ["PT423", "readOnly"], ["55000", "readOnly"], ["XX000", "failed"],
    ];
    for (const [code, kind] of cases) {
      rpc.mockResolvedValue({ data: null, error: { code, message: `words for ${code}` } });
      const e = (await caught(() => updateOpportunity("f1", "o1", edit, 4))) as InstanceType<typeof OpportunityError>;
      expect(e).toBeInstanceOf(OpportunityError);
      expect(e.kind).toBe(kind);
      if (kind !== "failed" && code !== "PT404") expect(e.message).toBe(`words for ${code}`);
    }
  });

  // Catches: an answer that is neither a save nor a conflict taken for a success.
  it("is a failure when the answer is neither a save nor a conflict", async () => {
    rpc.mockResolvedValue({ data: { conflict: false }, error: null });
    expect(await caught(() => updateOpportunity("f1", "o1", edit, 4))).toBeInstanceOf(OpportunityError);
  });
});
