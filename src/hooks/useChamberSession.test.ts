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
let inserts = 0;
const insertedRows: Record<string, unknown>[] = [];
const insertedColumns: string[] = [];
let insertError: { message: string } | null = null;
// The prospect's latest unfinished intake, as the lookup on a bare /start finds it.
let latestRow: { id: string } | null = null;
let latestError: { message: string } | null = null;
const latestQueries: unknown[][] = [];

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, session: { access_token: "tok" } }) }));
vi.mock("@/lib/dispatchOutbox", () => ({ dispatchOutbox: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => ({
        eq: (column: string, value: unknown) =>
          column === "id"
            ? {
                maybeSingle: async () => {
                  reads.push(columns);
                  return readError ? { data: null, error: readError } : { data: resumeRow, error: null };
                },
              }
            : {
                neq: (notColumn: string, notValue: unknown) => ({
                  order: (orderColumn: string, order: unknown) => ({
                    limit: (n: number) => ({
                      maybeSingle: async () => {
                        latestQueries.push([column, value, notColumn, notValue, orderColumn, order, n]);
                        return latestError ? { data: null, error: latestError } : { data: latestRow, error: null };
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
                insertError ? { data: null, error: insertError } : { data: { id: "s1", data_version: 1 }, error: null },
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

const { useChamberSession, describeInvalidPath } = await import("./useChamberSession");
const { dispatchOutbox } = await import("@/lib/dispatchOutbox");
const { applyExtraction } = await import("@/data/provenance");
const { parseChamberData } = await import("@/data/chamberValidation");
const { createChatMessage } = await import("@/data/chat");

// Lets queued promise callbacks run while fake timers are active (waitFor would hang).
const drain = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

type SubmitResult = boolean | { message: string };

// The saved row as another tab (or the server) has it.
const serverRow = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  data_version: 5,
  status: "in_progress",
  chamber_data: { company_name: "Elsewhere Inc" },
  field_provenance: {},
  transcript: [],
  submission: null,
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
    insertedColumns.length = 0;
    inserts = 0;
    insertedRows.length = 0;
    insertError = null;
    latestRow = null;
    latestError = null;
    latestQueries.length = 0;
    vi.mocked(dispatchOutbox).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for an in-flight autosave before submitting", async () => {
    const { result } = renderHook(() => useChamberSession());
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));

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
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));

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
    await act(async () => { updates[1].resolve({ error: { message: "offline" } }); await pending; });
    expect(submitted).toBe(false);
    expect(updates.some((u) => u.payload.status === "submitted")).toBe(false);
  });

  it("snapshots the signed data on submission", async () => {
    const { result } = renderHook(() => useChamberSession());
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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

  it("starts a fresh session only once the prospect asks for one", async () => {
    const { result } = renderHook(() => useChamberSession("old-session"));
    await waitFor(() => expect(result.current.resumeFailed).toBe(true));

    act(() => result.current.startNew());
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));

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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
      const pending = result.current.submit(submission);
      await waitFor(() => expect(updates).toHaveLength(1));
      await act(async () => { updates[0].resolve({ error: { message: "refused" } }); await pending; });
      expect(result.current.certification.status).toBe("none");
    });
  });

  it("refuses to certify answers that changed after they were signed", async () => {
    const { result } = renderHook(() => useChamberSession());
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
    await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));

      let ok: SubmitResult | undefined;
      const pending = result.current.submit(submission).then((r) => { ok = r; });
      await drain();
      await act(async () => { updates[0].resolve({ error: null }); });
      await drain();
      await act(async () => { updates[1].resolve({ error: { message: "boom" } }); await pending; });
      expect(ok).toBe(false);
      expect(dispatchOutbox).not.toHaveBeenCalled();
    });

    it("does nothing when the answers changed after they were signed", async () => {
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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

    it("looks only at the prospect's own intakes that aren't submitted, most recently changed first", async () => {
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
      expect(latestQueries).toEqual([["user_id", "u1", "status", "submitted", "updated_at", { ascending: false }, 1]]);
    });

    it("starts a new intake when they have no unfinished one", async () => {
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
      expect(result.current.loadFailed).toBe(false);
      expect(inserts).toBe(1);
    });

    it("starts a new intake, not the unfinished one, when the prospect asks for a new one", async () => {
      const { result } = renderHook(() => useChamberSession("missing"));
      await waitFor(() => expect(result.current.resumeFailed).toBe(true));
      latestRow = { id: "s7" };
      resumeRow = openRow;
      act(() => result.current.startNew());
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
      expect(inserts).toBe(1);
    });
  });

  describe("save status", () => {
    const edit = (result: { current: ReturnType<typeof useChamberSession> }) =>
      act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme" })));

    it("says nothing until something changes, then saving, then saved once the row comes back", async () => {
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
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
      await waitFor(() => expect(result.current.sessionId).toBe("s1"));
      resumeRow = serverRow({ data_version: 1 });
      let ok: SubmitResult | undefined;
      const pending = result.current.submit(submission).then((r) => { ok = r; });
      await waitFor(() => expect(updates).toHaveLength(1));
      await act(async () => { updates[0].resolve({ error: null, data: [] }); await pending; });
      expect(ok).toBe(false);
      expect(result.current.certification.status).not.toBe("certified");
    });

    it("says not saved when the intake can't be created, and Retry creates it from what's on screen", async () => {
      insertError = { message: "offline" };
      const { result } = renderHook(() => useChamberSession());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sessionId).toBeNull();
      expect(result.current.saveStatus).toBe("failed");

      vi.useFakeTimers();
      edit(result);
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
      await waitFor(() => expect(hook.result.current.sessionId).toBe("s1"));
      vi.useFakeTimers();
      return hook;
    };

    it("writes against the version the server gave a new intake, naming only the row and the version", async () => {
      const { result } = await open();
      expect(insertedColumns).toEqual(["id, data_version"]);
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
        expect(updates[1].columns).toBe("id, data_version, status");
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
          expect(await first).toBe(false);
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
          expect(await first).toBe(false);
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
});
