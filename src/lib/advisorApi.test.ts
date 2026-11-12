import { Blob as NodeBlob } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const download = vi.fn();
const buckets: string[] = [];
const createSignedUrl = vi.fn();
/** Rows each table returns to the detail page's queries, which are all select/eq/order chains. */
const tables: Record<string, unknown[]> = {};
/** Each `.in(column, values)` filter a query asked for, by table. */
const inFilters: { table: string; column: string; values: unknown[] }[] = [];
const query = (table: string) => {
  let rows = () => tables[table] ?? [];
  const result = () => ({ data: rows(), error: null });
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    in: (column: string, values: unknown[]) => {
      inFilters.push({ table, column, values });
      const before = rows;
      rows = () => before().filter((r) => values.includes((r as Record<string, unknown>)[column]));
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null }),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, ko),
  };
  return chain;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => query(table),
    rpc: (...args: unknown[]) => rpc(...args),
    storage: { from: (bucket: string) => {
      buckets.push(bucket);
      return { upload: (...a: unknown[]) => upload(...a), remove: (...a: unknown[]) => remove(...a), download: (...a: unknown[]) => download(...a), createSignedUrl: (...a: unknown[]) => createSignedUrl(bucket, ...a) };
    } },
  },
}));

const {
  AdvisorApiError,
  fetchIsAdvisor,
  listEmailProblems,
  listOutboxEvents,
  listSubmissions,
  loadSubmission,
  outboxSummary,
  requeueOutboxEvent,
  reviewField,
  saveManuscriptVersion,
  setNeedsAction,
  setStatus,
  recordQuoteSend,
  updateQuoteRequest,
  fetchIsAdmin,
  loadPeoDirectory,
  loadVersionContacts,
  publishPeoDraft,
  savePeoDraft,
  recheckPeoProfile,
  documentFile,
  addQuoteRequestNote,
  correctQuoteRequestNote,
  reissueQuoteRequestAddress,
  openQuoteRequestThread,
  mailAttachmentUrl,
} = await import("./advisorApi");

const failWith = (error: { message: string; code?: string }) => rpc.mockResolvedValue({ data: null, error });
const caught = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (err) {
    return err as InstanceType<typeof AdvisorApiError>;
  }
  throw new Error("expected the call to fail");
};

describe("advisor API errors", () => {
  beforeEach(() => rpc.mockReset());

  it("reports a role check that comes back true or false", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(fetchIsAdvisor()).resolves.toBe(true);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(fetchIsAdvisor()).resolves.toBe(false);
  });

  it("calls a database refusal a lack of advisor access", async () => {
    failWith({ code: "42501", message: "Advisor access required" });
    const err = await caught(() => listSubmissions({ status: null }));
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.forbidden).toBe(true);
    expect(err.unauthenticated).toBe(false);
    expect(err.message).toBe("You don't have advisor access.");
  });

  it.each([
    ["PostgREST's expired-token code", { code: "PGRST301", message: "JWT expired" }],
    ["an expired token reported without a code", { message: "JWT expired" }],
    ["an invalid token", { code: "PGRST303", message: "JWT cryptographic operation failed" }],
    ["storage's wording for an expired token", { message: "exp claim timestamp check failed" }],
    ["PostgREST's no-suitable-key code, whatever its wording", { code: "PGRST301", message: "No suitable key or wrong key type" }],
    ["PostgREST's anonymous-access code, whatever its wording", { code: "PGRST302", message: "Anonymous access is disabled" }],
  ])("calls %s an ended session", async (_label, error) => {
    failWith(error);
    const err = await caught(() => listSubmissions({ status: null }));
    expect(err.unauthenticated).toBe(true);
    expect(err.forbidden).toBe(false);
    expect(err.message).toBe("Your session has expired. Sign in again to continue.");
  });

  it("leaves any other failure as it was reported", async () => {
    failWith({ code: "57014", message: "canceling statement due to statement timeout" });
    const err = await caught(() => listSubmissions({ status: null }));
    expect(err.forbidden).toBe(false);
    expect(err.unauthenticated).toBe(false);
    expect(err.message).toBe("canceling statement due to statement timeout");
  });

  it("falls back to a plain message when the failure has none", async () => {
    failWith({ message: "" });
    const err = await caught(() => listSubmissions({ status: null }));
    expect(err.message).toBe("Couldn't load submissions.");
  });
});

describe("outbox API", () => {
  beforeEach(() => rpc.mockReset());

  it("lists the queue, all of it or one status, through the advisor-only function", async () => {
    rpc.mockResolvedValue({ data: [{ id: "e1" }], error: null });
    await expect(listOutboxEvents(null)).resolves.toEqual([{ id: "e1" }]);
    expect(rpc).toHaveBeenLastCalledWith("advisor_list_outbox_events", {});
    await listOutboxEvents("dead");
    expect(rpc).toHaveBeenLastCalledWith("advisor_list_outbox_events", { p_status: "dead" });
  });

  it("treats an empty answer as an empty queue", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(listOutboxEvents(null)).resolves.toEqual([]);
    await expect(outboxSummary()).resolves.toEqual([]);
  });

  it("reads the counts", async () => {
    rpc.mockResolvedValue({ data: [{ status: "dead", events: 2, oldest_due_at: null }], error: null });
    await expect(outboxSummary()).resolves.toEqual([{ status: "dead", events: 2, oldest_due_at: null }]);
    expect(rpc).toHaveBeenLastCalledWith("advisor_outbox_summary");
  });

  it("requeues by event id, with or without a rebuild, and reports whether it did", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(requeueOutboxEvent("e1", false)).resolves.toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("advisor_requeue_outbox_event", { event_id: "e1", rebuild_payload: false });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(requeueOutboxEvent("e1", true)).resolves.toBe(false);
    expect(rpc).toHaveBeenLastCalledWith("advisor_requeue_outbox_event", { event_id: "e1", rebuild_payload: true });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(requeueOutboxEvent("e1", false)).resolves.toBe(false);
  });

  // The database answers a non-advisor with 42501, which PostgREST sends as HTTP 403.
  it.each([
    ["listing", () => listOutboxEvents(null)],
    ["counting", () => outboxSummary()],
    ["retrying", () => requeueOutboxEvent("e1", false)],
  ])("calls the database's refusal of a non-advisor %s a lack of advisor access", async (_what, run) => {
    failWith({ code: "42501", message: "Advisor access required" });
    const err = await caught(run);
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.forbidden).toBe(true);
    expect(err.message).toBe("You don't have advisor access.");
  });

  it("says the session ended, for a lapsed token, so the page can send the advisor to sign in", async () => {
    failWith({ code: "PGRST301", message: "JWT expired" });
    expect((await caught(() => requeueOutboxEvent("e1", false))).unauthenticated).toBe(true);
  });

  it("falls back to a specific message when a failure has none", async () => {
    failWith({ message: "" });
    expect((await caught(() => listOutboxEvents(null))).message).toBe("Couldn't load the outbox.");
    expect((await caught(() => outboxSummary())).message).toBe("Couldn't load the outbox counts.");
    expect((await caught(() => requeueOutboxEvent("e1", false))).message).toBe("Couldn't retry this notification.");
  });
});

describe("email problems API", () => {
  beforeEach(() => rpc.mockReset());

  it("reads the flagged submissions through the advisor-only function", async () => {
    rpc.mockResolvedValue({ data: [{ session_id: "s1", reason: "bounced", since: "2026-10-28T12:00:00Z" }], error: null });
    await expect(listEmailProblems()).resolves.toEqual([{ session_id: "s1", reason: "bounced", since: "2026-10-28T12:00:00Z" }]);
    expect(rpc).toHaveBeenLastCalledWith("advisor_email_problems");
  });

  it("treats an empty answer as none flagged", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(listEmailProblems()).resolves.toEqual([]);
  });

  it("calls the database's refusal of a non-advisor a lack of advisor access (HTTP 403)", async () => {
    failWith({ code: "42501", message: "Advisor access required" });
    const err = await caught(() => listEmailProblems());
    expect(err.forbidden).toBe(true);
    expect(err.message).toBe("You don't have advisor access.");
  });
});

describe("the submission queue", () => {
  beforeEach(() => rpc.mockReset());

  it("asks the database for one page, searched and filtered there", async () => {
    rpc.mockResolvedValue({ data: [{ session_id: "s26", total_count: 60 }], error: null });
    const page = await listSubmissions({ status: "won", search: "  acme  pat ", page: 2 });
    expect(rpc).toHaveBeenCalledWith("advisor_list_submissions", {
      p_status: "won", p_search: "acme  pat", p_limit: 25, p_offset: 25, p_needs_action: null, p_waiting: null, p_sort: null,
    });
    expect(page).toEqual({ rows: [{ session_id: "s26", total_count: 60 }], total: 60 });
  });

  it("asks for the first page with no search by default, and calls an empty page empty", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await listSubmissions({ status: null, search: "   ", page: 0 })).toEqual({ rows: [], total: 0 });
    expect(rpc).toHaveBeenCalledWith("advisor_list_submissions", {
      p_status: null, p_search: null, p_limit: 25, p_offset: 0, p_needs_action: null, p_waiting: null, p_sort: null,
    });
  });

  it("lists only the submissions that need advisor action when asked", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listSubmissions({ status: "under_review", needsAction: true });
    expect(rpc).toHaveBeenCalledWith("advisor_list_submissions", {
      p_status: "under_review", p_search: null, p_limit: 25, p_offset: 0, p_needs_action: true, p_waiting: null, p_sort: null,
    });
  });
});

describe("needs advisor action", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: {}, error: null }));

  it("raises it with a trimmed note, and clears it with none", async () => {
    await setNeedsAction("s1", true, "  Call the CFO  ");
    expect(rpc).toHaveBeenCalledWith("set_submission_needs_action", { p_session_id: "s1", p_needs_action: true, p_note: "Call the CFO" });
    await setNeedsAction("s1", false, "   ");
    expect(rpc).toHaveBeenCalledWith("set_submission_needs_action", { p_session_id: "s1", p_needs_action: false, p_note: null });
  });

  it("reports a refusal", async () => {
    failWith({ message: "A needs-advisor-action note is limited to 500 characters", code: "22023" });
    const err = await caught(() => setNeedsAction("s1", true, "x"));
    expect(err.message).toMatch(/500 characters/);
  });
});

describe("reviews name the answer they were made on", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: {}, error: null }));

  it("sends the stored answer the advisor saw", async () => {
    await reviewField("s1", "states", "verified", { kind: "keep" }, "", ["CA", "NY"]);
    expect(rpc).toHaveBeenCalledWith("review_submission_field", {
      p_session_id: "s1",
      p_field: "states",
      p_review_state: "verified",
      p_correction: "keep",
      p_value: null,
      p_reason: null,
      p_answer: { value: ["CA", "NY"] },
    });
  });

  it("tells a missing answer from a null one", async () => {
    await reviewField("s1", "industry", "follow_up", { kind: "keep" }, "", undefined);
    expect(rpc.mock.calls[0][1].p_answer).toEqual({});
    await reviewField("s1", "industry", "follow_up", { kind: "keep" }, "", null);
    expect(rpc.mock.calls[1][1].p_answer).toEqual({ value: null });
  });

  it("passes on the database's refusal of a stale review with its code, so the page can reload", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "The prospect changed this answer after the page was loaded; review the current answer", code: "PT409" } });
    const err = await caught(() => reviewField("s1", "company_name", "verified", { kind: "keep" }, "", "Acme"));
    expect(err.code).toBe("PT409");
    expect(err.message).toMatch(/changed this answer/);
  });
});

describe("a Manuscript version names the certification it was built from", () => {
  const opts = {
    sessionId: "s1",
    version: 2,
    // jsdom's Blob can't be read back; Node's can, as a browser's can.
    pdf: new NodeBlob(["%PDF-1.4"]) as unknown as Blob,
    reviewEventId: 9,
    correctionsApplied: 1,
    sensitiveRevealed: false,
    certifiedDataHash: "c".repeat(64),
    certifiedAt: "2026-10-01T12:00:05.123456+00:00",
  };
  beforeEach(() => {
    rpc.mockReset();
    upload.mockReset().mockResolvedValue({ data: {}, error: null });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("sends the certification's hash and time with the version", async () => {
    rpc.mockResolvedValue({ data: { id: "v2" }, error: null });
    await saveManuscriptVersion(opts);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("record_manuscript_version");
    expect(args).toMatchObject({
      p_session_id: "s1",
      p_version: 2,
      p_review_event_id: 9,
      p_certified_data_hash: "c".repeat(64),
      p_certified_at: "2026-10-01T12:00:05.123456+00:00",
    });
    expect(args.p_storage_path).toMatch(/^s1\/v2-/);
    expect(args.p_pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(remove).not.toHaveBeenCalled();
  });

  it("sends null, not nothing, for a certification from before the database stamped one", async () => {
    rpc.mockResolvedValue({ data: { id: "v2" }, error: null });
    await saveManuscriptVersion({ ...opts, certifiedDataHash: null, certifiedAt: null });
    const args = rpc.mock.calls[0][1];
    expect(args).toHaveProperty("p_certified_data_hash", null);
    expect(args).toHaveProperty("p_certified_at", null);
  });

  it("removes the uploaded file when the database refuses the version, and reports the refusal's code", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "The prospect certified their intake again while this packet was being generated; generate it again", code: "PT409" },
    });
    const err = await caught(() => saveManuscriptVersion(opts));
    expect(err.code).toBe("PT409");
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });
});

describe("loadSubmission", () => {
  const live = { company_name: "Live Co", employee_count: 30 };
  const certifiedData = { company_name: "  Signed Co  ", employee_count: 12 };
  const doc = (id: string) => ({
    id, file_name: `${id}.pdf`, file_size: "1 KB", category: "other", status: "uploaded",
    storage_path: `p/s1/${id}.pdf`, created_at: `2026-10-0${id.slice(-1)}T00:00:00Z`,
  });
  const row = (over: Record<string, unknown> = {}) => ({
    id: "s1", user_id: "p", chamber_data: live, field_provenance: {}, status: "submitted",
    transcript: [{ id: "m1", sender: "user", text: "rewritten later" }],
    created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-05T00:00:00Z",
    submission: {
      signer_name: "Jo", signer_title: "CEO", signed_at: "2026-10-02T00:00:00Z", file_id: "EAA-1",
      chamber_data: certifiedData, field_provenance: {},
      transcript: [{ id: "m1", sender: "user", text: "as certified" }],
      documents: [doc("d1"), doc("d2")],
    },
    ...over,
  });
  beforeEach(() => {
    for (const k of Object.keys(tables)) delete tables[k];
    tables.submission_workflow = [{ status: "under_review" }];
    tables.documents = [doc("d1"), doc("d3")];
  });

  it("shows a certified intake as certified: its answers, its stored answers, its conversation and its documents", async () => {
    tables.chamber_sessions = [row()];
    const d = (await loadSubmission("s1"))!;
    expect(d.certified).toBe(true);
    expect(d.data.company_name).toBe("Signed Co");
    // Exactly as stored, untidied: a review names this to the database.
    expect(d.storedAnswers).toEqual(certifiedData);
    expect(d.transcript.map((m) => m.text)).toEqual(["as certified"]);
    expect(d.transcriptChangedSinceCertified).toBe(true);
    expect(d.documents.map((x) => [x.id, x.certification])).toEqual([["d3", "added"], ["d2", "removed"], ["d1", "certified"]]);
    expect(d.pipelineStatus).toBe("under_review");
    expect(d.needsAction).toEqual({ on: false, note: null, at: null, by: null, byEmail: null });
  });

  it("reads whether the submission needs advisor action, and who said so", async () => {
    tables.chamber_sessions = [row()];
    tables.submission_workflow = [{
      status: "under_review", needs_action: true, needs_action_note: "Call the CFO",
      needs_action_at: "2026-11-04T10:00:00Z", needs_action_by: "a1", needs_action_by_email: "adv@example.com",
    }];
    const d = (await loadSubmission("s1"))!;
    expect(d.needsAction).toEqual({ on: true, note: "Call the CFO", at: "2026-11-04T10:00:00Z", by: "a1", byEmail: "adv@example.com" });
  });

  it("shows an intake whose certification was withdrawn as it stands now", async () => {
    tables.chamber_sessions = [row({ status: "in_progress" })];
    const d = (await loadSubmission("s1"))!;
    expect(d.certified).toBe(false);
    expect(d.storedAnswers).toEqual(live);
    expect(d.transcript.map((m) => m.text)).toEqual(["rewritten later"]);
    expect(d.transcriptChangedSinceCertified).toBe(false);
    expect(d.documents.map((x) => x.certification)).toEqual([undefined, undefined]);
  });

  it("shows a withdrawn certification as the database recorded it, not as the intake's submission now says", async () => {
    // A submission rewritten after the certification was withdrawn (possible before 20261106090000).
    tables.chamber_sessions = [row({
      status: "in_progress",
      file_id: null,
      submission: { signer_name: "Somebody Else", certified_at: "2025-11-01T00:00:00Z", file_id: "EAA-FORGED", chamber_data: { company_name: "Forged", employee_count: 500 } },
    })];
    tables.chamber_certifications = [{
      file_id: "EAA-1", signer_name: "Jo", signed_at: "2026-10-02T00:00:00Z", recorded_at: "2026-10-02T00:00:05Z", chamber_data: certifiedData,
    }];
    const d = (await loadSubmission("s1"))!;
    expect(d.certified).toBe(false);
    expect(d.signed).toEqual({ data: expect.objectContaining({ company_name: "Signed Co", employee_count: 12 }), signedAt: "2026-10-02T00:00:05Z", provenance: {}, documents: expect.any(Array), extraAnswers: null });
    expect(d.fileId).toBe("EAA-1");
  });

  it("keeps what a withdrawn certification covered: its field status and its documents, set against the documents now", async () => {
    tables.chamber_sessions = [row({ status: "in_progress" })];
    const inferred = { status: "inferred", source: { kind: "prospect_edit" }, updated_at: "2026-10-02T00:00:00Z" };
    tables.chamber_certifications = [{
      file_id: "EAA-1", version: 2, signed_at: "2026-10-02T00:00:00Z", recorded_at: "2026-10-02T00:00:05Z", chamber_data: certifiedData,
      field_provenance: { employee_count: inferred }, documents: [doc("d1"), doc("d2")],
    }];
    const d = (await loadSubmission("s1"))!;
    expect(d.signed?.provenance).toEqual({ employee_count: inferred });
    expect(d.signed?.documents.map((x) => [x.id, x.certification])).toEqual([["d3", "added"], ["d2", "removed"], ["d1", "certified"]]);
    expect(d.currentVersion).toBe(2);
  });

  it("reads the extra answers of the last certified version: the submission's while it stands, else the certification record's", async () => {
    const drives = (value: boolean) => ({ "7": { vehicles: { question: "Do employees drive for work?", kind: "yes_no", value, status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-02T00:00:00Z" } } });
    tables.chamber_sessions = [row({ extra_answers: drives(false), submission: { ...row().submission, extra_answers: drives(true) } })];
    expect((await loadSubmission("s1"))!.extraAnswers).toEqual(drives(true));
    tables.chamber_sessions = [row({ status: "in_progress", extra_answers: drives(false) })];
    tables.chamber_certifications = [{ file_id: "EAA-1", version: 2, signed_at: "2026-10-02T00:00:00Z", recorded_at: "2026-10-02T00:00:05Z", chamber_data: certifiedData,
      field_provenance: {}, documents: [], extra_answers: drives(true) }];
    const withdrawn = (await loadSubmission("s1"))!;
    expect(withdrawn.extraAnswers).toEqual(drives(false));
    expect(withdrawn.signed?.extraAnswers).toEqual(drives(true));
    // A certification from before extra answers were kept: what it held of them can't be told (null), never "none".
    tables.chamber_certifications = [{ ...tables.chamber_certifications[0] as object, extra_answers: null }];
    expect((await loadSubmission("s1"))!.signed?.extraAnswers).toBeNull();
    tables.chamber_sessions = [row({ extra_answers: drives(false) })];
    expect((await loadSubmission("s1"))!.extraAnswers).toBeNull();
  });

  it("says when the certification on record kept no field status or no document list, so nothing can be told from it", async () => {
    const withdrawn = (over: object) => {
      tables.chamber_sessions = [row({ status: "in_progress" })];
      tables.chamber_certifications = [{ file_id: "EAA-1", version: 2, signed_at: "2026-10-02T00:00:00Z", recorded_at: "2026-10-02T00:00:05Z", chamber_data: certifiedData, ...over }];
      return loadSubmission("s1").then((d) => d!.certificationLacksSnapshot);
    };
    expect(await withdrawn({ field_provenance: {}, documents: [] })).toBe(false);
    expect(await withdrawn({ field_provenance: null, documents: [] })).toBe(true);
    expect(await withdrawn({ field_provenance: {}, documents: null })).toBe(true);
    // A certification that stands is read from the submission, which can be as old.
    tables.chamber_sessions = [row()];
    expect((await loadSubmission("s1"))!.certificationLacksSnapshot).toBe(false);
    tables.chamber_sessions = [row({ submission: { ...row().submission, documents: undefined } })];
    expect((await loadSubmission("s1"))!.certificationLacksSnapshot).toBe(true);
    tables.chamber_sessions = [row({ submission: { ...row().submission, field_provenance: undefined } })];
    expect((await loadSubmission("s1"))!.certificationLacksSnapshot).toBe(true);
  });

  it("shows nothing as signed for an intake that was never certified, whatever its submission says", async () => {
    tables.chamber_sessions = [row({ status: "in_progress", file_id: null })];
    tables.chamber_certifications = [];
    const d = (await loadSubmission("s1"))!;
    expect(d.signed).toBeNull();
    expect(d.fileId).toBeNull();
  });

  it("uses the live conversation and documents for a certification from before they were kept", async () => {
    const r = row();
    const { transcript: _t, documents: _d, ...older } = r.submission;
    tables.chamber_sessions = [{ ...r, submission: older }];
    const d = (await loadSubmission("s1"))!;
    expect(d.transcript.map((m) => m.text)).toEqual(["rewritten later"]);
    expect(d.transcriptChangedSinceCertified).toBe(false);
    expect(d.documents.map((x) => x.id)).toEqual(["d1", "d3"]);
  });

  it("is nothing for an intake the caller can't see", async () => {
    tables.chamber_sessions = [];
    expect(await loadSubmission("s1")).toBeNull();
  });

describe("quote requests", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: {}, error: null });
    for (const k of Object.keys(tables)) delete tables[k];
  });

  it("loads the submission's quote requests, their history and the latest certified version with the detail", async () => {
    tables.chamber_sessions = [{ id: "s1", user_id: "p1", chamber_data: {}, field_provenance: {}, transcript: [], status: "submitted",
      submission: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", file_id: "EAA-2026-0001" }];
    tables.submission_workflow = [{ status: "quoted", won_quote_request_id: null }];
    tables.quote_requests = [{ id: 7, peo_name: "TriNet", status: "quoted" }];
    tables.quote_request_events = [{ id: 3, quote_request_id: 7, field: "status" }];
    tables.quote_request_notes = [{ id: 21, quote_request_id: 7, kind: "call" }];
    tables.quote_request_messages = [{ id: 41, quote_request_id: 7, direction: "received" }];
    tables.quote_request_message_attachments = [{ id: 51, message_id: 41, status: "stored" }];
    tables.quote_request_thread_reads = [{ quote_request_id: 7, last_opened_at: "2026-11-10T16:00:00+00:00" }];
    tables.quote_request_addresses = [{ id: 31, quote_request_id: 7, local_part: "eaa-2026-0001.trinet.0123456789abcdef", revoked_at: null }];
    tables.chamber_certifications = [{ file_id: "EAA-2026-0001", version: 3, signed_at: null, recorded_at: null, chamber_data: null }];
    const d = (await loadSubmission("s1"))!;
    expect(d.quoteRequests).toEqual([{ id: 7, peo_name: "TriNet", status: "quoted" }]);
    expect(d.quoteRequestEvents).toEqual([{ id: 3, quote_request_id: 7, field: "status" }]);
    expect(d.quoteRequestNotes).toEqual([{ id: 21, quote_request_id: 7, kind: "call" }]);
    expect(d.quoteRequestMessages).toEqual([{ id: 41, quote_request_id: 7, direction: "received" }]);
    expect(d.quoteRequestMailAttachments).toEqual([{ id: 51, message_id: 41, status: "stored" }]);
    expect(d.quoteRequestThreadReads).toEqual([{ quote_request_id: 7, last_opened_at: "2026-11-10T16:00:00+00:00" }]);
    expect(d.quoteRequestAddresses).toEqual([{ id: 31, quote_request_id: 7, local_part: "eaa-2026-0001.trinet.0123456789abcdef", revoked_at: null }]);
    expect(d.currentVersion).toBe(3);
  });

  it("records a send, an answer and a note through the advisor functions", async () => {
    await recordQuoteSend("s1", "TriNet", "2026-11-10");
    expect(rpc).toHaveBeenLastCalledWith("advisor_record_quote_send", { p_session_id: "s1", p_peo: "TriNet", p_sent_on: "2026-11-10" });
    await updateQuoteRequest(7, { status: "quoted", receivedOn: "2026-11-14", expiresOn: "2026-12-14", startOn: null, adminFeePepm: 145.5, note: null });
    expect(rpc).toHaveBeenLastCalledWith("advisor_update_quote_request", {
      p_quote_request_id: 7, p_status: "quoted", p_received_on: "2026-11-14", p_expires_on: "2026-12-14", p_start_on: null,
      p_admin_fee_pepm: 145.5, p_note: null,
    });
    await addQuoteRequestNote(7, { kind: "underwriter_question", notedOn: "2026-11-12", body: "  Loss runs?  " });
    expect(rpc).toHaveBeenLastCalledWith("advisor_add_quote_request_note", {
      p_quote_request_id: 7, p_kind: "underwriter_question", p_noted_on: "2026-11-12", p_body: "Loss runs?",
    });
    await openQuoteRequestThread(7, "2026-11-10T16:30:00.654321+00:00");
    expect(rpc).toHaveBeenLastCalledWith("advisor_open_quote_request_thread", { p_quote_request_id: 7, p_seen_through: "2026-11-10T16:30:00.654321+00:00" });
    await reissueQuoteRequestAddress(7);
    expect(rpc).toHaveBeenLastCalledWith("advisor_reissue_quote_request_address", { p_quote_request_id: 7 });
    await correctQuoteRequestNote(21, { kind: "call", notedOn: "2026-11-11", body: "Loss runs, three years." });
    expect(rpc).toHaveBeenLastCalledWith("advisor_correct_quote_request_note", {
      p_note_id: 21, p_kind: "call", p_noted_on: "2026-11-11", p_body: "Loss runs, three years.",
    });
  });

  it("opens a PEO mail attachment through a signed link from the peo-mail bucket, as a download under its own name", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://files.example/signed" }, error: null });
    await expect(mailAttachmentUrl({ storage_path: "s1/41/51-proposal.pdf", file_name: "proposal.pdf" })).resolves.toBe("https://files.example/signed");
    expect(createSignedUrl).toHaveBeenCalledWith("peo-mail", "s1/41/51-proposal.pdf", expect.any(Number), { download: "proposal.pdf" });
  });

  it("won't try to open an attachment with no stored file", () => {
    createSignedUrl.mockReset();
    expect(() => mailAttachmentUrl({ storage_path: null, file_name: "invoice.pdf" })).toThrow(/blocked, not kept, or is still being checked/);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("names the winning quote when marking a submission won, and nothing otherwise", async () => {
    await setStatus("s1", "won", " Signed ", 7);
    expect(rpc).toHaveBeenLastCalledWith("set_submission_status", { p_session_id: "s1", p_status: "won", p_note: "Signed", p_won_quote_request_id: 7 });
    await setStatus("s1", "lost", "", 7);
    expect(rpc).toHaveBeenLastCalledWith("set_submission_status", { p_session_id: "s1", p_status: "lost", p_note: null, p_won_quote_request_id: null });
  });

  it("asks the queue for only the submissions waiting on a PEO, sorted by the longest wait or the earliest expiry", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listSubmissions({ status: null, waiting: true, sort: "oldest_waiting" });
    expect(rpc).toHaveBeenLastCalledWith("advisor_list_submissions", expect.objectContaining({ p_waiting: true, p_sort: "oldest_waiting" }));
    await listSubmissions({ status: null });
    expect(rpc).toHaveBeenLastCalledWith("advisor_list_submissions", expect.objectContaining({ p_waiting: null, p_sort: null }));
  });
});
});

describe("the PEOs page's reads and writes", () => {
  beforeEach(() => {
    rpc.mockReset();
    for (const t of Object.keys(tables)) delete tables[t];
  });

  it("learns whether the signed-in advisor is an admin from the database's own role check", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await fetchIsAdmin()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("has_role", { _role: "admin" });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await fetchIsAdmin()).toBe(false);
  });

  it("reads each PEO with its versions, newest first, and each version's contacts", async () => {
    tables.peos = [{ id: 1, name: "TriNet", listed: true }, { id: 2, name: "Justworks", listed: false }];
    tables.peo_profile_versions = [
      { id: 10, peo_id: 1, version: 1, status: "published", published_at: "2026-11-01T00:00:00Z", created_at: "2026-10-30T00:00:00Z", min_headcount: 5,
        sources: { min_headcount: { kind: "document", name: "Guide", checked_on: "2026-10-30" } } },
      { id: 11, peo_id: 1, version: 2, status: "draft", published_at: null, created_at: "2026-11-05T00:00:00Z", min_headcount: 10, sources: {} },
    ];
    tables.peo_contacts = [{ profile_version_id: 10, position: 1, name: "Dana Reyes", role: "Broker desk", email: null, phone: null }];
    // Alphabetical, whatever order the rows come in.
    const [justworks, trinet] = await loadPeoDirectory();
    expect(trinet).toMatchObject({ id: 1, name: "TriNet", listed: true });
    expect(trinet.versions.map((v) => [v.version, v.status, v.profile.rules.minHeadcount, v.profile.contacts.map((c) => c.name)])).toEqual([
      [2, "draft", 10, []],
      [1, "published", 5, ["Dana Reyes"]],
    ]);
    expect(justworks).toMatchObject({ id: 2, name: "Justworks", listed: false, versions: [] });
  });

  it("reads only the contacts of each PEO's version in use and its draft; an older version's on request, for its history", async () => {
    inFilters.length = 0;
    tables.peos = [{ id: 1, name: "TriNet", listed: true }];
    const published = (id: number, version: number) => ({ id, peo_id: 1, version, status: "published", published_at: "2026-11-01T00:00:00Z", created_at: "2026-10-30T00:00:00Z", sources: {} });
    tables.peo_profile_versions = [published(10, 1), published(11, 2), { id: 12, peo_id: 1, version: 3, status: "draft", revision: "r3", published_at: null, created_at: "2026-11-05T00:00:00Z", sources: {} }];
    tables.peo_contacts = [10, 11, 12].map((id) => ({ profile_version_id: id, position: 1, name: `Contact of ${id}`, role: null, email: null, phone: null }));
    const [trinet] = await loadPeoDirectory();
    expect(inFilters).toEqual([{ table: "peo_contacts", column: "profile_version_id", values: [12, 11] }]);
    expect(trinet.versions.map((v) => [v.version, v.revision, v.profile.contacts.map((c) => c.name)])).toEqual([
      [3, "r3", ["Contact of 12"]], [2, null, ["Contact of 11"]], [1, null, []],
    ]);
    const history = await loadVersionContacts([11, 10]);
    expect(history.get(10)).toEqual([{ name: "Contact of 10", role: null, email: null, phone: null }]);
    expect(history.get(11)).toEqual([{ name: "Contact of 11", role: null, email: null, phone: null }]);
  });

  it("asks for contacts a bounded number of versions at a time", async () => {
    inFilters.length = 0;
    tables.peo_contacts = [];
    await loadVersionContacts(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(inFilters.map((f) => f.values.length)).toEqual([40, 5]);
    inFilters.length = 0;
    expect(await loadVersionContacts([])).toEqual(new Map());
    expect(inFilters).toEqual([]);
  });

  it("saves the whole draft, and records a re-check with the new sources, as the database takes them", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await savePeoDraft(1, { neededToQuote: [], neededBeforeSigning: [], censusLayout: null, documents: [], extraQuestions: [], contacts: [],
      rules: { minHeadcount: 5, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
      sources: { min_headcount: { kind: "document", name: "Guide", checkedOn: "2026-11-01" } } }, { draftRevision: "r3", inUseVersion: 2 });
    expect(rpc).toHaveBeenCalledWith("admin_save_peo_profile", { p_peo_id: 1, p_draft_revision: "r3", p_in_use_version: 2, p_profile: expect.objectContaining({
      min_headcount: 5, sources: { min_headcount: { kind: "document", name: "Guide", checked_on: "2026-11-01" } } }) });
    await publishPeoDraft(1, "r3");
    expect(rpc).toHaveBeenLastCalledWith("admin_publish_peo_profile", { p_peo_id: 1, p_draft_revision: "r3" });
    await recheckPeoProfile(1, ["min_headcount", "answers"], { kind: "person", name: "Dana Reyes", role: "Broker desk", checkedOn: "2026-11-10" });
    const source = { kind: "person", name: "Dana Reyes", role: "Broker desk", checked_on: "2026-11-10" };
    expect(rpc).toHaveBeenLastCalledWith("admin_recheck_peo_profile", { p_peo_id: 1, p_sources: { min_headcount: source, answers: source } });
  });

  it("shows the database's own words when it refuses a save", async () => {
    failWith({ message: "A census file is CSV or xlsx", code: "22023" });
    const err = await caught(() => savePeoDraft(1, { neededToQuote: [], neededBeforeSigning: [], censusLayout: null, documents: [], extraQuestions: [], contacts: [],
      rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null }, sources: {} }, { draftRevision: null, inUseVersion: null }));
    expect(err.message).toBe("A census file is CSV or xlsx");
  });
});

describe("documentFile: an uploaded document's file, for a bundle", () => {
  beforeEach(() => {
    download.mockReset();
    buckets.length = 0;
  });

  it("reads the file from the documents bucket by its path, on the caller's own storage rights", async () => {
    const file = new Blob(["%PDF"]);
    download.mockResolvedValue({ data: file, error: null });
    expect(await documentFile({ storage_path: "u1/loss-runs.pdf" })).toBe(file);
    expect(buckets).toEqual(["documents"]);
    expect(download).toHaveBeenCalledWith("u1/loss-runs.pdf");
  });

  it("fails with a fixed message, never the path, when storage refuses it (a blocked or unscanned file)", async () => {
    download.mockResolvedValue({ data: null, error: { message: "Object not found: u1/loss-runs.pdf" } });
    const err = await caught(() => documentFile({ storage_path: "u1/loss-runs.pdf" }));
    expect(err.message).toBe("Couldn't open that file.");
  });

  it("says the session ended, for a lapsed token, so the page can send the advisor to sign in", async () => {
    download.mockResolvedValue({ data: null, error: { message: "jwt expired" } });
    const err = await caught(() => documentFile({ storage_path: "u1/loss-runs.pdf" }));
    expect(err.message).toBe("Your session has expired. Sign in again to continue.");
    expect(err.unauthenticated).toBe(true);
  });
});
