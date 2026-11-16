import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The hook that notes a record as opened (story CRM-S1.2a, D-620): whose recent list it writes to, when people change in the same tab.

const auth = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const search = vi.hoisted(() => ({ noteRecentRecord: vi.fn() }));
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), ...search }));

const { useNoteOpened, RECENT_RECORDS_KEY } = await import("./useNoteOpened");
const { setSignedInUser } = await import("@/lib/signedInUser");

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
let queries: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queries}>{children}</QueryClientProvider>;

beforeEach(() => {
  auth.userId = "u1";
  setSignedInUser("u1");
  queries = new QueryClient();
  search.noteRecentRecord.mockReset().mockResolvedValue(true);
});
afterEach(() => cleanup());

describe("useNoteOpened", () => {
  it("notes the record and asks for this person's recent records again", async () => {
    const spy = vi.spyOn(queries, "invalidateQueries");
    renderHook(() => useNoteOpened("f1", "account", "a1", true), { wrapper });
    await settle();
    expect(search.noteRecentRecord).toHaveBeenCalledWith("f1", "account", "a1");
    expect(spy).toHaveBeenCalledWith({ queryKey: [...RECENT_RECORDS_KEY, "f1", "u1"] });
  });

  it("notes nothing when nobody is signed in", async () => {
    auth.userId = null;
    renderHook(() => useNoteOpened("f1", "account", "a1", true), { wrapper });
    await settle();
    expect(search.noteRecentRecord).not.toHaveBeenCalled();
  });

  it("drops a note that was waiting when the person changed, so it never lands in the next person's list", async () => {
    let finishFirst: (noted: boolean) => void = () => {};
    search.noteRecentRecord.mockReturnValueOnce(new Promise<boolean>((resolve) => { finishFirst = resolve; }));
    const first = renderHook(() => useNoteOpened("f1", "account", "a1", true), { wrapper });
    // A second note queues behind the first, which is still in flight.
    const second = renderHook(() => useNoteOpened("f1", "contact", "c1", true), { wrapper });
    await settle();
    expect(search.noteRecentRecord).toHaveBeenCalledTimes(1);

    first.unmount();
    second.unmount();
    auth.userId = "u2";
    setSignedInUser("u2");
    const next = renderHook(() => useNoteOpened("f1", "account", "a2", true), { wrapper });
    finishFirst(true);
    await settle();

    expect(search.noteRecentRecord.mock.calls.map((c) => c.slice(1))).toEqual([["account", "a1"], ["account", "a2"]]);
    next.unmount();
  });

  it("drops a waiting note even when the next person opens no record page (who is signed in comes from the app's boundary, not the pages)", async () => {
    let finishFirst: (noted: boolean) => void = () => {};
    search.noteRecentRecord.mockReturnValueOnce(new Promise<boolean>((resolve) => { finishFirst = resolve; }));
    const first = renderHook(() => useNoteOpened("f1", "account", "a1", true), { wrapper });
    const second = renderHook(() => useNoteOpened("f1", "contact", "c1", true), { wrapper });
    await settle();
    first.unmount();
    second.unmount();
    // The person signs out and another signs in; no page that notes records is open.
    setSignedInUser(null);
    setSignedInUser("u2");
    finishFirst(true);
    await settle();

    expect(search.noteRecentRecord.mock.calls.map((c) => c.slice(1))).toEqual([["account", "a1"]]);
  });
});
