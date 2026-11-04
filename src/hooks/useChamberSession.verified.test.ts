// The advisor-verified set must track the answers the advisor saw (B-2.1): it is read again whenever a row is
// loaded, tied to the answers each verification covered, and so never badges an answer that has since changed.
// The server resets a review when its answer changes (chamber_sessions_reset_changed_reviews), so a re-read
// after another tab's change no longer returns the field.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type Row = Record<string, unknown>;

let resumeRow: Row | null = null;
let rpcData: unknown = [];
let rpcCalls = 0;
// While set, the verified-fields read waits for `answerRpc`.
let deferRpc = false;
let pending: ((value: { data: unknown; error: null }) => void)[] = [];

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, session: { access_token: "tok" } }) }));
vi.mock("@/lib/dispatchOutbox", () => ({ dispatchOutbox: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () => {
      rpcCalls += 1;
      return deferRpc
        ? new Promise((resolve) => { pending.push(resolve as never); })
        : Promise.resolve({ data: rpcData, error: null });
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: resumeRow, error: null }) }) }),
      update: () => {
        const chain = { eq: () => chain, select: () => new Promise(() => {}) };
        return chain;
      },
    }),
  },
}));

const { useChamberSession } = await import("./useChamberSession");

const row = (chamber_data: Row, over: Row = {}) => ({
  id: "s7", data_version: 2, status: "in_progress", chamber_data, field_provenance: {}, transcript: [], submission: null,
  created_at: "2026-11-01T00:00:00Z", ...over,
});
const verified = (result: { current: { verifiedFields: ReadonlySet<string> } }) => [...result.current.verifiedFields].sort();
const answerRpc = async (fields: string[]) => {
  await act(async () => { pending.shift()!({ data: fields, error: null }); });
};

beforeEach(() => {
  resumeRow = null; rpcData = []; rpcCalls = 0; deferRpc = false; pending = []; localStorage.clear();
});

describe("useChamberSession: the verified set follows the answers it covered", () => {
  it("drops a verification when an edit lands before the first read does", async () => {
    resumeRow = row({ company_name: "Acme Bindery", pay_frequency: "Weekly" });
    deferRpc = true;
    const { result } = renderHook(() => useChamberSession("s7"));
    await waitFor(() => expect(pending).toHaveLength(1));
    // A chat or voice extraction changes the company name before the read answers.
    act(() => result.current.updateIntake((prev) => ({ data: { ...prev.data, company_name: "Beta LLC" }, provenance: prev.provenance })));
    await answerRpc(["company_name", "pay_frequency"]);
    await waitFor(() => expect(verified(result)).toEqual(["pay_frequency"]));
  });

  it("reads again when the latest saved row is loaded, so another tab's change drops the badge", async () => {
    resumeRow = row({ company_name: "Acme Bindery" });
    rpcData = ["company_name"];
    const { result } = renderHook(() => useChamberSession("s7"));
    await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
    // Another tab changed the answer, and the server reset that review.
    resumeRow = row({ company_name: "Totally Different Corp" }, { data_version: 9 });
    rpcData = [];
    await act(async () => { result.current.discardChanges(); });
    await waitFor(() => expect(result.current.chamberData.company_name).toBe("Totally Different Corp"));
    await waitFor(() => expect(verified(result)).toEqual([]));
    expect(rpcCalls).toBe(2);
  });

  it("hides a verification at once when the loaded row's answer differs, before the new read lands", async () => {
    resumeRow = row({ company_name: "Acme Bindery" });
    rpcData = ["company_name"];
    const { result } = renderHook(() => useChamberSession("s7"));
    await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
    resumeRow = row({ company_name: "Totally Different Corp" }, { data_version: 9 });
    deferRpc = true;
    await act(async () => { result.current.discardChanges(); });
    await waitFor(() => expect(result.current.chamberData.company_name).toBe("Totally Different Corp"));
    // The server hasn't answered the second read yet; the first answer no longer fits what is on screen.
    expect(verified(result)).toEqual([]);
  });

  it("brings a verification back when a local edit is discarded and the server still holds it", async () => {
    resumeRow = row({ company_name: "Acme Bindery" });
    rpcData = ["company_name"];
    const { result } = renderHook(() => useChamberSession("s7"));
    await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
    act(() => result.current.setChamberData((prev) => ({ ...prev, company_name: "Acme Press" })));
    expect(verified(result)).toEqual([]);
    await act(async () => { result.current.discardChanges(); });
    await waitFor(() => expect(result.current.chamberData.company_name).toBe("Acme Bindery"));
    await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
  });

  it("keeps a verification while its answer is unchanged, however the rest of the intake moves", async () => {
    resumeRow = row({ company_name: "Acme Bindery", pay_frequency: "Weekly" });
    rpcData = ["company_name"];
    const { result } = renderHook(() => useChamberSession("s7"));
    await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
    act(() => result.current.setChamberData((prev) => ({ ...prev, pay_frequency: "Bi-weekly", industry: "Printing" })));
    expect(verified(result)).toEqual(["company_name"]);
  });

  it("doesn't show a legacy roster as verified: saving rewrites its key, and the server resets that review", async () => {
    // Rosters saved before the census contract are keyed `employees`; the browser reads them as the census and
    // never writes that key back, so the first save of any edit drops it.
    resumeRow = row({ company_name: "Acme", employees: [{ first_name: "A", last_name: "B", state: "NY" }] });
    rpcData = ["census", "company_name"];
    const { result } = renderHook(() => useChamberSession("s7"));
    await waitFor(() => expect(verified(result)).toEqual(["company_name"]));
  });
});
