import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type MockError = { message: string; code?: string; details?: string | null };
// `data` is the rows the update returned; left out, a successful update returns the row it changed,
// one version on from the version it asked for.
type UpdateResult = { error: MockError | null; data?: Record<string, unknown>[] };

const updates: {
  payload: Record<string, unknown>;
  filters: Record<string, unknown>;
  columns: string;
  resolve: (r: UpdateResult) => void;
}[] = [];
// The row as the server has it: what resuming loads, and what is read back after an update matched nothing.
let resumeRow: Record<string, unknown> | null = null;
let readError: MockError | null = null;
const reads: string[] = [];
// The intake ids those reads asked for.
const readIds: unknown[] = [];
let inserts = 0;
const insertedRows: Record<string, unknown>[] = [];
const insertedColumns: string[] = [];
let insertError: { message: string; code?: string; details?: string } | null = null;
// When the server says a new intake was created.
let insertedCreatedAt = "2026-05-01T12:00:00Z";
// The prospect's latest unfinished intake, as the lookup on a bare /start finds it.
let latestRow: { id: string; status?: string } | null = null;
let latestError: { message: string } | null = null;
// What the second lookup (no unfinished intake) finds among expired and submitted intakes.
let lastClosedRow: { id: string; status: string } | null = null;
const latestQueries: unknown[][] = [];
// Calls to archive_chamber_session, and what it answers.
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcResult: { data: unknown; error: MockError | null } = { data: "archived", error: null };
// While set, reading the verified fields waits until a test answers it (in the order the reads were made).
let deferVerifiedRead = false;
const pendingVerifiedReads: ((value: { data: unknown; error: MockError | null }) => void)[] = [];
// The sign-in this browser holds, and what refreshing it gives (QA F2): access tokens whose is_anonymous claim says
// guest or not. None by default, so certifying goes straight to the database as before.
let heldToken: string | null = null;
let refreshedToken: string | null = null;
let refreshes = 0;
const token = (isAnonymous: boolean) => `header.${btoa(JSON.stringify({ sub: "u1", is_anonymous: isAnonymous })).replace(/=+$/, "")}.signature`;

// Who is signed in. A test can switch it and rerender, as signing in with an emailed code does.
let authUserId = "u1";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: authUserId }, session: { access_token: "tok" } }) }));
vi.mock("@/lib/dispatchOutbox", () => ({ dispatchOutbox: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: heldToken ? { access_token: heldToken } : null } }),
      refreshSession: async () => {
        refreshes += 1;
        if (refreshedToken) heldToken = refreshedToken;
        return refreshedToken ? { data: { session: { access_token: refreshedToken } }, error: null } : { data: { session: null }, error: { message: "refresh failed" } };
      },
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (deferVerifiedRead && fn === "session_verified_fields") return new Promise((resolve) => { pendingVerifiedReads.push(resolve as never); });
      return Promise.resolve(rpcResult);
    },
    from: () => ({
      select: (columns: string) => ({
        eq: (column: string, value: unknown) =>
          column === "id"
            ? {
                maybeSingle: async () => {
                  reads.push(columns);
                  readIds.push(value);
                  // A fixture is the signed-in person's own intake unless it names another owner.
                  return readError ? { data: null, error: readError } : { data: resumeRow && { user_id: authUserId, ...resumeRow }, error: null };
                },
              }
            : {
                in: (inColumn: string, inValues: string[]) => ({
                  order: (orderColumn: string, order: unknown) => ({
                    limit: (n: number) => ({
                      maybeSingle: async () => {
                        latestQueries.push([column, value, inColumn, inValues, orderColumn, order, n]);
                        if (latestError) return { data: null, error: latestError };
                        return { data: inValues.includes("in_progress") ? latestRow : lastClosedRow, error: null };
                      },
                    }),
                  }),
                }),
              },
      }),
      insert: (row: Record<string, unknown>) => {
        inserts += 1;
        insertedRows.push(row);
        return {
          select: (columns: string) => {
            insertedColumns.push(columns);
            return {
              single: async () =>
                insertError
                  ? { data: null, error: insertError }
                  : { data: { id: "s1", data_version: 1, file_id: null, created_at: insertedCreatedAt }, error: null },
            };
          },
        };
      },
      update: (payload: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const chain = {
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return chain;
          },
          select: (columns: string) =>
            new Promise<{ data: Record<string, unknown>[] | null; error: MockError | null }>((resolve) =>
              updates.push({
                payload,
                filters,
                columns,
                resolve: (r) =>
                  resolve({
                    error: r.error,
                    data: r.error
                      ? null
                      : (r.data ?? [{ id: filters.id, data_version: (filters.data_version as number) + 1, status: payload.status ?? "in_progress" }]),
                  }),
              })),
        };
        return chain;
      },
    }),
  },
}));

const { useChamberSession, describeInvalidPath, VERIFY_EMAIL_MESSAGE } = await import("./useChamberSession");
const { dispatchOutbox } = await import("@/lib/dispatchOutbox");
const { applyExtraction } = await import("@/data/provenance");
const { parseChamberData } = await import("@/data/chamberValidation");
const { createChatMessage, OPENING_MESSAGE } = await import("@/data/chat");
const { readBackup, writeBackup } = await import("@/data/intakeBackup");
const { captureIntakeSource } = await import("@/data/intakeSource");

// Lets queued promise callbacks run while fake timers are active (waitFor would hang).
const drain = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

type SubmitResult = boolean | { message: string; verifyEmail?: boolean; errorCode?: string };

// A failure nothing else explains: it carries an error code the message quotes (QA F2).
const UNEXPLAINED = expect.objectContaining({ errorCode: expect.stringMatching(/^[A-Z]{8}$/), message: expect.stringMatching(/error code [A-Z]{8}/) });

/**
 * Waits for the hook to finish looking for an intake, then has the prospect start one (A-1: nothing is created
 * until they do something; ensureIntake is what their first change calls). An intake that was opened is kept.
 */
const startIntake = async (result: { current: ReturnType<typeof useChamberSession> }) => {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => { await result.current.ensureIntake(); });
  await waitFor(() => expect(result.current.sessionId).toBe("s1"));
};

// The saved row as another tab (or the server) has it.
const serverRow = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  data_version: 5,
  status: "in_progress",
  chamber_data: { company_name: "Elsewhere Inc" },
  field_provenance: {},
  transcript: [],
  submission: null,
  created_at: "2026-05-01T12:00:00Z",
  ...over,
});

const networkError: MockError = { message: "Failed to fetch" };

const submission = { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-01-01T00:00:00Z", file_id: "EAA-1" };

describe("useChamberSession", () => {
  beforeEach(() => {
    updates.length = 0;
    resumeRow = null;
    readError = null;
    reads.length = 0;
    readIds.length = 0;
    insertedColumns.length = 0;
    inserts = 0;
    insertedRows.length = 0;
    insertError = null;
    insertedCreatedAt = "2026-05-01T12:00:00Z";
    latestRow = null;
    latestError = null;
    lastClosedRow = null;
    latestQueries.length = 0;
    rpcCalls.length = 0;
    deferVerifiedRead = false;
    pendingVerifiedReads.length = 0;
    rpcResult = { data: "archived", error: null };
    authUserId = "u1";
    heldToken = null;
    refreshedToken = null;
    refreshes = 0;
    localStorage.clear();
    vi.mocked(dispatchOutbox).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for an in-flight autosave before submitting", async () => {
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);

    vi.useFakeTimers();
    act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(updates).toHaveLength(1); // autosave started, still pending

    let submitted: SubmitResult | undefined;
    const pending = result.current.submit(submission).then((ok) => { submitted = ok; });
    await drain();
    expect(updates).toHaveLength(1); // submit is waiting, not racing ahead

    updates[0].resolve({ error: null });
    await drain();
    expect(updates).toHaveLength(2);
    expect(updates[1].payload).toMatchObject({ status: "submitted" });
    await act(async () => { updates[1].resolve({ error: null }); await pending; });
    expect(submitted).toBe(true);
  });

  it("re-saves and blocks submission when the in-flight autosave fails", async () => {
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);

    vi.useFakeTimers();
    act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
    await act(async () => { vi.advanceTimersByTime(2000); });

    let submitted: SubmitResult | undefined;
    const pending = result.current.submit(submission).then((ok) => { submitted = ok; });
    await drain();
    updates[0].resolve({ error: { message: "offline" } });
    await drain();

    // The failed write is retried as part of submit rather than skipped.
    expect(updates).toHaveLength(2);
    expect(updates[1].payload).toHaveProperty("chamber_data");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { updates[1].resolve({ error: { code: "57014", message: "canceling statement due to statement timeout" } }); await pending; });
    expect(updates.some((u) => u.payload.status === "submitted")).toBe(false);
    // Code review (QA F2): a certification the save before it blocked gets an error code, not the bare generic message,
    // and every line logged is text, never an object.
    expect(submitted).toEqual(UNEXPLAINED);
    expect((submitted as { message: string }).message).toMatch(/^Something went wrong on our side \(error code [A-Z]{8}\)/);
    for (const call of consoleError.mock.calls) expect(call.every((arg) => typeof arg === "string"), JSON.stringify(call)).toBe(true);
    expect(consoleError.mock.calls.map(([line]) => line)).toContainEqual(expect.stringMatching(/^Failed to submit session, database code 57014 \(error code [A-Z]{8}\): \[number\]: canceling statement/));
    consoleError.mockRestore();
  });

  it("snapshots the signed data on submission", async () => {
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);
    act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));

    const pending = result.current.submit(submission);
    await waitFor(() => expect(updates).toHaveLength(1));
    updates[0].resolve({ error: null });
    await waitFor(() => expect(updates).toHaveLength(2));
    const signed = updates[1].payload.submission as { chamber_data: { company_name: string } };
    expect(signed.chamber_data.company_name).toBe("Acme");
    updates[1].resolve({ error: null });
    await act(async () => { await pending; });
  });

  it("saves pending edits with a keepalive request when the page unloads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);
    act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));

    window.dispatchEvent(new Event("beforeunload"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/rest/v1/chamber_sessions?id=eq.s1&data_version=eq.1");
    expect(init).toMatchObject({ method: "PATCH", keepalive: true });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string).chamber_data.company_name).toBe("Acme");
    fetchSpy.mockRestore();
  });

  it("saves field provenance with the data and snapshots it on submission", async () => {
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);
    act(() =>
      result.current.updateIntake((prev) =>
        applyExtraction(prev, { employee_count: 40 }, { source: { kind: "transcript", message_id: "m1" } }),
      ),
    );
    expect(result.current.chamberData.employee_count).toBe(40);
    expect(result.current.provenance.employee_count?.status).toBe("inferred");

    const pending = result.current.submit(submission);
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0].payload.field_provenance).toMatchObject({ employee_count: { status: "inferred" } });
    updates[0].resolve({ error: null });
    await waitFor(() => expect(updates).toHaveLength(2));
    expect(updates[1].payload.submission).toMatchObject({
      chamber_data: { employee_count: 40 },
      field_provenance: { employee_count: { source: { kind: "transcript", message_id: "m1" } } },
    });
    updates[1].resolve({ error: null });
    await act(async () => { await pending; });
  });

  it("restores field provenance when resuming a session", async () => {
    resumeRow = {
      id: "s9",
      data_version: 3,
      chamber_data: { employee_count: 40 },
      field_provenance: {
        employee_count: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-20T00:00:00Z" },
        bogus: { status: "confirmed" },
      },
      transcript: [],
    };
    const { result } = renderHook(() => useChamberSession("s9"));
    await waitFor(() => expect(result.current.sessionId).toBe("s9"));
    expect(result.current.provenance).toEqual({
      employee_count: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-20T00:00:00Z" },
    });
  });

  it("does not silently replace a session it was asked to resume but could not open", async () => {
    const { result } = renderHook(() => useChamberSession("old-session"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resumeFailed).toBe(true);
    expect(result.current.sessionId).toBeNull();
    expect(inserts).toBe(0);
  });

  it("won't open someone else's intake that row security lets this account read (an advisor following a prospect's link)", async () => {
    resumeRow = {
      id: "prospects-intake",
      user_id: "the-prospect",
      data_version: 4,
      status: "in_progress",
      chamber_data: { company_name: "Ravenwood Bindery LLC", employee_count: 12 },
      field_provenance: {},
      transcript: [{ id: "m1", sender: "user", text: "We have 12 employees.", timestamp: "2026-11-06T00:00:00Z" }],
    };
    const { result } = renderHook(() => useChamberSession("prospects-intake"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resumeFailed).toBe(true);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.chamberData.company_name ?? null).toBeNull();
    expect(inserts).toBe(0);
    // Nothing of the prospect's answers is kept in this browser.
    expect(Object.keys(localStorage).filter((k) => k.includes("prospects-intake"))).toEqual([]);
  });

  it("creates the intake with the codes of the link the visitor arrived by", async () => {
    captureIntakeSource("?ref=Acme-CFO&utm_campaign=Renewals+2027");
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);
    expect(insertedRows[0]).toMatchObject({ referral_code: "acme-cfo", utm_campaign: "renewals-2027" });
    // Only the codes there are: no column is sent for a tag the link didn't carry.
    expect(insertedRows[0]).not.toHaveProperty("utm_source");
  });

  it("creates the intake with no source columns when the visitor arrived by no tagged link", async () => {
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);
    for (const column of ["referral_code", "utm_source", "utm_medium", "utm_campaign"]) {
      expect(insertedRows[0]).not.toHaveProperty(column);
    }
  });

  it("starts a fresh session only once the prospect asks for one", async () => {
    const { result } = renderHook(() => useChamberSession("old-session"));
    await waitFor(() => expect(result.current.resumeFailed).toBe(true));

    act(() => result.current.startNew());
    await startIntake(result);
    expect(result.current.resumeFailed).toBe(false);
    expect(inserts).toBe(1);
  });

  describe("certification", () => {
    const certifiedRow = (status: string) => ({
      id: "s9",
      data_version: 3,
      // What certifying stores: the answers in full, as loading would rebuild them.
      chamber_data: parseChamberData({ company_name: "Acme" }),
      transcript: [],
      status,
      submission,
    });

    it("reports nothing certified for a new intake", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(result.current.certification).toEqual({ status: "none" });
    });

    it("loads a certified session as certified, and keeps it so when nothing actually changes", async () => {
      resumeRow = certifiedRow("submitted");
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.certification.status).toBe("certified"));

      act(() => result.current.setChamberData((prev) => ({ ...prev })));
      expect(result.current.certification.status).toBe("certified");
    });

    it("still calls a row certified when the database hands its answers back in another key order", async () => {
      const row = certifiedRow("submitted");
      resumeRow = { ...row, chamber_data: Object.fromEntries(Object.entries(row.chamber_data).reverse()) };
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.certification.status).toBe("certified"));
    });

    it("loads a row certified under looser rules as needing re-certification, as saving it would withdraw it", async () => {
      // Certified before the state list was enforced; loading drops what no longer passes.
      resumeRow = { ...certifiedRow("submitted"), chamber_data: { ...parseChamberData({ company_name: "Acme" }), states: ["WA", "BC"] } };
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));
      expect(result.current.chamberData.states).toEqual(["WA"]);
      expect(result.current.certification).toEqual({ status: "stale", submission });
    });

    it("requires re-certification as soon as certified answers change", async () => {
      resumeRow = certifiedRow("submitted");
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.certification.status).toBe("certified"));

      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme Inc" })));
      expect(result.current.certification).toEqual({ status: "stale", submission });
    });

    it("loads a session whose certification the database withdrew as needing re-certification", async () => {
      resumeRow = certifiedRow("in_progress");
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.certification.status).toBe("stale"));
    });

    it("becomes certified once the submission is saved, and not before", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);

      let ok: SubmitResult | undefined;
      const pending = result.current.submit(submission).then((r) => { ok = r; });
      await waitFor(() => expect(updates).toHaveLength(1));
      expect(result.current.certification.status).toBe("none");

      await act(async () => { updates[0].resolve({ error: null }); await pending; });
      expect(ok).toBe(true);
      expect(result.current.certification.status).toBe("certified");
    });

    it("certifies the exact answers on screen, even if the saved row was never re-written", async () => {
      resumeRow = { ...certifiedRow("in_progress"), submission: null, chamber_data: { company_name: "Acme" } };
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));

      const pending = result.current.submit(submission);
      await waitFor(() => expect(updates).toHaveLength(1));
      const payload = updates[0].payload as { chamber_data: unknown; submission: { chamber_data: unknown } };
      expect(payload.chamber_data).toEqual(payload.submission.chamber_data);
      expect(payload.chamber_data).toMatchObject({ company_name: "Acme", census: [] }); // normalized, not the sparse row
      await act(async () => { updates[0].resolve({ error: null }); await pending; });
    });

    it("stays uncertified when the submission fails to save", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      const pending = result.current.submit(submission);
      await waitFor(() => expect(updates).toHaveLength(1));
      await act(async () => { updates[0].resolve({ error: { message: "refused" } }); await pending; });
      expect(result.current.certification.status).toBe("none");
    });
  });

  it("refuses to certify answers that changed after they were signed", async () => {
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);
    const signedKey = JSON.stringify(result.current.chamberData);

    act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Changed Inc" })));
    let submitted: SubmitResult | undefined;
    const pending = result.current.submit(submission, signedKey).then((ok) => { submitted = ok; });
    await drain();
    await act(async () => { updates[0].resolve({ error: null }); await pending; });
    expect(submitted).toBe(false);
    expect(updates.some((u) => u.payload.status === "submitted")).toBe(false);
  });

  it("certifies when the answers still match what was signed", async () => {
    const { result } = renderHook(() => useChamberSession());
    await startIntake(result);
    act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
    const signedKey = JSON.stringify(result.current.chamberData);

    let submitted: SubmitResult | undefined;
    const pending = result.current.submit(submission, signedKey).then((ok) => { submitted = ok; });
    await drain();
    await act(async () => { updates[0].resolve({ error: null }); });
    await drain();
    await act(async () => { updates[1].resolve({ error: null }); await pending; });
    expect(submitted).toBe(true);
    expect(updates[1].payload).toMatchObject({ status: "submitted" });
  });
  describe("sending the submission notifications", () => {
    it("asks for them to be sent once the submission is confirmed", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));

      const pending = result.current.submit(submission);
      await drain();
      await act(async () => { updates[0].resolve({ error: null }); });
      await drain();
      expect(dispatchOutbox).not.toHaveBeenCalled(); // not before the server confirms
      await act(async () => { updates[1].resolve({ error: null }); await pending; });
      expect(dispatchOutbox).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the submission fails", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));

      let ok: SubmitResult | undefined;
      const pending = result.current.submit(submission).then((r) => { ok = r; });
      await drain();
      await act(async () => { updates[0].resolve({ error: null }); });
      await drain();
      await act(async () => { updates[1].resolve({ error: { message: "boom" } }); await pending; });
      expect(ok).toEqual(UNEXPLAINED);
      expect(dispatchOutbox).not.toHaveBeenCalled();
    });

    it("does nothing when the answers changed after they were signed", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      const signedKey = JSON.stringify(result.current.chamberData);

      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Changed Inc" })));
      const pending = result.current.submit(submission, signedKey);
      await drain();
      await act(async () => { updates[0].resolve({ error: null }); await pending; });
      expect(dispatchOutbox).not.toHaveBeenCalled();
    });
  });
  describe("picking up where the prospect left off", () => {
    const openRow = { id: "s7", data_version: 2, chamber_data: { company_name: "Acme" }, field_provenance: {}, transcript: [], status: "in_progress", submission: null };

    it("resumes their latest unfinished intake when no session is named", async () => {
      latestRow = { id: "s7" };
      resumeRow = openRow;
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.chamberData.company_name).toBe("Acme");
      expect(inserts).toBe(0);
    });

    it("looks only at the prospect's own unfinished intakes, most recently active first, then at whether the last one expired", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(latestQueries).toEqual([
        ["user_id", "u1", "status", ["in_progress"], "last_activity_at", { ascending: false }, 1],
        ["user_id", "u1", "status", ["expired", "submitted"], "last_activity_at", { ascending: false }, 1],
      ]);
    });

    it("doesn't look further once it finds an unfinished intake", async () => {
      latestRow = { id: "s7" };
      resumeRow = openRow;
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(latestQueries).toEqual([["user_id", "u1", "status", ["in_progress"], "last_activity_at", { ascending: false }, 1]]);
    });

    it("starts a new intake when they have no unfinished one", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(inserts).toBe(1);
    });

    it("opens the named intake without looking for another", async () => {
      resumeRow = openRow;
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(latestQueries).toEqual([]);
    });

    it("offers to try again, and creates nothing, when it can't look for the prospect's intake", async () => {
      latestError = { message: "network down" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.loadFailed).toBe(true));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.sessionId).toBeNull();
      expect(inserts).toBe(0);
    });

    it("offers to try again, and creates nothing, when the intake is found but won't open", async () => {
      latestRow = { id: "s7" }; // resumeRow stays null: the load fails
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.loadFailed).toBe(true));
      expect(result.current.sessionId).toBeNull();
      expect(inserts).toBe(0);
    });

    it("picks the intake up on Try again once the lookup works", async () => {
      latestError = { message: "network down" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.loadFailed).toBe(true));
      latestError = null;
      latestRow = { id: "s7" };
      resumeRow = openRow;
      act(() => result.current.retryLoad());
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.loadFailed).toBe(false);
      expect(result.current.chamberData.company_name).toBe("Acme");
      expect(inserts).toBe(0);
    });

    it("starts a new intake from there when the prospect asks for one", async () => {
      latestError = { message: "network down" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.loadFailed).toBe(true));
      act(() => result.current.startNew());
      await startIntake(result);
      expect(result.current.loadFailed).toBe(false);
      expect(inserts).toBe(1);
    });

    it("starts a new intake, not the unfinished one, when the prospect asks for a new one", async () => {
      const { result } = renderHook(() => useChamberSession("missing"));
      await waitFor(() => expect(result.current.resumeFailed).toBe(true));
      latestRow = { id: "s7" };
      resumeRow = openRow;
      act(() => result.current.startNew());
      await startIntake(result);
      expect(inserts).toBe(1);
    });
  });

  describe("fields an advisor verified", () => {
    // Rows as the app writes them: every answer in its canonical form, so what was stored is what is loaded.
    const rowOf = (answers: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
      id: "s7", data_version: 2, chamber_data: { ...parseChamberData({ company_name: "Acme Bindery", pay_frequency: "Weekly", ...answers }) },
      field_provenance: {}, transcript: [], status: "in_progress", submission: null, ...over,
    });
    const verified = (result: { current: ReturnType<typeof useChamberSession> }) => [...result.current.verifiedFields].sort();
    const answerRead = async (index: number, fields: string[]) => {
      await act(async () => { pendingVerifiedReads[index]({ data: fields, error: null }); });
    };
    const open = async (fields: string[], row = rowOf()) => {
      rpcResult = { data: fields, error: null };
      resumeRow = row;
      const hook = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(verified(hook.result)).toEqual([...fields].sort()));
      return hook.result;
    };

    it("reads them when the intake is opened", async () => {
      await open(["company_name"]);
      expect(rpcCalls).toEqual([{ fn: "session_verified_fields", args: { p_session_id: "s7" } }]);
    });

    it("forgets one when the answer it covered changes, as the server resets that review", async () => {
      const result = await open(["company_name", "pay_frequency"]);
      // A document replaces the verified company name; the pay frequency stays as the advisor saw it.
      act(() => result.current.updateIntake((prev) => ({ data: { ...prev.data, company_name: "Beta Holdings LLC" }, provenance: prev.provenance })));
      expect(verified(result)).toEqual(["pay_frequency"]);
      // The same answer written again, or an unrelated one, takes nothing away.
      act(() => result.current.updateIntake((prev) => ({ data: { ...prev.data, company_name: "Beta Holdings LLC", industry: "Printing" }, provenance: prev.provenance })));
      expect(verified(result)).toEqual(["pay_frequency"]);
    });

    it("forgets one when the prospect edits the answer through the plain setter too", async () => {
      const result = await open(["company_name"]);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme Press" })));
      expect(verified(result)).toEqual([]);
    });

    it("doesn't bring one back when the answer is changed and then changed back", async () => {
      // The first save already made the server reset that review; a later save of the old answer doesn't restore it.
      const result = await open(["company_name"]);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme Press" })));
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme Bindery" })));
      expect(verified(result)).toEqual([]);
    });

    it("keeps one while its answer is unchanged, however the rest of the intake moves", async () => {
      const result = await open(["company_name"]);
      act(() => result.current.setChamberData((prev) => ({ ...prev, pay_frequency: "Bi-weekly", industry: "Printing" })));
      expect(verified(result)).toEqual(["company_name"]);
    });

    it("drops one when an edit lands before the read that names it does", async () => {
      deferVerifiedRead = true;
      resumeRow = rowOf();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(pendingVerifiedReads).toHaveLength(1));
      act(() => result.current.updateIntake((prev) => ({ data: { ...prev.data, company_name: "Beta LLC" }, provenance: prev.provenance })));
      await answerRead(0, ["company_name", "pay_frequency"]);
      await waitFor(() => expect(verified(result)).toEqual(["pay_frequency"]));
    });

    it("drops one that changed and was changed back while the read that names it was on its way", async () => {
      deferVerifiedRead = true;
      resumeRow = rowOf();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(pendingVerifiedReads).toHaveLength(1));
      // Two corrections in a row: the answer is back where it was loaded, but the server reset that review at the first.
      act(() => result.current.updateIntake((prev) => ({ data: { ...prev.data, company_name: "Beta LLC" }, provenance: prev.provenance })));
      act(() => result.current.updateIntake((prev) => ({ data: { ...prev.data, company_name: "Acme Bindery" }, provenance: prev.provenance })));
      await answerRead(0, ["company_name", "pay_frequency"]);
      await waitFor(() => expect(verified(result)).toEqual(["pay_frequency"]));
    });

    it("reads again when the latest saved row is loaded, so another tab's change drops the badge", async () => {
      const result = await open(["company_name"]);
      // Another tab changed the answer, and the server reset that review.
      resumeRow = rowOf({ company_name: "Totally Different Corp" }, { data_version: 9 });
      rpcResult = { data: [], error: null };
      await act(async () => { result.current.discardChanges(); });
      await waitFor(() => expect(result.current.chamberData.company_name).toBe("Totally Different Corp"));
      await waitFor(() => expect(rpcCalls.filter((c) => c.fn === "session_verified_fields")).toHaveLength(2));
      expect(verified(result)).toEqual([]);
    });

    it("hides one at once when the loaded row's answer differs, before the new read lands", async () => {
      const result = await open(["company_name"]);
      resumeRow = rowOf({ company_name: "Totally Different Corp" }, { data_version: 9 });
      deferVerifiedRead = true;
      await act(async () => { result.current.discardChanges(); });
      await waitFor(() => expect(result.current.chamberData.company_name).toBe("Totally Different Corp"));
      expect(verified(result)).toEqual([]);
    });

    it("brings one back when a local edit is discarded and the server still holds it", async () => {
      const result = await open(["company_name"]);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme Press" })));
      expect(verified(result)).toEqual([]);
      await act(async () => { result.current.discardChanges(); });
      await waitFor(() => expect(result.current.chamberData.company_name).toBe("Acme Bindery"));
      await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
    });

    it("keeps the set it has when a later read fails, rather than wiping every badge", async () => {
      const result = await open(["company_name", "pay_frequency"]);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      rpcResult = { data: null, error: networkError };
      await act(async () => { result.current.discardChanges(); });
      await waitFor(() => expect(warn).toHaveBeenCalled());
      expect(verified(result)).toEqual(["company_name", "pay_frequency"]);
      warn.mockRestore();
    });

    it("uses the latest read when two overlap, however they answer", async () => {
      deferVerifiedRead = true;
      resumeRow = rowOf();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(pendingVerifiedReads).toHaveLength(1));
      await act(async () => { result.current.discardChanges(); });
      await waitFor(() => expect(pendingVerifiedReads).toHaveLength(2));
      // The newer read answers first (nothing verified), then the older one arrives late and must be ignored.
      await answerRead(1, []);
      await answerRead(0, ["company_name"]);
      expect(verified(result)).toEqual([]);
    });

    it("doesn't show an answer whose stored form isn't the one loaded: the first save rewrites it and the server resets its review", async () => {
      // Rows saved by earlier versions: a roster without ids or classifications, a headcount saved as text, and a
      // state list in two cases. Loading cleans them; saving writes the clean form.
      const old = rowOf();
      old.chamber_data = {
        ...old.chamber_data, employee_count: "40", states: ["ny", "NY"], census: [{ first_name: "A", last_name: "B", state: "NY" }],
      } as never;
      rpcResult = { data: ["company_name", "census", "employee_count", "states"], error: null };
      resumeRow = old;
      const { result } = renderHook(() => useChamberSession("s7"));
      // Only the answer stored in the form it is loaded in stays verified.
      await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
    });

    it("doesn't show a legacy roster, keyed `employees`, as verified", async () => {
      const legacy = rowOf();
      const { census: _census, ...rest } = legacy.chamber_data as Record<string, unknown>;
      legacy.chamber_data = { ...rest, employees: [{ first_name: "A", last_name: "B", state: "NY" }] } as never;
      rpcResult = { data: ["census", "company_name"], error: null };
      resumeRow = legacy;
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
    });

    describe("when the prospect keeps their changes over another tab's save", () => {
      // The prospect edits something else; the save is refused because another tab saved first.
      const conflicted = async (otherTab: Record<string, unknown>) => {
        const result = await open(["company_name"]);
        vi.useFakeTimers();
        act(() => result.current.setChamberData((prev) => ({ ...prev, pay_frequency: "Bi-weekly" })));
        await act(async () => { vi.advanceTimersByTime(2000); });
        resumeRow = rowOf(otherTab, { data_version: 5 });
        rpcResult = { data: [], error: null }; // the server reset the review if that tab changed the answer
        updates[0].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("conflict");
        expect(verified(result)).toEqual(["company_name"]); // nothing has been decided yet
        return result;
      };

      it("drops one the other tab changed, even though the prospect's own answer is still the one verified", async () => {
        const result = await conflicted({ company_name: "Totally Different Corp" });
        act(() => result.current.keepMine());
        // Their answer goes back over the other tab's, but the server reset that review and won't restore it.
        expect(verified(result)).toEqual([]);
        await drain();
        updates[1].resolve({ error: null });
        await drain();
        expect(result.current.chamberData.company_name).toBe("Acme Bindery");
        expect(verified(result)).toEqual([]);
      });

      it("keeps one the other tab left alone", async () => {
        const result = await conflicted({ industry: "Printing" });
        act(() => result.current.keepMine());
        expect(verified(result)).toEqual(["company_name"]);
        await drain();
        updates[1].resolve({ error: null });
        await drain();
        expect(verified(result)).toEqual(["company_name"]);
      });
    });

    it("has none for a new intake, without asking", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(result.current.verifiedFields.size).toBe(0);
      expect(rpcCalls).toEqual([]);
    });

    it("treats none as verified when they can't be read, and says nothing to the prospect", async () => {
      rpcResult = { data: null, error: { message: "Failed to fetch" } };
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      resumeRow = rowOf();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(warn).toHaveBeenCalled());
      expect(result.current.sessionId).toBe("s7");
      expect(result.current.verifiedFields.size).toBe(0);
      expect(result.current.saveStatus).toBe("idle");
      warn.mockRestore();
    });

    it("doesn't carry them over to another intake", async () => {
      rpcResult = { data: ["company_name"], error: null };
      resumeRow = rowOf();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.verifiedFields.has("company_name")).toBe(true));
      act(() => result.current.startNew());
      // A new intake starts with the prospect's first change (A-1); until then there is none to ask about.
      await waitFor(() => expect(result.current.sessionId).toBeNull());
      expect(result.current.verifiedFields.size).toBe(0);
      await startIntake(result);
      expect(result.current.verifiedFields.size).toBe(0);
    });
  });

  describe("the File ID", () => {
    it("has none for a new intake: the database assigns it at the first certification", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(result.current.fileId).toBeNull();
    });

    it("shows the one the database assigned to a resumed intake", async () => {
      resumeRow = serverRow({ id: "s7", file_id: "EAA-2026-0042" });
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.fileId).toBe("EAA-2026-0042");
    });

    it("keeps it when the certification was withdrawn, so certifying again reuses it", async () => {
      resumeRow = serverRow({ id: "s7", status: "in_progress", file_id: "EAA-2026-0042", submission: { ...submission, file_id: "EAA-2026-0042" } });
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.certification.status).toBe("stale");
      expect(result.current.fileId).toBe("EAA-2026-0042");
    });

    it("falls back to the File ID a certification recorded before the intake carried one", async () => {
      resumeRow = serverRow({ id: "s7", status: "submitted", file_id: null, submission: { ...submission, file_id: "EAA-2027-S7" } });
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.fileId).toBe("EAA-2027-S7");
      resumeRow = serverRow({ id: "s8", status: "submitted", file_id: "  ", submission: { ...submission, file_id: "  " } });
      const again = renderHook(() => useChamberSession("s8"));
      await waitFor(() => expect(again.result.current.sessionId).toBe("s8"));
      expect(again.result.current.fileId).toBeNull();
    });

    it("sends no File ID, and learns the one the database assigned from its answer, with the submission as it stamped it", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, industry: "Retail" })));
      let ok: SubmitResult | undefined;
      // What The Reckoning sends (CertificationRequest): the signature and consent, never a File ID.
      const { file_id: _none, ...request } = submission;
      const pending = result.current.submit(request).then((r) => { ok = r; });
      await waitFor(() => expect(updates).toHaveLength(1));
      updates[0].resolve({ error: null });
      await waitFor(() => expect(updates).toHaveLength(2));
      expect(updates[1].columns).toBe("id, data_version, status, submission, file_id");
      const sent = updates[1].payload.submission as Record<string, unknown>;
      expect(sent).not.toHaveProperty("file_id");
      expect(updates[1].payload).not.toHaveProperty("file_id");
      const stamped = { ...sent, file_id: "EAA-2026-0042", version: 1, data_version: 3, certified_at: "2026-10-27T00:00:00Z", data_sha256: "abc", documents: [] };
      updates[1].resolve({ error: null, data: [{ id: "s1", data_version: 3, status: "submitted", submission: stamped, file_id: "EAA-2026-0042" }] });
      await act(async () => { await pending; });
      expect(ok).toBe(true);
      expect(result.current.fileId).toBe("EAA-2026-0042");
      expect(result.current.certification).toMatchObject({ status: "certified", submission: { file_id: "EAA-2026-0042", version: 1, data_version: 3 } });
    });

    it("has none while there is no intake", async () => {
      latestError = { message: "network down" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.loadFailed).toBe(true));
      expect(result.current.fileId).toBeNull();
    });
  });

  describe("save status", () => {
    const edit = (result: { current: ReturnType<typeof useChamberSession> }) =>
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));

    it("says nothing until something changes, then saving, then saved once the row comes back", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(result.current.saveStatus).toBe("idle");

      vi.useFakeTimers();
      edit(result);
      expect(result.current.saveStatus).toBe("saving");
      await act(async () => { vi.advanceTimersByTime(2000); });
      expect(result.current.saveStatus).toBe("saving");
      updates[0].resolve({ error: null });
      await drain();
      expect(result.current.saveStatus).toBe("saved");
    });

    it("says not saved when a save fails, and Retry saves again", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      vi.useFakeTimers();
      edit(result);
      await act(async () => { vi.advanceTimersByTime(2000); });
      updates[0].resolve({ error: { message: "offline" } });
      await drain();
      expect(result.current.saveStatus).toBe("failed");

      act(() => result.current.retrySave());
      await drain();
      expect(updates).toHaveLength(2);
      expect(updates[1].payload).toHaveProperty("chamber_data.company_name", "Acme");
      updates[1].resolve({ error: null });
      await drain();
      expect(result.current.saveStatus).toBe("saved");
    });

    it("treats an update that changed no row as not saved, rather than trusting the missing error", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      // The row is still at the version the update asked for, so nothing explains the empty result.
      resumeRow = serverRow({ data_version: 1 });
      vi.useFakeTimers();
      edit(result);
      await act(async () => { vi.advanceTimersByTime(2000); });
      updates[0].resolve({ error: null, data: [] });
      await drain();
      expect(result.current.saveStatus).toBe("failed");
    });

    it("refuses to certify when the submission changed no row", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      resumeRow = serverRow({ data_version: 1 });
      let ok: SubmitResult | undefined;
      const pending = result.current.submit(submission).then((r) => { ok = r; });
      await waitFor(() => expect(updates).toHaveLength(1));
      await act(async () => { updates[0].resolve({ error: null, data: [] }); await pending; });
      expect(ok).toEqual(UNEXPLAINED);
      expect(result.current.certification.status).not.toBe("certified");
    });

    it("says not saved when the intake can't be created, and Retry creates it from what's on screen", async () => {
      insertError = { message: "offline" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // Nothing is created, or attempted, until the prospect starts.
      expect(result.current.sessionId).toBeNull();
      expect(inserts).toBe(0);
      expect(result.current.saveStatus).toBe("idle");

      vi.useFakeTimers();
      edit(result);
      await drain();
      expect(inserts).toBe(1);
      expect(result.current.saveStatus).toBe("failed");
      await act(async () => { vi.advanceTimersByTime(2000); });
      await drain();
      // Without an intake row nothing was written, and the indicator doesn't pretend otherwise.
      expect(updates).toHaveLength(0);
      expect(result.current.saveStatus).toBe("failed");

      insertError = null;
      // An older draft must not be loaded over what was just typed.
      latestRow = { id: "s7" };
      resumeRow = { id: "s7", data_version: 2, chamber_data: { company_name: "Older Co" }, field_provenance: {}, transcript: [], status: "in_progress", submission: null };
      act(() => result.current.retrySave());
      await drain();
      expect(result.current.sessionId).toBe("s1");
      expect(inserts).toBe(2);
      expect(insertedRows[1]).toHaveProperty("chamber_data.company_name", "Acme");
      expect(result.current.chamberData.company_name).toBe("Acme");
    });
  });
  describe("versioned writes", () => {
    const edit = (result: { current: ReturnType<typeof useChamberSession> }, name = "Acme") =>
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: name })));
    // Waits out the debounce so the autosave goes out.
    const autosave = async () => { await act(async () => { vi.advanceTimersByTime(2000); }); };
    const open = async () => {
      const hook = renderHook(() => useChamberSession());
      await startIntake(hook.result);
      vi.useFakeTimers();
      return hook;
    };

    it("writes against the version the server gave a new intake, naming only the row and the version", async () => {
      const { result } = await open();
      expect(insertedColumns).toEqual(["id, data_version, file_id"]);
      edit(result);
      await autosave();
      expect(updates[0].filters).toEqual({ id: "s1", data_version: 1 });
      expect(updates[0].columns).toBe("id, data_version");
      expect(updates[0].payload).not.toHaveProperty("data_version");
    });

    it("writes against the version it loaded when resuming an intake", async () => {
      resumeRow = serverRow({ id: "s9", data_version: 4, chamber_data: { company_name: "Acme" } });
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));
      expect(reads[0]).toContain("data_version");
      vi.useFakeTimers();
      edit(result, "Acme 2");
      await autosave();
      expect(updates[0].filters).toEqual({ id: "s9", data_version: 4 });
    });

    it("takes the next version from each response rather than counting", async () => {
      const { result } = await open();
      edit(result, "One");
      await autosave();
      updates[0].resolve({ error: null, data: [{ id: "s1", data_version: 7 }] });
      await drain();
      edit(result, "Two");
      await autosave();
      expect(updates[1].filters.data_version).toBe(7);
    });

    it("resends the same version when a save is retried", async () => {
      const { result } = await open();
      edit(result);
      await autosave();
      updates[0].resolve({ error: { message: "offline" } });
      await drain();
      await act(async () => { vi.advanceTimersByTime(10_000); });
      expect(updates).toHaveLength(2);
      expect(updates[1].filters.data_version).toBe(1);
    });

    it("refuses to save, and says so, when it doesn't know the version", async () => {
      resumeRow = serverRow({ id: "s9", data_version: undefined, chamber_data: {} });
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));
      vi.useFakeTimers();
      edit(result);
      await autosave();
      await drain();
      expect(updates).toHaveLength(0);
      expect(result.current.saveStatus).toBe("failed");
    });

    it("sends one write at a time, each at the version the one before returned, even when submit waits behind them", async () => {
      const { result } = await open();
      edit(result, "One");
      await autosave(); // write 1 is out
      edit(result, "Two");
      await autosave(); // its timer fires and waits behind write 1
      let submitted: SubmitResult | undefined;
      const pending = result.current.submit(submission).then((r) => { submitted = r; });
      await drain();
      expect(updates).toHaveLength(1);

      updates[0].resolve({ error: null });
      await drain();
      expect(updates).toHaveLength(2); // write 2, with submit still waiting
      expect(updates[1].filters.data_version).toBe(2);
      updates[1].resolve({ error: null });
      await drain();
      expect(updates).toHaveLength(3);
      expect(updates[2].payload).toMatchObject({ status: "submitted" });
      expect(updates[2].filters.data_version).toBe(3);
      await act(async () => { updates[2].resolve({ error: null }); await pending; });
      expect(submitted).toBe(true);
    });

    describe("when the save matched no row", () => {
      const staleSave = async () => {
        const hook = await open();
        edit(hook.result);
        await autosave();
        return hook;
      };

      it("reads the row back and reports a conflict, with every timer stopped", async () => {
        const { result } = await staleSave();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        await drain();
        expect(reads[0]).toContain("chamber_data");
        expect(result.current.saveStatus).toBe("conflict");

        await act(async () => { vi.advanceTimersByTime(60_000); });
        expect(updates).toHaveLength(1);
        expect(result.current.chamberData.company_name).toBe("Acme"); // the prospect's edit is still on screen
      });

      it("keeps showing the conflict when the prospect keeps typing, and still sends nothing", async () => {
        const { result } = await staleSave();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        await drain();

        edit(result, "Acme 2");
        expect(result.current.saveStatus).toBe("conflict");
        await act(async () => { vi.advanceTimersByTime(60_000); });
        expect(updates).toHaveLength(1);
      });

      it("loads the latest: the server's answers, version and certification replace what was typed", async () => {
        const { result } = await staleSave();
        resumeRow = serverRow({
          status: "submitted",
          submission,
          chamber_data: parseChamberData({ company_name: "Elsewhere Inc" }),
          field_provenance: { company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-10-20T00:00:00Z" } },
          transcript: [{ id: "m9", sender: "user", text: "hello from the other tab", timestamp: "10:00 AM" }],
        });
        updates[0].resolve({ error: null, data: [] });
        await drain();

        act(() => result.current.loadLatest());
        expect(result.current.chamberData.company_name).toBe("Elsewhere Inc");
        expect(result.current.provenance.company_name?.status).toBe("confirmed");
        expect(result.current.messages.map((m) => m.text)).toEqual(["hello from the other tab"]);
        expect(result.current.certification.status).toBe("certified");
        expect(result.current.saveStatus).toBe("saved");

        // Nothing left to save, and the next edit goes out at the version that was loaded.
        await act(async () => { vi.advanceTimersByTime(60_000); });
        expect(updates).toHaveLength(1);
        edit(result, "Elsewhere Inc 2");
        await autosave();
        expect(updates[1].filters.data_version).toBe(5);
      });

      it("keeps the prospect's changes: sends them at the version the server has now", async () => {
        const { result } = await staleSave();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        await drain();

        act(() => result.current.keepMine());
        await drain();
        expect(updates).toHaveLength(2);
        expect(updates[1].filters.data_version).toBe(5);
        expect(updates[1].payload).toHaveProperty("chamber_data.company_name", "Acme");
        updates[1].resolve({ error: null });
        await drain();
        expect(result.current.saveStatus).toBe("saved");
        expect(result.current.chamberData.company_name).toBe("Acme");
      });

      it("reports a conflict again when the server moved on while the prospect decided", async () => {
        const { result } = await staleSave();
        resumeRow = serverRow({ data_version: 5 });
        updates[0].resolve({ error: null, data: [] });
        await drain();

        act(() => result.current.keepMine());
        await drain();
        resumeRow = serverRow({ data_version: 6, chamber_data: { company_name: "Elsewhere again" } });
        updates[1].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("conflict");
        act(() => result.current.keepMine());
        await drain();
        expect(updates[2].filters.data_version).toBe(6);
      });

      // A write that landed but whose response was lost reaches the client as an error, never as zero rows.
      const landedButLost = async (hook: Awaited<ReturnType<typeof staleSave>>, over: Record<string, unknown> = {}) => {
        const sent = JSON.parse(JSON.stringify(updates[0].payload));
        resumeRow = serverRow({ data_version: 2, ...sent, ...over });
        updates[0].resolve({ error: networkError });
        await drain();
        expect(hook.result.current.saveStatus).toBe("failed");
        return sent;
      };

      describe("keeping the prospect's changes on a certified intake", () => {
        const certifiedData = parseChamberData({ company_name: "Acme" });
        const certifiedTab = async (serverOver: Record<string, unknown>) => {
          resumeRow = serverRow({ id: "s9", data_version: 4, status: "submitted", submission, chamber_data: certifiedData });
          const hook = renderHook(() => useChamberSession("s9"));
          await waitFor(() => expect(hook.result.current.certification.status).toBe("certified"));
          vi.useFakeTimers();
          // A chat message isn't an answer, so the tab still shows the intake as certified.
          act(() => hook.result.current.addMessage(createChatMessage("user", "hello")));
          await autosave();
          resumeRow = serverRow({ id: "s9", data_version: 5, status: "submitted", submission, chamber_data: certifiedData, ...serverOver });
          updates[0].resolve({ error: null, data: [] });
          await drain();
          expect(hook.result.current.saveStatus).toBe("conflict");
          return hook;
        };

        it("shows the certification as withdrawn when the other tab changed an answer", async () => {
          const { result } = await certifiedTab({ status: "in_progress", chamber_data: parseChamberData({ company_name: "Elsewhere Inc" }) });
          act(() => result.current.keepMine());
          await drain();
          expect(result.current.certification).toEqual({ status: "stale", submission });
        });

        it("shows it as withdrawn when the answers being kept differ from the certified ones", async () => {
          const { result } = await certifiedTab({}); // the server still holds the certified answers
          act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme Inc" })));
          act(() => result.current.keepMine());
          await drain();
          expect(result.current.certification).toEqual({ status: "stale", submission });
        });

        it("keeps it certified when the server still holds those answers", async () => {
          const { result } = await certifiedTab({});
          act(() => result.current.keepMine());
          await drain();
          expect(result.current.certification).toEqual({ status: "certified", submission });
        });
      });

      it("recognises its own write when only the response was lost, and leaves what's on screen alone", async () => {
        const hook = await staleSave();
        const { result } = hook;
        const before = result.current.chamberData;
        // jsonb hands the keys back in a different order.
        const sent = JSON.parse(JSON.stringify(updates[0].payload));
        await landedButLost(hook, { chamber_data: Object.fromEntries(Object.entries(sent.chamber_data).reverse()) });

        await act(async () => { vi.advanceTimersByTime(10_000); });
        expect(updates[1].filters.data_version).toBe(1); // the version it last saw
        updates[1].resolve({ error: null, data: [] });
        await drain();

        expect(result.current.saveStatus).toBe("saved");
        expect(result.current.chamberData).toBe(before);
        edit(result, "Acme 2");
        await autosave();
        expect(updates[2].filters.data_version).toBe(2);
      });

      it("compares with what that write sent, not with what was typed since", async () => {
        const hook = await staleSave();
        const { result } = hook;
        await landedButLost(hook);
        await act(async () => { vi.advanceTimersByTime(10_000); }); // the retry carries the same answers
        edit(result, "Acme 2"); // typed while the retry was out
        updates[1].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).not.toBe("conflict");
        await act(async () => { vi.advanceTimersByTime(2000); });
        expect(updates[2].filters.data_version).toBe(2);
        expect(updates[2].payload).toHaveProperty("chamber_data.company_name", "Acme 2");
      });

      it("doesn't call it a conflict when a lost write was followed by more edits: it sends them at the new version", async () => {
        const hook = await staleSave();
        const { result } = hook;
        await landedButLost(hook); // the server now holds "Acme", at version 2
        edit(result, "Acme Corp"); // typed before the retry
        await autosave();
        expect(updates[1].filters.data_version).toBe(1);
        expect(updates[1].payload).toHaveProperty("chamber_data.company_name", "Acme Corp");
        updates[1].resolve({ error: null, data: [] });
        await drain();

        expect(result.current.saveStatus).toBe("saving"); // not "conflict", and not "saved" yet
        expect(updates).toHaveLength(3);
        expect(updates[2].filters.data_version).toBe(2);
        expect(updates[2].payload).toHaveProperty("chamber_data.company_name", "Acme Corp");
        updates[2].resolve({ error: null });
        await drain();
        expect(result.current.saveStatus).toBe("saved");
        expect(result.current.chamberData.company_name).toBe("Acme Corp");
      });

      it("recognises the write that landed even when the ones after it errored too", async () => {
        const { result } = await staleSave();
        // The first write landed; the connection was still down for the second.
        resumeRow = serverRow({ data_version: 2, ...JSON.parse(JSON.stringify(updates[0].payload)) });
        updates[0].resolve({ error: networkError });
        await drain();
        edit(result, "Acme Corp");
        await autosave();
        updates[1].resolve({ error: networkError });
        await drain();
        edit(result, "Acme Corp 3");
        await autosave();
        updates[2].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).not.toBe("conflict");
        expect(updates[3].filters.data_version).toBe(2);
        expect(updates[3].payload).toHaveProperty("chamber_data.company_name", "Acme Corp 3");
      });

      it("still recognises the write that landed after a long outage of failed saves", async () => {
        const { result } = await staleSave();
        resumeRow = serverRow({ data_version: 2, ...JSON.parse(JSON.stringify(updates[0].payload)) });
        updates[0].resolve({ error: networkError });
        await drain();
        // Far more failures than the memory holds, every one at the same version.
        for (let i = 1; i <= 8; i++) {
          edit(result, `Acme ${i}`);
          await autosave();
          updates[i].resolve({ error: networkError });
          await drain();
        }
        edit(result, "Acme final");
        await autosave();
        updates[9].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).not.toBe("conflict");
        expect(updates[10].filters.data_version).toBe(2);
        expect(updates[10].payload).toHaveProperty("chamber_data.company_name", "Acme final");
      });

      it("still reports a conflict when the row at the next version isn't what the failed write sent", async () => {
        const hook = await staleSave();
        const { result } = hook;
        await landedButLost(hook, { chamber_data: { company_name: "Elsewhere Inc" } }); // another tab got there first
        edit(result, "Acme Corp");
        await autosave();
        updates[1].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("conflict");
      });

      it("reports a conflict when only the transcript differs from what was sent", async () => {
        const { result } = await staleSave();
        const sent = JSON.parse(JSON.stringify(updates[0].payload));
        resumeRow = serverRow({
          data_version: 2,
          chamber_data: sent.chamber_data,
          field_provenance: sent.field_provenance,
          transcript: [{ id: "m9", sender: "user", text: "other tab", timestamp: "10:00 AM" }],
        });
        updates[0].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("conflict");
      });

      it("says the intake can no longer be saved when the row is gone, and doesn't retry", async () => {
        const { result } = await staleSave();
        resumeRow = null;
        updates[0].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("missing");
        act(() => result.current.retrySave());
        await act(async () => { vi.advanceTimersByTime(60_000); });
        expect(updates).toHaveLength(1);
      });

      it("starts a new intake from what's on screen when the row is gone", async () => {
        const { result } = await staleSave();
        resumeRow = null;
        updates[0].resolve({ error: null, data: [] });
        await drain();
        vi.useRealTimers();

        act(() => result.current.startNew());
        await waitFor(() => expect(inserts).toBe(2));
        expect(insertedRows[1]).toHaveProperty("chamber_data.company_name", "Acme");
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.saveStatus).not.toBe("missing");
      });

      it("fails and retries when the row can't be read back", async () => {
        const { result } = await staleSave();
        readError = { message: "offline" };
        updates[0].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("failed");
        await act(async () => { vi.advanceTimersByTime(10_000); });
        expect(updates).toHaveLength(2);
        expect(updates[1].filters.data_version).toBe(1);
      });

      it("fails and retries, rather than calling it a conflict, when the row hasn't moved", async () => {
        const { result } = await staleSave();
        resumeRow = serverRow({ data_version: 1 });
        updates[0].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("failed");
        await act(async () => { vi.advanceTimersByTime(10_000); });
        expect(updates).toHaveLength(2);
      });
    });

    describe("when the server refuses an answer", () => {
      const refused: MockError = {
        message: "Invalid intake data at employees[3].dob: too long",
        code: "EA001",
        details: "employees[3].dob",
      };
      const refusedSave = async () => {
        const hook = await open();
        edit(hook.result);
        await autosave();
        updates[0].resolve({ error: refused });
        await drain();
        return hook;
      };

      it("says which answer, and doesn't retry the same payload", async () => {
        const { result } = await refusedSave();
        expect(result.current.saveStatus).toBe("invalid");
        expect(result.current.invalidField).toBe("Employee 4 in your census");
        await act(async () => { vi.advanceTimersByTime(60_000); });
        expect(updates).toHaveLength(1);
      });

      it("tries again on the next edit, and clears the message once a save works", async () => {
        const { result } = await refusedSave();
        edit(result, "Acme 2");
        expect(result.current.saveStatus).toBe("invalid"); // not downgraded by the edit
        await autosave();
        expect(updates).toHaveLength(2);
        expect(updates[1].filters.data_version).toBe(1); // the refused write changed nothing
        updates[1].resolve({ error: null });
        await drain();
        expect(result.current.saveStatus).toBe("saved");
        expect(result.current.invalidField).toBeNull();
      });

      it("shows the invalid answer again when the next attempt is refused too", async () => {
        const { result } = await refusedSave();
        edit(result, "Acme 2");
        await autosave();
        updates[1].resolve({ error: { ...refused, details: "hq_state" } });
        await drain();
        expect(result.current.saveStatus).toBe("invalid");
        expect(result.current.invalidField).toBe("HQ state");
      });

      it("treats other failures as transient even while an answer is refused", async () => {
        const { result } = await refusedSave();
        edit(result, "Acme 2");
        await autosave();
        updates[1].resolve({ error: { message: "offline" } });
        await drain();
        expect(result.current.saveStatus).toBe("failed");
        await act(async () => { vi.advanceTimersByTime(10_000); });
        expect(updates).toHaveLength(3);
      });

      it("reloads what the server has when the prospect discards their changes", async () => {
        const { result } = await refusedSave();
        resumeRow = serverRow({ data_version: 1, chamber_data: { company_name: "Saved Co" } });
        act(() => result.current.discardChanges());
        await drain();
        expect(result.current.chamberData.company_name).toBe("Saved Co");
        expect(result.current.saveStatus).toBe("saved");
        expect(result.current.invalidField).toBeNull();
        await act(async () => { vi.advanceTimersByTime(60_000); });
        expect(updates).toHaveLength(1);

        // Nothing is left unsaved, so leaving neither sends the discarded changes nor asks to stay.
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
        fetchSpy.mockRestore();
      });

      it("keeps the refused state, and the changes, when the reload fails", async () => {
        const { result } = await refusedSave();
        readError = { message: "offline" };
        act(() => result.current.discardChanges());
        await drain();
        expect(result.current.saveStatus).toBe("invalid");
        expect(result.current.chamberData.company_name).toBe("Acme");
      });

      it("refuses to certify, and says why", async () => {
        const { result } = await refusedSave();
        let ok: SubmitResult | undefined;
        const pending = result.current.submit(submission).then((r) => { ok = r; });
        await drain();
        updates[1].resolve({ error: refused });
        await act(async () => { await pending; });
        expect(ok).toEqual({ message: expect.stringContaining("couldn't be saved") });
        expect(updates.some((u) => u.payload.status === "submitted")).toBe(false);
      });
    });

    describe("describeInvalidPath", () => {
      it.each([
        ["hq_state", "HQ state"],
        ["states[2]", "States of operation"],
        ["employee_count", "Employee count"],
        ["employees", "Your employee census"],
        ["employees[0].dob", "Employee 1 in your census"],
        ["employees[3].state", "Employee 4 in your census"],
        ["employees[0].dependents[1].relationship", "A dependent of employee 1"],
        ["chamber_data", "Some of your answers"],
        ["something_new", "Some of your answers"],
        [null, "Some of your answers"],
      ])("%s reads as %s", (path, label) => {
        expect(describeInvalidPath(path)).toBe(label);
      });
    });

    describe("leaving the page", () => {
      const leave = () => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event;
      };

      it("sends the version the page last saw", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
        const { result } = await open();
        edit(result);
        leave();
        expect(fetchSpy.mock.calls[0][0]).toMatch(/\/chamber_sessions\?id=eq\.s1&data_version=eq\.1$/);
        fetchSpy.mockRestore();
      });

      it("asks the prospect to stay while a save is still out, as the version it leaves can't be known", async () => {
        // `version + 1` could as well be another tab's save, which a keepalive request must not overwrite.
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
        const { result } = await open();
        edit(result, "One");
        await autosave();
        edit(result, "Two");
        const event = leave();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);

        // The save queued by leaving goes out behind the one in flight, at the version that returns.
        updates[0].resolve({ error: null });
        await drain();
        expect(updates[1].filters.data_version).toBe(2);
        expect(updates[1].payload).toHaveProperty("chamber_data.company_name", "Two");
        fetchSpy.mockRestore();
      });

      it("asks the prospect to stay after a save failed, as it may have landed and moved the version on", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
        const { result } = await open();
        edit(result, "One");
        await autosave();
        updates[0].resolve({ error: networkError });
        await drain();
        edit(result, "Two");
        const event = leave();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
        fetchSpy.mockRestore();
      });

      it("asks the prospect to stay while the row is being read back after a write that matched nothing", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
        const { result } = await open();
        edit(result, "One");
        await autosave();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        edit(result, "Two"); // before the read-back has been looked at
        const event = leave();
        await drain();
        expect(result.current.saveStatus).toBe("conflict");
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
        fetchSpy.mockRestore();
      });

      it("asks the prospect to stay, rather than sending a request that can't win, while an answer is refused", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
        const { result } = await open();
        edit(result);
        await autosave();
        updates[0].resolve({ error: { message: "Invalid intake data at hq_state: unknown", code: "EA001", details: "hq_state" } });
        await drain();
        expect(result.current.saveStatus).toBe("invalid");
        const event = leave();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
        fetchSpy.mockRestore();
      });

      it("asks the prospect to stay, rather than sending a request that can't win, during a conflict", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
        const { result } = await open();
        edit(result);
        await autosave();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        await drain();
        expect(result.current.saveStatus).toBe("conflict");
        const event = leave();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
        fetchSpy.mockRestore();
      });
    });

    describe("submitting", () => {
      it("is conditional on the version, asks for the status back, and moves the version on", async () => {
        const { result } = await open();
        edit(result);
        const pending = result.current.submit(submission);
        await drain();
        updates[0].resolve({ error: null });
        await drain();
        expect(updates[1].payload).toMatchObject({ status: "submitted" });
        expect(updates[1].payload).not.toHaveProperty("data_version");
        expect(updates[1].filters).toEqual({ id: "s1", data_version: 2 });
        expect(updates[1].columns).toBe("id, data_version, status, submission, file_id");
        await act(async () => { updates[1].resolve({ error: null }); await pending; });

        edit(result, "Acme 2");
        await autosave();
        expect(updates[2].filters.data_version).toBe(3);
      });

      it("does not report success, and says the intake changed elsewhere, when the version is stale", async () => {
        const { result } = await open();
        let ok: SubmitResult | undefined;
        const pending = result.current.submit(submission).then((r) => { ok = r; });
        await drain();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        await act(async () => { await pending; });
        expect(ok).toEqual({ message: "This intake changed elsewhere. Reload the latest and certify again." });
        expect(result.current.saveStatus).toBe("conflict");
        expect(result.current.certification.status).toBe("none");
        expect(dispatchOutbox).not.toHaveBeenCalled();
      });

      it("sends nothing while a conflict is waiting for the prospect", async () => {
        const { result } = await open();
        edit(result);
        await autosave();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        await drain();

        let ok: SubmitResult | undefined;
        await act(async () => { ok = await result.current.submit(submission); });
        expect(ok).toEqual({ message: expect.stringContaining("changed elsewhere") });
        expect(updates).toHaveLength(1);
      });

      it("can certify once the prospect has chosen to keep their changes", async () => {
        const { result } = await open();
        edit(result);
        await autosave();
        resumeRow = serverRow();
        updates[0].resolve({ error: null, data: [] });
        await drain();
        act(() => result.current.keepMine());
        await drain();
        updates[1].resolve({ error: null });
        await drain();

        const pending = result.current.submit(submission);
        await drain();
        expect(updates[2].filters.data_version).toBe(6);
        await act(async () => { updates[2].resolve({ error: null }); await pending; });
        expect(result.current.certification.status).toBe("certified");
      });

      describe("when the response to a certification was lost", () => {
        // The write landed: the row is a version on and submitted, but the client only saw an error.
        const landedButLost = async (hook: Awaited<ReturnType<typeof open>>, certifiedAt = "2026-10-27T00:00:00Z") => {
          const first = hook.result.current.submit(submission).then((r) => r);
          await drain();
          const sent = JSON.parse(JSON.stringify(updates[0].payload));
          resumeRow = serverRow({
            data_version: 2,
            status: "submitted",
            chamber_data: sent.chamber_data,
            submission: { ...sent.submission, certified_at: certifiedAt, data_sha256: "abc" },
          });
          updates[0].resolve({ error: networkError });
          expect(await first).toEqual(UNEXPLAINED);
          expect(hook.result.current.certification.status).toBe("none");
        };

        it("recognises the certification when the same one is sent again", async () => {
          const hook = await open();
          await landedButLost(hook);
          let ok: SubmitResult | undefined;
          await act(async () => {
            const pending = hook.result.current.submit(submission);
            await drain();
            updates[1].resolve({ error: null, data: [] });
            ok = await pending;
          });
          expect(updates[1].filters.data_version).toBe(1);
          expect(ok).toBe(true);
          expect(hook.result.current.certification.status).toBe("certified");
          expect(dispatchOutbox).toHaveBeenCalledTimes(1);
        });

        it("recognises it when certifying again with a new signature time, and shows the one on record", async () => {
          const hook = await open();
          await landedButLost(hook);
          let ok: SubmitResult | undefined;
          await act(async () => {
            const pending = hook.result.current.submit({ ...submission, signed_at: "2026-01-01T00:05:00Z" });
            await drain();
            updates[1].resolve({ error: null, data: [] });
            ok = await pending;
          });
          expect(ok).toBe(true);
          expect(hook.result.current.saveStatus).not.toBe("conflict");
          expect(hook.result.current.certification).toMatchObject({ status: "certified", submission: { signed_at: submission.signed_at } });
          // The next write starts from the version the certification left.
          edit(hook.result, "Acme 2");
          await autosave();
          expect(updates[2].filters.data_version).toBe(2);
        });

        it("sends answers edited since to the saved intake instead of calling it a conflict", async () => {
          const hook = await open();
          await landedButLost(hook);
          edit(hook.result, "Acme Corp");
          let pending: Promise<boolean | { message: string }> | undefined;
          act(() => { pending = hook.result.current.submit({ ...submission, signed_at: "2026-01-01T00:05:00Z" }); });
          await drain();
          // The autosave at the old version matches nothing; the row is the earlier certification.
          updates[1].resolve({ error: null, data: [] });
          await drain();
          expect(hook.result.current.saveStatus).not.toBe("conflict");
          expect(updates[2].filters.data_version).toBe(2);
          expect(updates[2].payload).toHaveProperty("chamber_data.company_name", "Acme Corp");
        });
      });

      describe("when an autosave finds the certification whose response was lost", () => {
        const certificationLostThenAutosave = async (change: (hook: Awaited<ReturnType<typeof open>>) => void) => {
          const hook = await open();
          const first = hook.result.current.submit(submission).then((r) => r);
          await drain();
          const sent = JSON.parse(JSON.stringify(updates[0].payload));
          resumeRow = serverRow({
            data_version: 2,
            status: "submitted",
            chamber_data: sent.chamber_data,
            submission: { ...sent.submission, certified_at: "2026-10-27T00:00:00Z", data_sha256: "abc" },
          });
          updates[0].resolve({ error: networkError });
          expect(await first).toEqual(UNEXPLAINED);
          expect(hook.result.current.certification.status).toBe("none");
          change(hook);
          await autosave();
          updates[1].resolve({ error: null, data: [] });
          await drain();
          return hook;
        };

        it("shows the intake as certified when the answers have not changed since", async () => {
          const hook = await certificationLostThenAutosave((h) =>
            act(() => h.result.current.addMessage(createChatMessage("user", "did that go through?"))));
          expect(hook.result.current.certification.status).toBe("certified");
          expect(hook.result.current.saveStatus).not.toBe("conflict");
        });

        it("shows it as withdrawn when answers were edited since, because saving them withdraws it", async () => {
          const hook = await certificationLostThenAutosave((h) => edit(h.result, "Acme Corp"));
          expect(hook.result.current.certification.status).toBe("stale");
        });
      });

      it("names the missing answers when the database refuses an unready certification, and keeps saving", async () => {
        const { result } = await open();
        let ok: SubmitResult | undefined;
        const pending = result.current.submit(submission).then((r) => { ok = r; });
        await drain();
        expect(updates[0].payload).toMatchObject({ status: "submitted" });
        updates[0].resolve({ error: { message: "This intake can't be certified yet: it needs company_name, pay_frequency", code: "EA003", details: "company_name,pay_frequency" } });
        await act(async () => { await pending; });
        expect(ok).toEqual({ message: "Add company legal name, pay frequency on the Review tab, then certify." });
        expect(result.current.certification.status).toBe("none");
        expect(dispatchOutbox).not.toHaveBeenCalled();

        // A definite refusal: nothing is left in doubt, and the next edit saves normally.
        edit(result, "Acme Inc");
        await autosave();
        expect(updates).toHaveLength(2);
        expect(updates[1].payload).not.toHaveProperty("status");
        updates[1].resolve({ error: null });
        await drain();
        expect(result.current.saveStatus).toBe("saved");
      });

      it("names the answers in conflict when the database refuses a certification over them, and keeps saving", async () => {
        const { result } = await open();
        let ok: SubmitResult | undefined;
        const pending = result.current.submit(submission).then((r) => { ok = r; });
        await drain();
        updates[0].resolve({ error: { message: "This intake can't be certified yet: company_name, states has two different answers", code: "EA008", details: "company_name,states" } });
        await act(async () => { await pending; });
        expect(ok).toEqual({ message: "Choose one answer for company legal name, states of operation on the Review tab, then certify." });
        expect(result.current.certification.status).toBe("none");
        expect(dispatchOutbox).not.toHaveBeenCalled();

        edit(result, "Acme Inc");
        await autosave();
        expect(updates).toHaveLength(2);
        expect(updates[1].payload).not.toHaveProperty("status");
        updates[1].resolve({ error: null });
        await drain();
        expect(result.current.saveStatus).toBe("saved");
      });

      it("says which answer was refused when the submission write itself is refused", async () => {
        // Certifying re-checks the answers even when nothing was edited, so an older row can fail here.
        const { result } = await open();
        edit(result);
        await autosave();
        updates[0].resolve({ error: null });
        await drain();
        let ok: SubmitResult | undefined;
        const pending = result.current.submit(submission).then((r) => { ok = r; });
        await drain();
        expect(updates[1].payload).toMatchObject({ status: "submitted" });
        updates[1].resolve({ error: { message: "Invalid intake data at employees[3].dob: too long", code: "EA001", details: "employees[3].dob" } });
        await act(async () => { await pending; });
        expect(ok).toEqual({ message: expect.stringContaining("couldn't be saved") });
        expect(result.current.saveStatus).toBe("invalid");
        expect(result.current.invalidField).toBe("Employee 4 in your census");
        expect(result.current.certification.status).toBe("none");
      });

      it("reports that the intake is gone, not a retryable failure, when the row is missing", async () => {
        const { result } = await open();
        let ok: SubmitResult | undefined;
        const pending = result.current.submit(submission).then((r) => { ok = r; });
        await drain();
        resumeRow = null;
        await act(async () => { updates[0].resolve({ error: null, data: [] }); await pending; });
        expect(ok).toEqual({ message: expect.stringContaining("no longer be saved") });
        expect(result.current.saveStatus).toBe("missing");
      });
    });
  });

  describe("the chosen PEO", () => {
    const autosave = async () => { await act(async () => { vi.advanceTimersByTime(2000); }); };
    const open = async () => {
      const hook = renderHook(() => useChamberSession());
      await startIntake(hook.result);
      vi.useFakeTimers();
      return hook;
    };

    it("starts with none", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(result.current.chosenPeo).toBeNull();
      expect(insertedRows[0]).toMatchObject({ chosen_peo: null });
    });

    it("is saved with the intake, in the same versioned write as the answers", async () => {
      const { result } = await open();
      act(() => result.current.choosePeo("Justworks"));
      expect(result.current.chosenPeo).toBe("Justworks");
      expect(result.current.saveStatus).toBe("saving");
      await autosave();
      expect(updates).toHaveLength(1);
      expect(updates[0].filters).toEqual({ id: "s1", data_version: 1 });
      expect(updates[0].payload).toMatchObject({ chosen_peo: "Justworks" });
      expect(updates[0].payload).toHaveProperty("chamber_data");
      updates[0].resolve({ error: null });
      await drain();
      expect(result.current.saveStatus).toBe("saved");
    });

    it("is restored when the intake is opened again", async () => {
      resumeRow = serverRow({ id: "s9", chosen_peo: "TriNet" });
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));
      expect(result.current.chosenPeo).toBe("TriNet");
    });

    it("reads a row saved before the choice was kept as no choice", async () => {
      resumeRow = serverRow({ id: "s9" }); // no chosen_peo value at all
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));
      expect(result.current.chosenPeo).toBeNull();
    });

    it("goes out with the keepalive request when the page unloads", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
      const { result } = await open();
      act(() => result.current.choosePeo("Insperity"));
      window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ chosen_peo: "Insperity" });
      fetchSpy.mockRestore();
    });

    it("is trimmed, and choosing the same PEO again saves nothing", async () => {
      const { result } = await open();
      act(() => result.current.choosePeo("  Justworks "));
      expect(result.current.chosenPeo).toBe("Justworks");
      await autosave();
      updates[0].resolve({ error: null });
      await drain();
      act(() => result.current.choosePeo("Justworks"));
      await autosave();
      expect(updates).toHaveLength(1);
      expect(result.current.saveStatus).toBe("saved");
    });

    it("is taken from the server's row when the prospect loads the latest after a conflict", async () => {
      const { result } = await open();
      act(() => result.current.choosePeo("Justworks"));
      await autosave();
      resumeRow = serverRow({ chosen_peo: "Rippling" });
      updates[0].resolve({ error: null, data: [] });
      await drain();
      expect(result.current.saveStatus).toBe("conflict");
      act(() => result.current.loadLatest());
      expect(result.current.chosenPeo).toBe("Rippling");
    });

    it("reports a conflict when only the chosen PEO differs from what was sent", async () => {
      const { result } = await open();
      act(() => result.current.choosePeo("Justworks"));
      await autosave();
      const sent = JSON.parse(JSON.stringify(updates[0].payload));
      resumeRow = serverRow({ data_version: 2, chamber_data: sent.chamber_data, field_provenance: sent.field_provenance, transcript: sent.transcript, chosen_peo: "TriNet" });
      updates[0].resolve({ error: null, data: [] });
      await drain();
      expect(result.current.saveStatus).toBe("conflict");
    });

    it("recognises its own write by the chosen PEO when only the response was lost", async () => {
      const { result } = await open();
      act(() => result.current.choosePeo("Justworks"));
      await autosave();
      const sent = JSON.parse(JSON.stringify(updates[0].payload));
      resumeRow = serverRow({ data_version: 2, ...sent });
      updates[0].resolve({ error: null, data: [] });
      await drain();
      expect(result.current.saveStatus).toBe("saved");
    });

    it("keeps a certification when a different PEO is chosen, as the answers it covers are unchanged", async () => {
      resumeRow = { id: "s9", data_version: 3, chamber_data: parseChamberData({ company_name: "Acme" }), transcript: [], status: "submitted", submission: { ...submission, peo: "Justworks" }, chosen_peo: "Justworks" };
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.certification.status).toBe("certified"));
      act(() => result.current.choosePeo("TriNet"));
      expect(result.current.certification.status).toBe("certified");
      expect(result.current.chosenPeo).toBe("TriNet");
    });

    it("is cleared when the prospect starts over, and the new intake starts with none", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.choosePeo("Justworks"));
      await act(async () => { await result.current.startOver(); });
      // Nothing new is created until the prospect starts again.
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(inserts).toBe(1);
      await startIntake(result);
      expect(inserts).toBe(2);
      expect(result.current.chosenPeo).toBeNull();
      expect(insertedRows[1]).toMatchObject({ chosen_peo: null });
    });
  });

  describe("an intake that expired", () => {
    const expiredRow = (over: Record<string, unknown> = {}) =>
      serverRow({ id: "s5", status: "expired", expires_at: "2026-10-01T00:00:00Z", chamber_data: { company_name: "Old Co" }, ...over });

    it("says so when a linked intake has expired, shows none of it, and creates nothing", async () => {
      resumeRow = expiredRow();
      const { result } = renderHook(() => useChamberSession("s5"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.expired).toEqual({ at: "2026-10-01T00:00:00Z" });
      expect(result.current.resumeFailed).toBe(false);
      expect(result.current.sessionId).toBeNull();
      expect(result.current.chamberData.company_name).toBeNull();
      expect(inserts).toBe(0);
    });

    it("starts a fresh intake from there when the prospect asks", async () => {
      resumeRow = expiredRow();
      const { result } = renderHook(() => useChamberSession("s5"));
      await waitFor(() => expect(result.current.expired).not.toBeNull());
      act(() => result.current.startNew());
      await startIntake(result);
      expect(result.current.expired).toBeNull();
      expect(insertedRows[0].chamber_data).toMatchObject({ company_name: null });
    });

    it("says so on a bare /start when nothing is open and what they last worked on expired", async () => {
      lastClosedRow = { id: "s5", status: "expired" };
      resumeRow = expiredRow();
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.expired).not.toBeNull();
      expect(inserts).toBe(0);
    });

    it("just starts a new intake when what they last did was submit one", async () => {
      lastClosedRow = { id: "s6", status: "submitted" };
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      expect(result.current.expired).toBeNull();
      expect(reads).toEqual([]);
    });

    describe("while it is open", () => {
      const edit = (result: { current: ReturnType<typeof useChamberSession> }) =>
        act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      const open = async () => {
        const hook = renderHook(() => useChamberSession());
        await startIntake(hook.result);
        vi.useFakeTimers();
        return hook;
      };

      it("says it expired, rather than calling it a conflict, when a save finds it closed, and doesn't retry", async () => {
        const { result } = await open();
        edit(result);
        await act(async () => { vi.advanceTimersByTime(2000); });
        resumeRow = expiredRow({ id: "s1", data_version: 2 });
        await act(async () => { updates[0].resolve({ error: null, data: [] }); });
        await drain();
        expect(result.current.saveStatus).toBe("expired");
        edit(result);
        await act(async () => { vi.advanceTimersByTime(30000); });
        expect(updates).toHaveLength(1);
      });

      it("treats the database's closed-intake refusal the same way", async () => {
        const { result } = await open();
        edit(result);
        await act(async () => { vi.advanceTimersByTime(2000); });
        await act(async () => { updates[0].resolve({ error: { message: "This intake is closed (expired)", code: "EA002", details: "expired" } }); });
        await drain();
        expect(result.current.saveStatus).toBe("expired");
      });

      it("refuses to certify it, and says why", async () => {
        const { result } = await open();
        let ok: SubmitResult | undefined;
        const pending = result.current.submit(submission).then((r) => { ok = r; });
        await drain();
        resumeRow = expiredRow({ id: "s1" });
        await act(async () => { updates[0].resolve({ error: null, data: [] }); await pending; });
        expect(ok).toEqual({ message: expect.stringContaining("has expired") });
        expect(result.current.certification.status).toBe("none");
      });

      it("keeps the prospect's answers in the new intake they start from there", async () => {
        const { result } = await open();
        edit(result);
        await act(async () => { vi.advanceTimersByTime(2000); });
        resumeRow = expiredRow({ id: "s1" });
        await act(async () => { updates[0].resolve({ error: null, data: [] }); });
        await drain();
        vi.useRealTimers();
        act(() => result.current.startNew());
        await waitFor(() => expect(inserts).toBe(2));
        expect(insertedRows[1].chamber_data).toMatchObject({ company_name: "Acme" });
      });
    });
  });

  describe("starting an intake (A-1)", () => {
    it("creates nothing on load, or on a reload, until the prospect does something", async () => {
      const first = renderHook(() => useChamberSession());
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));
      expect(first.result.current.sessionId).toBeNull();
      expect(first.result.current.messages.map((m) => m.text)).toEqual([OPENING_MESSAGE]);
      expect(first.result.current.saveStatus).toBe("idle");
      first.unmount();
      const again = renderHook(() => useChamberSession());
      await waitFor(() => expect(again.result.current.isLoading).toBe(false));
      await drain();
      expect(inserts).toBe(0);
      expect(again.result.current.fileId).toBeNull();
    });

    it("creates exactly one intake on the first message, holding it, and saves nothing twice", async () => {
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      vi.useFakeTimers();
      const message = createChatMessage("user", "We are Acme, twelve people in NY");
      act(() => result.current.addMessage(message));
      await drain();
      expect(inserts).toBe(1);
      expect((insertedRows[0].transcript as { id: string }[]).map((m) => m.id)).toContain(message.id);
      expect(result.current.sessionId).toBe("s1");
      expect(result.current.saveStatus).toBe("saved");
      // The row already holds it: no update follows.
      await act(async () => { vi.advanceTimersByTime(2000); });
      await drain();
      expect(updates).toHaveLength(0);

      // Later changes are saves to that intake, never a second one.
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      await act(async () => { vi.advanceTimersByTime(2000); });
      await drain();
      expect(inserts).toBe(1);
      expect(updates).toHaveLength(1);
      expect(updates[0].filters).toMatchObject({ id: "s1", data_version: 1 });
    });

    it("saves a change made while the intake was being created", async () => {
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      vi.useFakeTimers();
      act(() => {
        result.current.choosePeo("TriNet");
        result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" }));
      });
      await drain();
      expect(inserts).toBe(1);
      expect(insertedRows[0]).toMatchObject({ chosen_peo: "TriNet" });
      await act(async () => { vi.advanceTimersByTime(2000); });
      await drain();
      // Either the row held everything, or exactly one save sent what it didn't.
      const saved = updates.map((u) => u.payload.chamber_data as { company_name?: string } | undefined);
      const held = (insertedRows[0].chamber_data as { company_name?: string }).company_name === "Acme";
      expect(held || saved.some((d) => d?.company_name === "Acme")).toBe(true);
      expect(inserts).toBe(1);
    });

    it("gives everyone waiting the one intake being created", async () => {
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      let ids: (string | null)[] = [];
      await act(async () => {
        ids = await Promise.all([result.current.ensureIntake(), result.current.ensureIntake(), result.current.ensureIntake()]);
      });
      expect(ids).toEqual(["s1", "s1", "s1"]);
      expect(inserts).toBe(1);
    });

    it("offers the intake another tab started first, rather than making a second", async () => {
      insertError = { message: "You already have an intake in progress", code: "EA009", details: "s7" };
      resumeRow = { id: "s7", data_version: 4, chamber_data: { company_name: "Other Tab Co" }, field_provenance: {}, transcript: [], status: "in_progress", submission: null, created_at: "2026-05-01T12:00:00Z" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      vi.useFakeTimers();
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "This Tab Co" })));
      await drain();
      expect(inserts).toBe(1);
      expect(readIds).toContain("s7");
      expect(result.current.sessionId).toBe("s7");
      expect(result.current.saveStatus).toBe("conflict");
      // Nothing is saved over the other tab's answers unless the prospect says so.
      await act(async () => { vi.advanceTimersByTime(2000); });
      await drain();
      expect(updates).toHaveLength(0);

      act(() => result.current.keepMine());
      await drain();
      expect(updates).toHaveLength(1);
      expect(updates[0].filters).toMatchObject({ id: "s7", data_version: 4 });
      expect(updates[0].payload).toHaveProperty("chamber_data.company_name", "This Tab Co");
    });

    it("or loads it, dropping what this tab had", async () => {
      insertError = { message: "You already have an intake in progress", code: "EA009", details: "s7" };
      resumeRow = { id: "s7", data_version: 4, chamber_data: { company_name: "Other Tab Co" }, field_provenance: {}, transcript: [], status: "in_progress", submission: null, created_at: "2026-05-01T12:00:00Z" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "This Tab Co" })));
      await waitFor(() => expect(result.current.saveStatus).toBe("conflict"));
      act(() => result.current.loadLatest());
      expect(result.current.chamberData.company_name).toBe("Other Tab Co");
      expect(result.current.saveStatus).toBe("saved");
    });
  });

  describe("start over", () => {
    it("archives the intake, then begins a blank one with a fresh greeting", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      const greeting = result.current.messages[0];

      let ok: boolean | undefined;
      await act(async () => { ok = await result.current.startOver(); });
      expect(ok).toBe(true);
      expect(rpcCalls).toEqual([{ fn: "archive_chamber_session", args: { p_session_id: "s1" } }]);
      // The archived intake is no longer the one on screen, so nothing (the address included) names it.
      expect(result.current.sessionId).toBeNull();
      expect(result.current.fileId).toBeNull();
      // Nothing new is created until the prospect starts again.
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(inserts).toBe(1);
      await startIntake(result);
      expect(inserts).toBe(2);
      expect(insertedRows[1].chamber_data).toMatchObject({ company_name: null });
      const transcript = insertedRows[1].transcript as { id: string; text: string; kind?: string }[];
      expect(transcript).toHaveLength(1);
      expect(transcript[0]).toMatchObject({ text: OPENING_MESSAGE, kind: "greeting" });
      expect(transcript[0].id).not.toBe(greeting.id);
      // The unsaved edit was left behind with the old intake, not sent.
      expect(updates).toHaveLength(0);
    });

    it("waits for a save already on its way, so it can't land on the archived intake", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      const saving = act(async () => { await result.current.retrySave(); });
      await saving;
      expect(updates).toHaveLength(1);
      let done = false;
      const pending = result.current.startOver().then(() => { done = true; });
      await drain();
      expect(rpcCalls).toHaveLength(0);
      updates[0].resolve({ error: null });
      await act(async () => { await pending; });
      expect(done).toBe(true);
      expect(rpcCalls).toHaveLength(1);
    });

    it("changes nothing when the intake couldn't be archived", async () => {
      rpcResult = { data: null, error: { message: "Failed to fetch" } };
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      let ok: boolean | undefined;
      await act(async () => { ok = await result.current.startOver(); });
      expect(ok).toBe(false);
      expect(result.current.sessionId).toBe("s1");
      expect(result.current.chamberData.company_name).toBe("Acme");
      expect(inserts).toBe(1);
    });

    it("keeps saving the intake it couldn't set aside: the edit held back for the archive still goes out", async () => {
      rpcResult = { data: null, error: { message: "Failed to fetch" } };
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      vi.useFakeTimers();
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      await act(async () => { await result.current.startOver(); });
      expect(updates).toHaveLength(0);
      await act(async () => { vi.advanceTimersByTime(2000); });
      expect(updates).toHaveLength(1);
      expect(updates[0].payload.chamber_data).toMatchObject({ company_name: "Acme" });
    });

    it("marks the conversation as replaced, so chat and voice drop what belonged to the old one", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      const before = result.current.conversationEpoch;
      await act(async () => { await result.current.startOver(); });
      expect(result.current.conversationEpoch).not.toBe(before);
    });

    it("goes ahead when the intake was already archived (a retry after a lost answer)", async () => {
      rpcResult = { data: null, error: { message: "Intake not found", code: "PT404" } };
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      let ok: boolean | undefined;
      await act(async () => { ok = await result.current.startOver(); });
      expect(ok).toBe(true);
      // Nothing new is created until the prospect starts again.
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(inserts).toBe(1);
      await startIntake(result);
      expect(inserts).toBe(2);
    });
  });

  describe("unsaved answers kept in the browser", () => {
    const key = "eaa.intake-backup.v1:u1:s1";
    const stored = () => JSON.parse(localStorage.getItem(key) ?? "null");

    it("keeps an edit until the save is confirmed, without the census", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.updateIntake((prev) => ({
        ...prev,
        data: { ...prev.data, company_name: "Acme", census: parseChamberData({ census: [{ first_name: "Sarah", work_state: "CA" }] }).census },
      })));
      await waitFor(() => expect(stored()?.chamber_data.company_name).toBe("Acme"));
      expect(stored().chamber_data).not.toHaveProperty("census");
      expect(stored().baseVersion).toBe(1);

      await act(async () => { await result.current.retrySave(); });
      await act(async () => { updates[0].resolve({ error: null }); });
      await waitFor(() => expect(result.current.saveStatus).toBe("saved"));
      expect(localStorage.getItem(key)).toBeNull();
    });

    it("keeps it when the save fails", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      await act(async () => { await result.current.retrySave(); });
      await act(async () => { updates[0].resolve({ error: networkError }); });
      await waitFor(() => expect(result.current.saveStatus).toBe("failed"));
      expect(stored()?.chamber_data.company_name).toBe("Acme");
    });

    const keptCopy = (over: Record<string, unknown> = {}) => writeBackup({
      userId: "u1",
      sessionId: "s7",
      baseVersion: 2,
      chamber_data: { ...parseChamberData({ company_name: "Acme Unsaved" }) } as unknown as Record<string, unknown>,
      field_provenance: { company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-11-01T00:00:00Z" } },
      transcript: [
        { id: "m1", sender: "lenore", text: OPENING_MESSAGE, timestamp: "", kind: "greeting" },
        { id: "m2", sender: "user", text: "We're Acme Unsaved", timestamp: "" },
      ],
      ...over,
    });
    const savedRow = (over: Record<string, unknown> = {}) => serverRow({
      id: "s7",
      data_version: 2,
      chamber_data: parseChamberData({ company_name: "Acme", census: [{ first_name: "Sarah", work_state: "CA" }] }),
      transcript: [{ id: "m1", sender: "lenore", text: OPENING_MESSAGE, timestamp: "", kind: "greeting" }],
      ...over,
    });

    it("offers them back when the intake is opened again, and restores them over what was loaded", async () => {
      keptCopy();
      resumeRow = savedRow();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.backupOffer).not.toBeNull());
      expect(result.current.backupOffer?.savedElsewhereSince).toBe(false);
      expect(result.current.chamberData.company_name).toBe("Acme");

      act(() => result.current.restoreBackup());
      expect(result.current.backupOffer).toBeNull();
      expect(result.current.chamberData.company_name).toBe("Acme Unsaved");
      // The census is the server's: the browser never kept it.
      expect(result.current.chamberData.census.map((e) => e.first_name)).toEqual(["Sarah"]);
      expect(result.current.messages.map((m) => m.text)).toEqual([OPENING_MESSAGE, "We're Acme Unsaved"]);
      expect(result.current.provenance.company_name?.status).toBe("confirmed");

      await act(async () => { await result.current.retrySave(); });
      expect(updates[0].filters).toEqual({ id: "s7", data_version: 2 });
      expect(updates[0].payload.chamber_data).toMatchObject({ company_name: "Acme Unsaved" });
    });

    it("warns when the intake was saved from somewhere else since", async () => {
      keptCopy();
      resumeRow = savedRow({ data_version: 4 });
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.backupOffer?.savedElsewhereSince).toBe(true));
    });

    it("forgets them when the prospect discards them", async () => {
      keptCopy();
      resumeRow = savedRow();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.backupOffer).not.toBeNull());
      act(() => result.current.discardBackup());
      expect(result.current.backupOffer).toBeNull();
      expect(readBackup("u1", "s7")).toBeNull();
      expect(result.current.chamberData.company_name).toBe("Acme");
    });

    it("leaves the copy alone while the prospect hasn't decided, even as they type", async () => {
      keptCopy();
      resumeRow = savedRow();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.backupOffer).not.toBeNull());
      act(() => result.current.setChamberData((prev) => ({ ...prev, industry: "Retail" })));
      await act(async () => { await result.current.retrySave(); });
      await act(async () => { updates[0].resolve({ error: null }); });
      expect(readBackup("u1", "s7")?.chamber_data.company_name).toBe("Acme Unsaved");
    });

    it("offers nothing, and forgets the copy, when the server already has exactly those answers", async () => {
      keptCopy({ chamber_data: { ...parseChamberData({ company_name: "Acme" }) }, field_provenance: {}, transcript: [{ id: "m1", sender: "lenore", text: OPENING_MESSAGE, timestamp: "", kind: "greeting" }] });
      resumeRow = savedRow();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.backupOffer).toBeNull();
      expect(readBackup("u1", "s7")).toBeNull();
    });

    it("leaves another tab's copy alone when this tab's save is confirmed", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Tab A" })));
      await act(async () => { void result.current.retrySave(); });
      expect(updates).toHaveLength(1);
      // Meanwhile another tab of the same intake keeps answers of its own that it hasn't saved.
      writeBackup({ userId: "u1", sessionId: "s1", baseVersion: 1, chamber_data: { ...parseChamberData({ company_name: "Tab B" }) } as unknown as Record<string, unknown>, field_provenance: {}, transcript: [] });
      await act(async () => { updates[0].resolve({ error: null }); });
      await waitFor(() => expect(result.current.saveStatus).toBe("saved"));
      expect(readBackup("u1", "s1")?.chamber_data.company_name).toBe("Tab B");
    });

    it("forgets this tab's copy when the prospect loads what another tab saved instead", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Mine" })));
      await waitFor(() => expect(readBackup("u1", "s1")?.chamber_data.company_name).toBe("Mine"));
      await act(async () => { void result.current.retrySave(); });
      resumeRow = serverRow({ id: "s1", data_version: 3 });
      await act(async () => { updates[0].resolve({ error: null, data: [] }); });
      await waitFor(() => expect(result.current.saveStatus).toBe("conflict"));
      act(() => result.current.loadLatest());
      expect(readBackup("u1", "s1")).toBeNull();
    });

    it("keeps the edits made while the old copy was on offer once the prospect discards it", async () => {
      keptCopy();
      resumeRow = savedRow();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.backupOffer).not.toBeNull());
      act(() => result.current.setChamberData((prev) => ({ ...prev, industry: "Retail" })));
      act(() => result.current.discardBackup());
      const now = readBackup("u1", "s7");
      expect(now?.chamber_data.industry).toBe("Retail");
      expect(now?.chamber_data.company_name).toBe("Acme");
    });

    it("never offers one person's copy to another", async () => {
      keptCopy({ userId: "u2" });
      resumeRow = savedRow();
      const { result } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.backupOffer).toBeNull();
    });
  });

  describe("when someone else signs in in this tab", () => {
    it("opens the linked intake for them after it couldn't be opened for the guest", async () => {
      const { result, rerender } = renderHook(() => useChamberSession("s7"));
      await waitFor(() => expect(result.current.resumeFailed).toBe(true));

      authUserId = "u2";
      resumeRow = serverRow({ id: "s7", chamber_data: { company_name: "Recovered Co" } });
      rerender();
      await waitFor(() => expect(result.current.sessionId).toBe("s7"));
      expect(result.current.resumeFailed).toBe(false);
      expect(result.current.chamberData.company_name).toBe("Recovered Co");
    });

    it("doesn't ask for the intake the guest had open, which was the guest's, not theirs", async () => {
      resumeRow = serverRow({ id: "g1", chamber_data: { company_name: null } });
      const { result, rerender } = renderHook(() => useChamberSession("g1"));
      await waitFor(() => expect(result.current.sessionId).toBe("g1"));
      readIds.length = 0;

      authUserId = "u2";
      latestRow = { id: "s8" };
      resumeRow = serverRow({ id: "s8", chamber_data: { company_name: "Mine Inc" } });
      rerender();
      await waitFor(() => expect(result.current.sessionId).toBe("s8"));
      expect(readIds).toEqual(["s8"]);
      expect(result.current.resumeFailed).toBe(false);
    });

    it("drops the guest's blank intake and opens their own latest one", async () => {
      const { result, rerender } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.addMessage(createChatMessage("user", "hello")));

      authUserId = "u2";
      latestRow = { id: "s8" };
      resumeRow = serverRow({ id: "s8", chamber_data: { company_name: "Mine Inc" }, transcript: [] });
      rerender();
      await waitFor(() => expect(result.current.sessionId).toBe("s8"));
      expect(result.current.chamberData.company_name).toBe("Mine Inc");
      expect(result.current.messages.map((m) => m.text)).toEqual([OPENING_MESSAGE]);
      expect(latestQueries.at(-1)?.[1]).toBe("u2");
    });

    it("doesn't carry the guest's chosen PEO into the new person's blank intake", async () => {
      const { result, rerender } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.choosePeo("Justworks"));
      expect(result.current.chosenPeo).toBe("Justworks");

      authUserId = "u2"; // no open intake of their own, so a blank one is shown for them
      rerender();
      // Nothing new is created until the new person starts.
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(inserts).toBe(1);
      await startIntake(result);
      expect(inserts).toBe(2);
      expect(insertedRows[1]).toMatchObject({ user_id: "u2", chosen_peo: null });
      expect(result.current.chosenPeo).toBeNull();
    });
  });

  describe("the conversation", () => {
    it("keeps one greeting: a voice session's own hello is not added again", async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.addMessage(createChatMessage("lenore", "Hi — I'm Lenore.", { kind: "greeting" })));
      expect(result.current.messages).toHaveLength(1);
      act(() => result.current.addMessage(createChatMessage("lenore", "Noted.")));
      expect(result.current.messages).toHaveLength(2);
    });

    it("drops repeated greetings from a saved transcript and marks where the restored conversation ends", async () => {
      resumeRow = serverRow({
        id: "s9",
        transcript: [
          { id: "a", sender: "lenore", text: OPENING_MESSAGE, timestamp: "" },
          { id: "b", sender: "lenore", text: OPENING_MESSAGE, timestamp: "" },
          { id: "c", sender: "user", text: "We're Acme", timestamp: "" },
          { id: "d", sender: "lenore", text: "Welcome back. Hello again!", timestamp: "", kind: "greeting" },
          { id: "e", sender: "lenore", text: "Noted.", timestamp: "" },
        ],
      });
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));
      expect(result.current.messages.map((m) => m.id)).toEqual(["a", "c", "e"]);
      expect(result.current.restoredThrough).toBe("e");
    });

    it("marks nothing as restored when the saved conversation is only the greeting", async () => {
      resumeRow = serverRow({ id: "s9", transcript: [{ id: "a", sender: "lenore", text: OPENING_MESSAGE, timestamp: "" }] });
      const { result } = renderHook(() => useChamberSession("s9"));
      await waitFor(() => expect(result.current.sessionId).toBe("s9"));
      expect(result.current.restoredThrough).toBeNull();
    });
  });

  // QA F2: the database refused a certification sent with a guest's token, and the page said only "We couldn't save
  // your submission" while the console logged `Object`.
  describe("certifying with a guest's token", () => {
    // Starts an intake, saves an answer and certifies: updates[0] is the autosave, updates[1] the certification.
    const certify = async () => {
      const { result } = renderHook(() => useChamberSession());
      await startIntake(result);
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));
      let ok: SubmitResult | undefined;
      const pending = result.current.submit(submission).then((r) => { ok = r; });
      await drain();
      await act(async () => { updates[0].resolve({ error: null }); });
      await drain();
      return { result, pending, ok: () => ok };
    };

    it("refreshes a token minted before the prospect verified (in another tab), then certifies with it", async () => {
      heldToken = token(true);
      refreshedToken = token(false);
      const { result, pending, ok } = await certify();
      expect(refreshes).toBe(1);
      expect(updates).toHaveLength(2);
      await act(async () => { updates[1].resolve({ error: null }); await pending; });
      expect(ok()).toBe(true);
      expect(result.current.certification.status).toBe("certified");
    });

    it("doesn't refresh a token that is already a verified account's", async () => {
      heldToken = token(false);
      const { pending, ok } = await certify();
      expect(refreshes).toBe(0);
      await act(async () => { updates[1].resolve({ error: null }); await pending; });
      expect(ok()).toBe(true);
    });

    it("asks the prospect to verify, sending nothing, when the sign-in is still a guest's after a refresh", async () => {
      heldToken = token(true);
      refreshedToken = token(true);
      const { pending, ok } = await certify();
      await act(async () => { await pending; });
      expect(updates).toHaveLength(1);
      expect(ok()).toEqual({ message: VERIFY_EMAIL_MESSAGE, verifyEmail: true });
    });

    it("says why when the database refuses a guest's certification", async () => {
      const { pending, ok } = await certify();
      await act(async () => {
        updates[1].resolve({ error: { code: "42501", message: "An email-verified account is required to certify an intake" } });
        await pending;
      });
      expect(ok()).toEqual({ message: VERIFY_EMAIL_MESSAGE, verifyEmail: true });
    });

    it("logs any other refusal as one line with an error code, and shows the prospect that code", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { pending, ok } = await certify();
      await act(async () => { updates[1].resolve({ error: { code: "XX000", message: "internal error" } }); await pending; });
      const result = ok() as { message: string; errorCode: string };
      expect(result).toEqual(UNEXPLAINED);
      expect(result.message).toContain("Something went wrong on our side");
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0]).toEqual([`Failed to submit session, database code XX000 (error code ${result.errorCode}): XX000: internal error`]);
      error.mockRestore();
    });

    it("says the server couldn't be reached when the request never got there", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { pending, ok } = await certify();
      await act(async () => { updates[1].resolve({ error: networkError }); await pending; });
      expect((ok() as { message: string }).message).toMatch(/^We couldn't reach our server/);
      error.mockRestore();
    });
  });

  it("reports, by path only, saved answers that don't match the intake schema, and loads what is valid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resumeRow = serverRow({ id: "s9", chamber_data: { company_name: "Acme", hq_state: "California", employees: [] } });
    const { result } = renderHook(() => useChamberSession("s9"));
    await waitFor(() => expect(result.current.sessionId).toBe("s9"));
    expect(result.current.chamberData.company_name).toBe("Acme");
    expect(result.current.chamberData.hq_state).toBeNull();
    const [message, issues] = warn.mock.calls[0];
    expect(message).toMatch(/intake schema v3/);
    expect(issues).toEqual(["hq_state must be a US state or territory code such as CA", "employees is not a known intake field"]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("California");
    warn.mockRestore();
  });
});
