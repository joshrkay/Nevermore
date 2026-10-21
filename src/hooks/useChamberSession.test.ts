import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type UpdateResult = { error: { message: string } | null };

const updates: { payload: Record<string, unknown>; resolve: (r: UpdateResult) => void }[] = [];
let resumeRow: Record<string, unknown> | null = null;
let inserts = 0;

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, session: { access_token: "tok" } }) }));
vi.mock("@/lib/dispatchOutbox", () => ({ dispatchOutbox: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: resumeRow, error: null }) }) }),
      insert: () => {
        inserts += 1;
        return { select: () => ({ single: async () => ({ data: { id: "s1" }, error: null }) }) };
      },
      update: (payload: Record<string, unknown>) => ({
        eq: () => new Promise<UpdateResult>((resolve) => updates.push({ payload, resolve })),
      }),
    }),
  },
}));

const { useChamberSession } = await import("./useChamberSession");
const { dispatchOutbox } = await import("@/lib/dispatchOutbox");
const { applyExtraction } = await import("@/data/provenance");

// Lets queued promise callbacks run while fake timers are active (waitFor would hang).
const drain = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

const submission = { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-01-01T00:00:00Z", file_id: "EAA-1" };

describe("useChamberSession", () => {
  beforeEach(() => {
    updates.length = 0;
    resumeRow = null;
    inserts = 0;
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

    let submitted: boolean | undefined;
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

    let submitted: boolean | undefined;
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
    expect(url).toContain("/rest/v1/chamber_sessions?id=eq.s1");
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
      chamber_data: { company_name: "Acme" },
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

      let ok: boolean | undefined;
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
      expect(payload.chamber_data).toMatchObject({ company_name: "Acme", employees: [] }); // normalized, not the sparse row
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
    let submitted: boolean | undefined;
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

    let submitted: boolean | undefined;
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

      let ok: boolean | undefined;
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
});
