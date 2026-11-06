import { Blob as NodeBlob } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
/** Rows each table returns to the detail page's queries, which are all select/eq/order chains. */
const tables: Record<string, unknown[]> = {};
const query = (table: string) => {
  const result = () => ({ data: tables[table] ?? [], error: null });
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
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
    storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a), remove: (...a: unknown[]) => remove(...a) }) },
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
      p_status: "won", p_search: "acme  pat", p_limit: 25, p_offset: 25, p_needs_action: null,
    });
    expect(page).toEqual({ rows: [{ session_id: "s26", total_count: 60 }], total: 60 });
  });

  it("asks for the first page with no search by default, and calls an empty page empty", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await listSubmissions({ status: null, search: "   ", page: 0 })).toEqual({ rows: [], total: 0 });
    expect(rpc).toHaveBeenCalledWith("advisor_list_submissions", {
      p_status: null, p_search: null, p_limit: 25, p_offset: 0, p_needs_action: null,
    });
  });

  it("lists only the submissions that need advisor action when asked", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listSubmissions({ status: "under_review", needsAction: true });
    expect(rpc).toHaveBeenCalledWith("advisor_list_submissions", {
      p_status: "under_review", p_search: null, p_limit: 25, p_offset: 0, p_needs_action: true,
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
      error: { message: "The prospect certified their intake again while this Manuscript was being generated; generate it again", code: "PT409" },
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
    expect(d.signed).toEqual({ data: expect.objectContaining({ company_name: "Signed Co", employee_count: 12 }), signedAt: "2026-10-02T00:00:05Z" });
    expect(d.fileId).toBe("EAA-1");
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
});
