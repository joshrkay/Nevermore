import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { getAccountPage, listAccountFiles, listAccountTab, updateAccount, getSubmissionAccount, AccountError, ACCOUNT_FILES_PAGE_SIZE } = await import("./accountPageApi");
const { AdvisorApiError } = await import("./advisorApi");
type AccountEdit = import("./accountPageApi").AccountEdit;

const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

const fields = {
  id: "a1",
  version: 3,
  name: "Harborview Dental Group",
  trade_name: "Harborview Dental",
  website: "https://www.harborviewdental.example",
  web_domain: "harborviewdental.example",
  phone: "(503) 555-0140",
  street: "410 SW Alder St",
  city: "Portland",
  state: "OR",
  postal_code: "97204",
  industry: "Dental practice",
  employees: 45,
  states_of_operation: ["OR", "WA"],
  current_provider: "Payroll vendor",
  source: "employer_intake",
  archived_at: null,
  created_at: "2026-10-28T10:00:00+00:00",
  updated_at: "2026-11-01T10:00:00+00:00",
};

const file = {
  id: "d1", file_name: "census.csv", mime_type: "text/csv", size_bytes: 1024, category: "other", created_at: "2026-11-02T10:00:00+00:00",
  submission_id: "i1", storage_path: "u1/i1/census.csv",
};

const page = {
  account: { ...fields, status: "prospect", owner: { id: "u1", name: "Dana Reyes" }, source_partner: "Kline CPA" },
  can_change: true,
  tabs: {
    contacts: { count: 7, rows: [{ id: "c1", first_name: "Elena", last_name: "Marsh", title: "Practice Manager", email: "elena@x.example", phone: null, mobile: null, is_main: true, do_not_email: false }] },
    opportunities: { count: 2, rows: [{ id: "o1", name: "January 2027 PEO search", stage: "in_market", target_start: "2027-01-01", submission_id: "i1" }, { id: "o2", name: "A search", stage: "qualifying", target_start: null, submission_id: null }] },
    quotes: { count: 1, rows: [{ id: 12, submission_id: "i1", opportunity_id: "o1", opportunity_name: "January 2027 PEO search", peo_name: "PEO A", status: "quoted", sent_on: "2026-10-29", quote_received_on: "2026-11-03", quote_expires_on: "2026-12-05" }] },
    activity: { count: 1, rows: [{ type: "change", entry_key: "e1", at: "2026-11-01T10:00:00+00:00", change_id: "ch1", kind: "changed", who: "dana@x.example", who_kind: "member", field: "employees", from_value: 40, to_value: 45, record_table: "accounts", record_id: "a1", record_name: "Harborview Dental Group" }] },
    files: { count: 1, rows: [file] },
  },
};

const edit: AccountEdit = {
  name: "Harborview Dental Group",
  tradeName: "Harborview Dental",
  website: "harborviewdental.example",
  phone: "(503) 555-0140",
  street: "410 SW Alder St",
  city: "Portland",
  state: "OR",
  postalCode: "97204",
  industry: "Dental practice",
  employees: 52,
  statesOfOperation: ["OR", "WA"],
  currentProvider: "",
};

beforeEach(() => rpc.mockReset());

describe("getAccountPage", () => {
  it("asks for the firm and the account and nothing else", async () => {
    rpc.mockResolvedValue({ data: page, error: null });
    await getAccountPage("f1", "a1");
    expect(rpc).toHaveBeenCalledWith("account_page", { p_firm_id: "f1", p_account_id: "a1" });
  });

  it("reads the account, whether it may be changed and each tab's count and rows in the page's own words", async () => {
    rpc.mockResolvedValue({ data: page, error: null });
    const got = await getAccountPage("f1", "a1");
    expect(got.account).toEqual({
      id: "a1", version: 3, name: "Harborview Dental Group", tradeName: "Harborview Dental", website: "https://www.harborviewdental.example", webDomain: "harborviewdental.example",
      phone: "(503) 555-0140", street: "410 SW Alder St", city: "Portland", state: "OR", postalCode: "97204", industry: "Dental practice", employees: 45,
      statesOfOperation: ["OR", "WA"], currentProvider: "Payroll vendor", source: "employer_intake", archivedAt: null, createdAt: "2026-10-28T10:00:00+00:00",
      updatedAt: "2026-11-01T10:00:00+00:00", status: "prospect", owner: { id: "u1", name: "Dana Reyes" }, sourcePartner: "Kline CPA", possibleDuplicateOf: null,
    });
    expect(got.canChange).toBe(true);
    expect(got.tabs.contacts).toEqual({
      count: 7,
      rows: [{ id: "c1", firstName: "Elena", lastName: "Marsh", title: "Practice Manager", email: "elena@x.example", phone: null, mobile: null, isMain: true, doNotEmail: false }],
    });
    expect(got.tabs.opportunities.rows).toEqual([
      { id: "o1", name: "January 2027 PEO search", stage: "in_market", targetStart: "2027-01-01", submissionId: "i1" },
      { id: "o2", name: "A search", stage: "qualifying", targetStart: null, submissionId: null },
    ]);
    expect(got.tabs.quotes.rows[0]).toEqual({
      id: 12, submissionId: "i1", opportunityId: "o1", opportunityName: "January 2027 PEO search", peoName: "PEO A", status: "quoted", sentOn: "2026-10-29",
      quoteReceivedOn: "2026-11-03", quoteExpiresOn: "2026-12-05",
    });
    expect(got.tabs.activity.rows[0]).toEqual({
      type: "change", entryKey: "e1", at: "2026-11-01T10:00:00+00:00", changeId: "ch1", kind: "changed", who: "dana@x.example", whoKind: "member", field: "employees", from: 40, to: 45,
      recordTable: "accounts", recordId: "a1", recordName: "Harborview Dental Group",
    });
    expect(got.tabs.files).toEqual({
      count: 1,
      rows: [{ id: "d1", fileName: "census.csv", mimeType: "text/csv", sizeBytes: 1024, category: "other", createdAt: "2026-11-02T10:00:00+00:00", submissionId: "i1", storagePath: "u1/i1/census.csv" }],
    });
  });

  it("has no Renewals tab (D-186)", async () => {
    rpc.mockResolvedValue({ data: page, error: null });
    expect(Object.keys((await getAccountPage("f1", "a1")).tabs).sort()).toEqual(["activity", "contacts", "files", "opportunities", "quotes"]);
  });

  it("gives an account with no owner and no partner as null, and a client as a client", async () => {
    rpc.mockResolvedValue({ data: { ...page, account: { ...page.account, owner: null, source_partner: null, status: "client" } }, error: null });
    const got = await getAccountPage("f1", "a1");
    expect(got.account.owner).toBeNull();
    expect(got.account.sourcePartner).toBeNull();
    expect(got.account.status).toBe("client");
  });

  // Catches: the mark dropped on the way (the banner never shows), or an account the person may not see read as one with a name.
  it("reads the possible-duplicate mark: the account it names, or only that one exists", async () => {
    rpc.mockResolvedValue({ data: { ...page, account: { ...page.account, possible_duplicate_of: { id: "a9", name: "Harborview Dental" } } }, error: null });
    expect((await getAccountPage("f1", "a1"))?.account.possibleDuplicateOf).toEqual({ id: "a9", name: "Harborview Dental" });
    rpc.mockResolvedValue({ data: { ...page, account: { ...page.account, possible_duplicate_of: { id: null, name: null } } }, error: null });
    expect((await getAccountPage("f1", "a1"))?.account.possibleDuplicateOf).toEqual({ id: null, name: null });
  });

  it("says when the person may not change the account, so the screen shows no Edit", async () => {
    rpc.mockResolvedValue({ data: { ...page, can_change: false }, error: null });
    expect((await getAccountPage("f1", "a1")).canChange).toBe(false);
  });

  it("answers null when the database gives nothing: an account the person may not see is the same as none", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getAccountPage("f1", "a1")).toBeNull();
  });

  it("is a failure, never a page with something missing, when the answer is not the agreed shape", async () => {
    for (const bad of [
      { ...page, tabs: { ...page.tabs, files: undefined } },
      { ...page, can_change: "yes" },
      { ...page, account: { ...page.account, status: "former client" } },
      { ...page, tabs: { ...page.tabs, opportunities: { count: 1, rows: [{ id: "o1", name: "x", stage: "negotiating", target_start: null, submission_id: null }] } } },
      { ...page, tabs: { ...page.tabs, contacts: { count: -1, rows: [] } } },
      "an account",
    ]) {
      rpc.mockResolvedValue({ data: bad, error: null });
      const e = await caught(() => getAccountPage("f1", "a1"));
      expect(e).toBeInstanceOf(AccountError);
      expect(e).toMatchObject({ kind: "failed" });
    }
  });

  it("says a failed call in words and keeps an ended session its own, so the person is signed out", async () => {
    rpc.mockResolvedValue(refused("XX000", "internal detail"));
    expect(await caught(() => getAccountPage("f1", "a1"))).toMatchObject({ kind: "failed", message: "Couldn't load the account. Try again." });
    rpc.mockResolvedValue(refused("PGRST301", "JWT expired"));
    const ended = await caught(() => getAccountPage("f1", "a1"));
    expect(ended).toBeInstanceOf(AdvisorApiError);
    expect(ended).toMatchObject({ unauthenticated: true });
  });
});

describe("listAccountFiles", () => {
  it("asks for the first page of fifty unless told otherwise, and for a page by its size and place", async () => {
    rpc.mockResolvedValue({ data: { count: 1, rows: [file] }, error: null });
    await listAccountFiles("f1", "a1");
    expect(rpc).toHaveBeenLastCalledWith("account_files", { p_firm_id: "f1", p_account_id: "a1", p_limit: ACCOUNT_FILES_PAGE_SIZE, p_offset: 0 });
    expect(ACCOUNT_FILES_PAGE_SIZE).toBe(50);
    await listAccountFiles("f1", "a1", { limit: 10, offset: 20 });
    expect(rpc).toHaveBeenLastCalledWith("account_files", { p_firm_id: "f1", p_account_id: "a1", p_limit: 10, p_offset: 20 });
  });

  it("reads the count and the files, and never a link: opening one is documentUrl's, under Storage's own rule", async () => {
    rpc.mockResolvedValue({ data: { count: 4, rows: [file] }, error: null });
    const got = await listAccountFiles("f1", "a1");
    expect(got).toEqual({ count: 4, rows: [{ id: "d1", fileName: "census.csv", mimeType: "text/csv", sizeBytes: 1024, category: "other", createdAt: "2026-11-02T10:00:00+00:00", submissionId: "i1", storagePath: "u1/i1/census.csv" }] });
    expect(JSON.stringify(got)).not.toMatch(/https?:|signed|token/i);
  });

  it("answers null for an account the person may not see, and fails on a shape that is not agreed", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await listAccountFiles("f1", "a1")).toBeNull();
    rpc.mockResolvedValue({ data: { count: 1, rows: [{ ...file, storage_path: undefined }] }, error: null });
    expect(await caught(() => listAccountFiles("f1", "a1"))).toMatchObject({ kind: "failed", message: "Couldn't load the files. Try again." });
  });

  it("puts a page the database refuses into its words", async () => {
    rpc.mockResolvedValue(refused("22023", "A page is 0 to 100 rows, from a place that is not before the first"));
    expect(await caught(() => listAccountFiles("f1", "a1", { limit: 500 }))).toMatchObject({ kind: "invalid", message: "A page is 0 to 100 rows, from a place that is not before the first" });
  });
});

describe("listAccountTab", () => {
  it("asks for a tab of the account by its name, in pages of fifty unless told otherwise", async () => {
    rpc.mockResolvedValue({ data: page.tabs.contacts, error: null });
    await listAccountTab("f1", "a1", "contacts");
    expect(rpc).toHaveBeenLastCalledWith("account_tab", { p_firm_id: "f1", p_account_id: "a1", p_tab: "contacts", p_limit: 50, p_offset: 0 });
    await listAccountTab("f1", "a1", "contacts", { limit: 100, offset: 5 });
    expect(rpc).toHaveBeenLastCalledWith("account_tab", { p_firm_id: "f1", p_account_id: "a1", p_tab: "contacts", p_limit: 100, p_offset: 5 });
  });

  it("gives each tab's rows in the page's own shape", async () => {
    rpc.mockResolvedValue({ data: page.tabs.contacts, error: null });
    expect(await listAccountTab("f1", "a1", "contacts")).toEqual({
      count: 7,
      rows: [{ id: "c1", firstName: "Elena", lastName: "Marsh", title: "Practice Manager", email: "elena@x.example", phone: null, mobile: null, isMain: true, doNotEmail: false }],
    });
    rpc.mockResolvedValue({ data: page.tabs.opportunities, error: null });
    expect((await listAccountTab("f1", "a1", "opportunities"))?.rows[1]).toEqual({ id: "o2", name: "A search", stage: "qualifying", targetStart: null, submissionId: null });
    rpc.mockResolvedValue({ data: page.tabs.quotes, error: null });
    expect((await listAccountTab("f1", "a1", "quotes"))?.rows[0]).toMatchObject({ id: 12, submissionId: "i1", peoName: "PEO A", status: "quoted", quoteExpiresOn: "2026-12-05" });
    rpc.mockResolvedValue({ data: page.tabs.activity, error: null });
    expect((await listAccountTab("f1", "a1", "activity"))?.rows[0]).toMatchObject({ type: "change", who: "dana@x.example", field: "employees", from: 40, to: 45, recordTable: "accounts" });
  });

  it("answers null for an account the person may not see, and fails on rows that are not the agreed shape, or of another tab", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await listAccountTab("f1", "a1", "contacts")).toBeNull();
    rpc.mockResolvedValue({ data: { count: 1, rows: [{ ...page.tabs.contacts.rows[0], last_name: undefined }] }, error: null });
    expect(await caught(() => listAccountTab("f1", "a1", "contacts"))).toMatchObject({ kind: "failed", message: "Couldn't load the list. Try again." });
    rpc.mockResolvedValue({ data: page.tabs.opportunities, error: null });
    expect(await caught(() => listAccountTab("f1", "a1", "contacts"))).toMatchObject({ kind: "failed" });
  });

  it("puts a refusal into its kind: a page the database refuses, a session that ended", async () => {
    rpc.mockResolvedValue(refused("22023", "A page is 0 to 100 rows, from a place that is not before the first"));
    expect(await caught(() => listAccountTab("f1", "a1", "contacts", { limit: 500 }))).toMatchObject({ kind: "invalid" });
    rpc.mockResolvedValue(refused("PGRST301", "JWT expired"));
    expect(await caught(() => listAccountTab("f1", "a1", "contacts"))).toMatchObject({ unauthenticated: true });
  });
});

describe("updateAccount", () => {
  it("sends every editable field under its database name, the firm and the version it started from, and never the owner, archiving or source", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { ...fields, employees: 52, version: 4 } }, error: null });
    await updateAccount("f1", "a1", edit, 3);
    expect(rpc).toHaveBeenCalledWith("update_account", {
      p_account_id: "a1",
      p_name: "Harborview Dental Group",
      p_trade_name: "Harborview Dental",
      p_website: "harborviewdental.example",
      p_phone: "(503) 555-0140",
      p_street: "410 SW Alder St",
      p_city: "Portland",
      p_state: "OR",
      p_postal_code: "97204",
      p_industry: "Dental practice",
      p_employees: 52,
      p_states_of_operation: ["OR", "WA"],
      p_current_provider: "",
      p_firm_id: "f1",
      p_version: 3,
    });
    const sent = Object.keys(rpc.mock.calls[0][1]).join(" ");
    expect(sent).not.toMatch(/owner|archiv|source|p_status/);
  });

  it("sends no employees as null and keeps the version it was given, so a missing one is the database's to refuse", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { ...fields, employees: null, version: 4 } }, error: null });
    await updateAccount("f1", "a1", { ...edit, employees: null }, 3);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_employees: null, p_version: 3 });
  });

  it("reads a save that went through as the account with its new version", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { ...fields, employees: 52, version: 4 } }, error: null });
    const got = await updateAccount("f1", "a1", edit, 3);
    expect(got).toMatchObject({ conflict: false, account: { id: "a1", version: 4, employees: 52, webDomain: "harborviewdental.example", statesOfOperation: ["OR", "WA"] } });
  });

  it("reads a conflict, which is an answer and not a failure: the version now, the fields now and who changed what", async () => {
    const changed = [{ field: "employees", value: 60, who: "owner@x.example", at: "2026-11-14T10:00:00+00:00" }];
    const current = {
      name: "Harborview Dental", trade_name: null, website: null, phone: "1", street: null, city: "Portland", state: "OR", postal_code: null, industry: null, employees: 60,
      states_of_operation: ["OR"], current_provider: null,
    };
    rpc.mockResolvedValue({ data: { conflict: true, currentVersion: 5, current, changed }, error: null });
    expect(await updateAccount("f1", "a1", edit, 3)).toEqual({
      conflict: true,
      currentVersion: 5,
      current: {
        name: "Harborview Dental", tradeName: null, website: null, phone: "1", street: null, city: "Portland", state: "OR", postalCode: null, industry: null, employees: 60,
        statesOfOperation: ["OR"], currentProvider: null,
      },
      changed,
    });
  });

  it("is a failed save, never a success or an empty conflict, when the answer is not exactly one of the two shapes", async () => {
    for (const bad of [
      null,
      "ok",
      { conflict: false },
      { conflict: false, record: { ...fields, version: undefined } },
      { conflict: true, currentVersion: 5, current: { name: "x" }, changed: [] },
      { conflict: true, currentVersion: 5, changed: [] },
    ]) {
      rpc.mockResolvedValue({ data: bad, error: null });
      expect(await caught(() => updateAccount("f1", "a1", edit, 3))).toMatchObject({ kind: "failed", message: "Couldn't save the account. Try again." });
    }
  });

  it("puts each refusal in its kind, in the database's own plain words where they say what to do", async () => {
    const cases: [string, string, string, string][] = [
      ["22023", "Give the account a name.", "invalid", "Give the account a name."],
      ["42501", "Only the account's owner, a lead of the owner's team or an owner of the firm can change it.", "notAllowed", "Only the account's owner, a lead of the owner's team or an owner of the firm can change it."],
      ["42501", "An account with no owner can only be changed by an owner of the firm.", "notAllowed", "An account with no owner can only be changed by an owner of the firm."],
      ["PT404", "That account isn't available", "notFound", "This account isn't available."],
      ["PT423", "This firm is closing and can't be changed", "readOnly", "This firm is closing and can't be changed"],
      ["PT423", "Nevermore support can look, not change", "readOnly", "Nevermore support can look, not change"],
      ["XX000", "relation accounts does not exist", "failed", "Couldn't save the account. Try again."],
    ];
    for (const [code, message, kind, shown] of cases) {
      rpc.mockResolvedValue(refused(code, message));
      const e = await caught(() => updateAccount("f1", "a1", edit, 3));
      expect(e).toBeInstanceOf(AccountError);
      expect(e).toMatchObject({ kind, message: shown, code });
    }
  });

  it("keeps an ended session its own, so the person is signed out", async () => {
    rpc.mockResolvedValue(refused("PGRST301", "JWT expired"));
    expect(await caught(() => updateAccount("f1", "a1", edit, 3))).toMatchObject({ unauthenticated: true });
  });
});

describe("getSubmissionAccount", () => {
  it("asks for the firm and the submission and gives the account's id and name", async () => {
    rpc.mockResolvedValue({ data: { id: "a1", name: "Harborview Dental Group" }, error: null });
    expect(await getSubmissionAccount("f1", "i1")).toEqual({ id: "a1", name: "Harborview Dental Group" });
    expect(rpc).toHaveBeenCalledWith("submission_account", { p_firm_id: "f1", p_submission_id: "i1" });
  });

  it("answers null when the submission is on no account or the person may not see it", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getSubmissionAccount("f1", "i1")).toBeNull();
  });

  it("fails on a shape that is not agreed, and on a failed call", async () => {
    rpc.mockResolvedValue({ data: { id: "a1" }, error: null });
    expect(await caught(() => getSubmissionAccount("f1", "i1"))).toMatchObject({ kind: "failed" });
    rpc.mockResolvedValue(refused("XX000", "boom"));
    expect(await caught(() => getSubmissionAccount("f1", "i1"))).toMatchObject({ kind: "failed" });
  });
});
