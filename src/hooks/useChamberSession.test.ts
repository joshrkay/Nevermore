import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type UpdateResult = { error: { message: string } | null };

const updates: { payload: Record<string, unknown>; resolve: (r: UpdateResult) => void }[] = [];

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, session: { access_token: "tok" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "s1" }, error: null }) }) }),
      update: (payload: Record<string, unknown>) => ({
        eq: () => new Promise<UpdateResult>((resolve) => updates.push({ payload, resolve })),
      }),
    }),
  },
}));

const { useChamberSession } = await import("./useChamberSession");

// Lets queued promise callbacks run while fake timers are active (waitFor would hang).
const drain = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

const submission = { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-01-01T00:00:00Z", file_id: "EAA-1" };

describe("useChamberSession", () => {
  beforeEach(() => {
    updates.length = 0;
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
});
