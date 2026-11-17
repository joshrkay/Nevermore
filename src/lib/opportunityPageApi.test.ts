import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
// A read of a table: every step of the chain answers itself, and awaiting it (or maybeSingle) gives the table's answer.
const tables: Record<string, { data: unknown; error: unknown }> = {};
const reads: { table: string; calls: [string, unknown[]][] }[] = [];
const from = (table: string) => {
  const entry = { table, calls: [] as [string, unknown[]][] };
  reads.push(entry);
  const answer = () => tables[table] ?? { data: null, error: null };
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(answer()).then(resolve),
    maybeSingle: () => Promise.resolve(answer()),
  };
  for (const m of ["select", "eq", "order", "in"]) chain[m] = (...a: unknown[]) => (entry.calls.push([m, a]), chain);
  return chain;
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t) } }));

const {
  getOpportunityPage, listOpportunityActivity, updateOpportunity, OpportunityError, markOpportunityWon, markOpportunityLost, reopenOpportunity, recordCommissionPayment,
  getOpportunityOutcome, getOpportunityOfSubmission, getFirmName, updateCommissionPayment, deleteCommissionPayment, setPlacementCommission,
} = await import("./opportunityPageApi");
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
    expect(got.rows[1]).toEqual({ type: "quote", entryKey: "quote_request_event:9", at: "2026-11-06T10:00:00+00:00", quoteRequestId: 13, peoName: "PEO B", event: "sent", who: "dana@x.example", whoKind: "member", declineReason: null, declineWords: null });
    expect(got.rows[2]).toMatchObject({ type: "note", id: "n1", body: "Elena wants all three", opportunity: { id: "o1", name: "January 2027 PEO search" } });
  });

  // Catches (N-1.4): a decline's reason and words dropped on the way from the database, so the line can only say "declined".
  it("reads a decline's reason and the PEO's words into the quote request's event", async () => {
    const declined = { ...quote, event: "declined", decline_reason: "pricing", decline_words: "Below our floor" };
    rpc.mockResolvedValue({ data: { count: 1, rows: [declined] }, error: null });
    const got = (await listOpportunityActivity("f1", "o1"))!;
    expect(got.rows[0]).toMatchObject({ type: "quote", event: "declined", declineReason: "pricing", declineWords: "Below our floor" });
  });

  // Catches (N-1.2): the whole activity panel failing ("not the agreed shape") the first time a PEO acknowledges or asks a question, because the event list
  // is the four old words.
  it("reads a quote request's acknowledgement and question as events", async () => {
    rpc.mockResolvedValue({ data: { count: 2, rows: [{ ...quote, event: "acknowledged" }, { ...quote, entry_key: "quote_request_event:10", event: "question_open" }] }, error: null });
    const got = (await listOpportunityActivity("f1", "o1"))!;
    expect(got.rows.map((r) => (r.type === "quote" ? r.event : null))).toEqual(["acknowledged", "question_open"]);
  });

  // Catches (#237): the whole activity panel failing ("not the agreed shape") the first time an intake is certified, because the four kinds of row were the only ones
  // it knew, or an intake's row read with its who, version, File ID or invitee lost on the way.
  it("reads an intake's events: started, invited, reminded and certified", async () => {
    const base = { type: "intake", at: "2026-10-28T10:00:00+00:00", version: null, reference: null, invitee: null, who: "dana@x.example", who_kind: "member" };
    rpc.mockResolvedValue({
      data: {
        count: 4,
        rows: [
          { ...base, entry_key: "intake_certified:c1", event: "certified", version: 2, reference: "EAA-2026-0117", who: "Elena Marsh", who_kind: "client" },
          { ...base, entry_key: "intake_invitation:v2", event: "reminded", invitee: "Elena Marsh" },
          { ...base, entry_key: "intake_invitation:v1", event: "invited", invitee: "Elena Marsh" },
          { ...base, entry_key: "intake_started:s1", event: "started" },
        ],
      },
      error: null,
    });
    const got = (await listOpportunityActivity("f1", "o1"))!;
    expect(got.rows[0]).toEqual({ type: "intake", entryKey: "intake_certified:c1", at: "2026-10-28T10:00:00+00:00", event: "certified", version: 2, reference: "EAA-2026-0117", invitee: null, who: "Elena Marsh", whoKind: "client" });
    expect(got.rows.map((r) => (r.type === "intake" ? r.event : null))).toEqual(["certified", "reminded", "invited", "started"]);
    expect(got.rows[1]).toMatchObject({ invitee: "Elena Marsh", whoKind: "member", who: "dana@x.example" });
  });

  // Catches (#237): an event the screen has no words for drawn as one of the others (it would read as a certification) instead of failing where it can be seen.
  it("is a failure when an intake's event is not one of the four", async () => {
    rpc.mockResolvedValue({ data: { count: 1, rows: [{ type: "intake", entry_key: "x", at: "2026-10-28T10:00:00+00:00", event: "withdrawn", version: null, reference: null, invitee: null, who: "a", who_kind: "member" }] }, error: null });
    expect(await caught(() => listOpportunityActivity("f1", "o1"))).toBeInstanceOf(OpportunityError);
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


describe("closing an opportunity (CRM-O1.3b: opportunity_mark_won, opportunity_mark_lost, opportunity_reopen)", () => {
  const win = { quoteRequestId: 12, startDate: "2027-01-01", renewalDate: "2028-01-01", brokerOfRecord: "Acme Benefits", commission: { basis: "share" as const, rate: 20, expectedYearly: 12744 } };
  const wonAnswer = { conflict: false, record: { id: "o1", stage: "won", version: 5, quote_request_id: 12 } };

  // Catches: the quote, a date, the broker or the commission sent under the wrong parameter, or the version (D-46) left out.
  it("marks won with the quote, the placement's dates and broker, the commission, the firm and the version the person started from", async () => {
    rpc.mockResolvedValue({ data: wonAnswer, error: null });
    const done = await markOpportunityWon("f1", "o1", win, 4);
    expect(rpc).toHaveBeenCalledWith("opportunity_mark_won", {
      p_opportunity_id: "o1", p_quote_request_id: 12, p_start_date: "2027-01-01", p_renewal_date: "2028-01-01", p_broker_of_record: "Acme Benefits", p_firm_id: "f1", p_version: 4,
      p_commission_basis: "share", p_commission_rate: 20, p_commission_expected_yearly: 12744,
    });
    expect(done).toEqual({ conflict: false, stage: "won", version: 5 });
  });

  // Catches: a win with the withdrawal ticked that calls the plain function and then sends nothing, or sends the note in a second call that could be refused after the win.
  it("marks won and withdraws in one call when the person offers a withdrawal", async () => {
    rpc.mockResolvedValue({ data: wonAnswer, error: null });
    const done = await markOpportunityWon("f1", "o1", win, 4, { subject: "Re: Reyes Bakery", body: "The employer chose another PEO." });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("opportunity_mark_won_and_withdraw", {
      p_opportunity_id: "o1", p_quote_request_id: 12, p_start_date: "2027-01-01", p_renewal_date: "2028-01-01", p_broker_of_record: "Acme Benefits", p_firm_id: "f1", p_version: 4,
      p_commission_basis: "share", p_commission_rate: 20, p_commission_expected_yearly: 12744, p_time_zone: "UTC", p_subject: "Re: Reyes Bakery", p_body: "The employer chose another PEO.",
    });
    expect(done).toEqual({ conflict: false, stage: "won", version: 5 });
  });

  // Catches: a commission the person did not give sent as zeros, which the database would refuse or keep (D-466: optional).
  it("sends no commission when none was given", async () => {
    rpc.mockResolvedValue({ data: wonAnswer, error: null });
    await markOpportunityWon("f1", "o1", { ...win, commission: null }, 4);
    expect(rpc).toHaveBeenCalledWith("opportunity_mark_won", expect.objectContaining({ p_commission_basis: null, p_commission_rate: null, p_commission_expected_yearly: null }));
  });

  // Catches: the reason and the note sent in the wrong order or without the version (D-468).
  it("marks lost with the reason, the note, the firm and the version", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { id: "o1", stage: "lost", version: 5, lost_reason: "other", lost_note: "Closed" } }, error: null });
    const done = await markOpportunityLost("f1", "o1", { reason: "other", note: "Closed" }, 4);
    expect(rpc).toHaveBeenCalledWith("opportunity_mark_lost", { p_opportunity_id: "o1", p_reason: "other", p_note: "Closed", p_firm_id: "f1", p_version: 4 });
    expect(done).toEqual({ conflict: false, stage: "lost", version: 5 });
  });

  // Catches: a loss with the withdrawal ticked that is sent without the subject and note, or as two calls.
  it("marks lost and withdraws in one call when the person offers a withdrawal", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { id: "o1", stage: "lost", version: 5, lost_reason: "price", lost_note: null } }, error: null });
    const done = await markOpportunityLost("f1", "o1", { reason: "price", note: "" }, 4, { subject: "Re: Reyes Bakery", body: "The employer is not going ahead." });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("opportunity_mark_lost_and_withdraw", {
      p_opportunity_id: "o1", p_reason: "price", p_note: null, p_firm_id: "f1", p_version: 4, p_subject: "Re: Reyes Bakery", p_body: "The employer is not going ahead.",
    });
    expect(done).toEqual({ conflict: false, stage: "lost", version: 5 });
  });

  // Catches: a blank note sent as text, which the database would keep as a note for a reason that needs none.
  it("sends a blank note as none", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { id: "o1", stage: "lost", version: 5, lost_reason: "price", lost_note: null } }, error: null });
    await markOpportunityLost("f1", "o1", { reason: "price", note: "  " }, 4);
    expect(rpc).toHaveBeenCalledWith("opportunity_mark_lost", expect.objectContaining({ p_note: null }));
  });

  // Catches: a reopen that does not carry the version, so it could undo an outcome someone else already changed (D-469).
  it("reopens from the version the person started from", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { id: "o1", stage: "quoted", version: 6 } }, error: null });
    const done = await reopenOpportunity("f1", "o1", 5);
    expect(rpc).toHaveBeenCalledWith("opportunity_reopen", { p_opportunity_id: "o1", p_firm_id: "f1", p_version: 5 });
    expect(done).toEqual({ conflict: false, stage: "quoted", version: 6 });
  });

  // Catches: the refusal for a missing mailbox (PT412) said as a failed connection, so the person is told to check the network instead of to connect a mailbox.
  it("says a missing mailbox in the database's own words when a close would send", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT412", message: "Connect your mailbox to send from here." } });
    const e = (await caught(() => markOpportunityLost("f1", "o1", { reason: "price", note: "" }, 4, { subject: "S", body: "B" }))) as InstanceType<typeof OpportunityError>;
    expect(e.kind).toBe("invalid");
    expect(e.message).toBe("Connect your mailbox to send from here.");
  });

  // Catches: a stale close treated as done, or the person left without who changed what (D-46).
  it("answers a stale close with the stage now and who changed what, not as a failure", async () => {
    const changed = [{ field: "lost_reason", value: "price", who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }];
    rpc.mockResolvedValue({ data: { conflict: true, currentVersion: 6, current: { stage: "lost" }, changed }, error: null });
    expect(await markOpportunityWon("f1", "o1", win, 4)).toEqual({ conflict: true, currentVersion: 6, stage: "lost", changed });
    expect(await reopenOpportunity("f1", "o1", 4)).toMatchObject({ conflict: true, currentVersion: 6 });
  });

  // Catches: the reopen refusals (PT409: renewal being worked, payments to delete first) said as a failed connection instead of in the database's words (D-469).
  it("says each refusal in the database's own words, the reopen's PT409 included", async () => {
    for (const [code, kind] of [["22023", "invalid"], ["42501", "notAllowed"], ["PT409", "invalid"], ["PT423", "readOnly"], ["55000", "readOnly"], ["PT404", "notFound"]] as const) {
      rpc.mockResolvedValue({ data: null, error: { code, message: "Delete its payments first" } });
      const e = (await caught(() => reopenOpportunity("f1", "o1", 4))) as InstanceType<typeof OpportunityError>;
      expect(e.kind).toBe(kind);
      if (code !== "PT404") expect(e.message).toBe("Delete its payments first");
    }
  });

  // Catches: an answer that is not the agreed shape taken for a success.
  it("is a failure when the answer is not the agreed shape", async () => {
    rpc.mockResolvedValue({ data: { conflict: false }, error: null });
    expect(await caught(() => markOpportunityLost("f1", "o1", { reason: "price", note: "" }, 4))).toBeInstanceOf(OpportunityError);
  });
});

describe("recordCommissionPayment (CRM-O1.3a: record_commission_payment, D-467)", () => {
  // Catches: the day, the amount or the note sent under the wrong parameter; the answer's totals read as text.
  it("sends the day, amount and note against the placement and answers what is received to date", async () => {
    rpc.mockResolvedValue({
      data: { payment: { id: "p1", placement_id: "pl1", received_on: "2027-02-10", amount: 1500, note: "First", version: 1 }, received_to_date: 1500, expected_yearly: 12744 }, error: null,
    });
    const got = await recordCommissionPayment("f1", "pl1", { receivedOn: "2027-02-10", amount: 1500, note: "First" });
    expect(rpc).toHaveBeenCalledWith("record_commission_payment", { p_placement_id: "pl1", p_received_on: "2027-02-10", p_amount: 1500, p_note: "First", p_firm_id: "f1" });
    expect(got).toEqual({ receivedToDate: 1500, expectedYearly: 12744 });
  });

  // Catches: a refusal (an archived account, a level rule) said as a failed connection.
  it("says a refusal in the database's words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only the opportunity's owner can record commission." } });
    const e = (await caught(() => recordCommissionPayment("f1", "pl1", { receivedOn: "2027-02-10", amount: 1, note: "" }))) as InstanceType<typeof OpportunityError>;
    expect(e).toMatchObject({ kind: "notAllowed", message: "Only the opportunity's owner can record commission." });
  });
});

describe("getOpportunityOutcome (D-423: one read, opportunity_outcome)", () => {
  beforeEach(() => {
    reads.length = 0;
    rpc.mockReset();
  });
  const answer = {
    lost_reason: null, lost_note: null,
    placement: {
      id: "pl1", peo_name: "PEO B", start_date: "2027-01-01", broker_of_record: "Acme Benefits", ended_on: null, commission_basis: "share", commission_rate: 20,
      commission_expected_yearly: 12744, version: 2,
    },
    renewal: { id: "r1", renews_on: "2028-01-01" },
    payments: [{ id: "p1", received_on: "2027-02-10", amount: 1500, note: null, version: 1 }, { id: "p2", received_on: "2027-03-10", amount: 500, note: "Second", version: 1 }],
    received_to_date: 2000,
    quotes: [{ id: 12, close_reason: null, proposed_start_on: "2027-01-01" }, { id: 13, close_reason: "went_elsewhere", proposed_start_on: null }],
  };

  // Catches: the outcome read from five tables in two waves (no one snapshot, an untyped client, a row policy per table) instead of the one function.
  it("asks the database's one read, and no table", async () => {
    rpc.mockResolvedValue({ data: answer, error: null });
    await getOpportunityOutcome("f1", "o1");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("opportunity_outcome", { p_firm_id: "f1", p_opportunity_id: "o1" });
    expect(reads).toEqual([]);
  });

  // Catches: the banner missing the placement's PEO, start, broker or commission, the renewal's date, the payments to date, or a quote's close reason.
  it("reads the lost reason, the placement with its renewal and payments, and each quote's close reason and proposed start", async () => {
    rpc.mockResolvedValue({ data: answer, error: null });
    expect(await getOpportunityOutcome("f1", "o1")).toEqual({
      lostReason: null, lostNote: null,
      placement: {
        id: "pl1", peoName: "PEO B", startDate: "2027-01-01", brokerOfRecord: "Acme Benefits", endedOn: null, renewsOn: "2028-01-01",
        commission: { basis: "share", rate: 20, expectedYearly: 12744 }, version: 2,
      },
      payments: [{ id: "p1", receivedOn: "2027-02-10", amount: 1500, note: null, version: 1 }, { id: "p2", receivedOn: "2027-03-10", amount: 500, note: "Second", version: 1 }],
      receivedToDate: 2000,
      quotes: { 12: { closeReason: null, proposedStart: "2027-01-01" }, 13: { closeReason: "went_elsewhere", proposedStart: null } },
    });
  });

  // Catches: a banner that fails for a win with no commission or a loss with no placement.
  it("has no placement and no payments for an opportunity that is not won, and reads the lost reason", async () => {
    rpc.mockResolvedValue({ data: { ...answer, lost_reason: "other", lost_note: "Closed the practice", placement: null, renewal: null, payments: [], received_to_date: 0, quotes: [] }, error: null });
    expect(await getOpportunityOutcome("f1", "o1")).toMatchObject({ lostReason: "other", lostNote: "Closed the practice", placement: null, payments: [], receivedToDate: 0, quotes: {} });
  });

  // Catches: a win with no commission read as a commission of nothing.
  it("reads a placement with no commission as none", async () => {
    rpc.mockResolvedValue({ data: { ...answer, placement: { ...answer.placement, commission_basis: null, commission_rate: null, commission_expected_yearly: null } }, error: null });
    expect((await getOpportunityOutcome("f1", "o1")).placement?.commission).toBeNull();
  });

  // Catches: a failed read taken for "no outcome", which would show a won opportunity with no banner; and an answer of the wrong shape taken for one.
  it("is a failure when the read fails or answers a shape that is not the agreed one", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await caught(() => getOpportunityOutcome("f1", "o1"))).toBeInstanceOf(OpportunityError);
    rpc.mockResolvedValue({ data: { lost_reason: null }, error: null });
    expect(await caught(() => getOpportunityOutcome("f1", "o1"))).toBeInstanceOf(OpportunityError);
  });

  // Catches: an opportunity the person may not see read as a failure to try again.
  it("says an opportunity that may not be seen is not available", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "That opportunity isn't available" } });
    expect(await caught(() => getOpportunityOutcome("f1", "o1"))).toMatchObject({ kind: "notFound" });
  });
});

describe("editing and deleting a payment, and the commission later (CRM-O1.3b review: update_commission_payment, delete_commission_payment, set_placement_commission)", () => {
  const paymentConflict = {
    conflict: true, currentVersion: 3, current: { received_on: "2027-02-11", amount: 1600, note: "Moved" },
    changed: [{ field: "amount", value: 1600, who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }],
  };

  // Catches: the day, amount, note or version sent under the wrong parameter, or the answer's totals lost.
  it("saves a payment from the version the person started from", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { id: "p1", placement_id: "pl1", received_on: "2027-02-10", amount: 1400, note: "x", version: 2 }, received_to_date: 1400, expected_yearly: 12744 }, error: null });
    const got = await updateCommissionPayment("f1", "p1", { receivedOn: "2027-02-10", amount: 1400, note: "x" }, 1);
    expect(rpc).toHaveBeenCalledWith("update_commission_payment", { p_payment_id: "p1", p_received_on: "2027-02-10", p_amount: 1400, p_note: "x", p_firm_id: "f1", p_version: 1 });
    expect(got).toEqual({ conflict: false, receivedToDate: 1400, expectedYearly: 12744 });
  });

  // Catches: a stale edit treated as saved, or the person left without who changed what (D-46).
  it("answers a stale payment save as a conflict with what is there now", async () => {
    rpc.mockResolvedValue({ data: paymentConflict, error: null });
    expect(await updateCommissionPayment("f1", "p1", { receivedOn: "2027-02-10", amount: 1400, note: "" }, 1)).toEqual({
      conflict: true, currentVersion: 3, current: { receivedOn: "2027-02-11", amount: 1600, note: "Moved" }, changed: paymentConflict.changed,
    });
  });

  // Catches: the payment deleted without the version it was seen at, so a payment someone else changed is deleted unseen.
  it("deletes a payment from the version the person started from", async () => {
    rpc.mockResolvedValue({ data: { deleted: true, amount: 1500, received_to_date: 0 }, error: null });
    expect(await deleteCommissionPayment("f1", "p1", 2)).toEqual({ conflict: false, receivedToDate: 0 });
    expect(rpc).toHaveBeenCalledWith("delete_commission_payment", { p_payment_id: "p1", p_firm_id: "f1", p_version: 2 });
  });

  it("answers a stale delete as a conflict, deleting nothing", async () => {
    rpc.mockResolvedValue({ data: paymentConflict, error: null });
    expect(await deleteCommissionPayment("f1", "p1", 1)).toMatchObject({ conflict: true, currentVersion: 3, current: { amount: 1600 } });
  });

  // Catches: the commission sent under the wrong parameter, none sent as zeros, or the placement's version left out.
  it("sets the commission from the placement's version, and clears it with none", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { id: "pl1", commission_basis: "flat", commission_rate: 9000, commission_expected_yearly: 9000, version: 4 } }, error: null });
    expect(await setPlacementCommission("f1", "pl1", { basis: "flat", rate: 9000, expectedYearly: 9000 }, 3)).toEqual({
      conflict: false, commission: { basis: "flat", rate: 9000, expectedYearly: 9000 }, version: 4,
    });
    expect(rpc).toHaveBeenLastCalledWith("set_placement_commission", { p_placement_id: "pl1", p_firm_id: "f1", p_version: 3, p_basis: "flat", p_rate: 9000, p_expected_yearly: 9000 });
    rpc.mockResolvedValue({ data: { conflict: false, record: { id: "pl1", commission_basis: null, commission_rate: null, commission_expected_yearly: null, version: 5 } }, error: null });
    expect(await setPlacementCommission("f1", "pl1", null, 4)).toEqual({ conflict: false, commission: null, version: 5 });
    expect(rpc).toHaveBeenLastCalledWith("set_placement_commission", { p_placement_id: "pl1", p_firm_id: "f1", p_version: 4, p_basis: null, p_rate: null, p_expected_yearly: null });
  });

  it("answers a stale commission change as a conflict with the commission now", async () => {
    const changed = [{ field: "commission_rate", value: 25, who: "marcus@x.example", at: "2026-11-12T10:00:00+00:00" }];
    rpc.mockResolvedValue({ data: { conflict: true, currentVersion: 5, current: { commission_basis: "share", commission_rate: 25, commission_expected_yearly: null }, changed }, error: null });
    expect(await setPlacementCommission("f1", "pl1", null, 3)).toEqual({ conflict: true, currentVersion: 5, current: { basis: "share", rate: 25, expectedYearly: null }, changed });
  });

  // Catches: a refusal (a level rule, an archived account) said as a failed connection.
  it("says each refusal in the database's own words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only the opportunity's owner can change it." } });
    for (const call of [
      () => updateCommissionPayment("f1", "p1", { receivedOn: "2027-02-10", amount: 1, note: "" }, 1),
      () => deleteCommissionPayment("f1", "p1", 1),
      () => setPlacementCommission("f1", "pl1", null, 1),
    ]) expect(await caught(call)).toMatchObject({ kind: "notAllowed", message: "Only the opportunity's owner can change it." });
  });
});

describe("getOpportunityOfSubmission (D-470: the console finds the opportunity a submission belongs to)", () => {
  beforeEach(() => {
    reads.length = 0;
    for (const k of Object.keys(tables)) delete tables[k];
  });
  // Catches: the console opening a dialog for another opportunity, or for one when the submission has none.
  it("finds the opportunity that holds the submission, with its firm, or none", async () => {
    tables.opportunities = { data: { id: "o1", firm_id: "f1" }, error: null };
    expect(await getOpportunityOfSubmission("i1")).toEqual({ id: "o1", firmId: "f1" });
    expect(reads[0].calls).toContainEqual(["eq", ["intake_id", "i1"]]);
    tables.opportunities = { data: null, error: null };
    expect(await getOpportunityOfSubmission("i1")).toBeNull();
  });
  // Catches: a failed read taken for "this submission is on no opportunity", which sent the console to its old quote picker (the database refuses a win made there).
  it("is a failure when the read fails, and none only when it worked and found nothing", async () => {
    tables.opportunities = { data: null, error: { code: "XX000", message: "boom" } };
    expect(await caught(() => getOpportunityOfSubmission("i1"))).toBeInstanceOf(OpportunityError);
    tables.opportunities = { data: null, error: null };
    expect(await getOpportunityOfSubmission("i1")).toBeNull();
  });
});

describe("getFirmName (D-465: the broker of record is offered as the firm's name)", () => {
  beforeEach(() => {
    reads.length = 0;
    for (const k of Object.keys(tables)) delete tables[k];
  });
  // Catches: the broker offered as another firm's name or an id; and a failed read stopping the dialog (the field is then left for the person to fill in).
  it("reads the firm's own name, and is empty when it cannot", async () => {
    tables.firms = { data: { name: "Acme Benefits" }, error: null };
    expect(await getFirmName("f1")).toBe("Acme Benefits");
    expect(reads[0].calls).toContainEqual(["eq", ["id", "f1"]]);
    tables.firms = { data: null, error: { code: "XX000", message: "boom" } };
    expect(await getFirmName("f1")).toBe("");
  });
});

describe("getOpportunityOfSubmission: what is not an opportunity", () => {
  beforeEach(() => {
    reads.length = 0;
  });
  // Catches: a row with no id (another table's answer) taken for an opportunity.
  it("is none for a row that is not an opportunity", async () => {
    tables.opportunities = { data: { status: "quoted" }, error: null };
    expect(await getOpportunityOfSubmission("i1")).toBeNull();
  });
});
