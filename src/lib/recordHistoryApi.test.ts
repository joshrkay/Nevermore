import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { listRecordHistory, historyCauseText } = await import("./recordHistoryApi");

beforeEach(() => rpc.mockReset());

const entry = {
  entry_key: "k1", at: "2026-11-20T10:00:00+00:00", change_id: "k1", kind: "stage_changed", who: "dana@acme.test", who_kind: "member",
  field: "stage", from_value: "ready_to_send", to_value: "in_market", cause: "quote_send", cause_peo: "PEO B", merged_from: null,
};

describe("listRecordHistory", () => {
  // Break caught: an opportunity's stage change reaches the page without who or what caused it ("by the send to PEO B, Dana Reyes", D-413).
  it("carries a stage change with the stages and the cause the database gave it", async () => {
    rpc.mockResolvedValue({ data: [entry], error: null });
    const page = await listRecordHistory("f1", "opportunities", "o1");
    expect(page.entries).toEqual([
      {
        entryKey: "k1", at: "2026-11-20T10:00:00+00:00", changeId: "k1", kind: "stage_changed", who: "dana@acme.test", whoKind: "member",
        field: "stage", from: "ready_to_send", to: "in_market", cause: "quote_send", causePeo: "PEO B", mergedFrom: null,
      },
    ]);
  });

  // Break caught: an entry of the record's own fields grows a cause it never had.
  it("gives an entry of a field no cause", async () => {
    rpc.mockResolvedValue({ data: [{ ...entry, kind: "changed", field: "next_step", from_value: null, to_value: "Call", cause: null, cause_peo: null }], error: null });
    const page = await listRecordHistory("f1", "opportunities", "o1");
    expect(page.entries[0]).toMatchObject({ kind: "changed", cause: null, causePeo: null });
  });

  // Break caught: an entry a merge copied from the merged-away record shown as the kept record's own (D-203: "marked as from the merged record"), or the "merged" entry dropped.
  it("carries which merged-away record an entry came from", async () => {
    rpc.mockResolvedValue({
      data: [
        { ...entry, entry_key: "m1", kind: "merged", field: null, from_value: null, to_value: null, cause: null, cause_peo: null, merged_from: "Harborview Marine LLC" },
        { ...entry, entry_key: "m2", kind: "changed", field: "phone", from_value: null, to_value: "(503) 555-0100", cause: null, cause_peo: null, merged_from: "Harborview Marine LLC" },
      ],
      error: null,
    });
    const page = await listRecordHistory("f1", "accounts", "a1");
    expect(page.entries.map((e) => [e.kind, e.mergedFrom])).toEqual([["merged", "Harborview Marine LLC"], ["changed", "Harborview Marine LLC"]]);
  });

  // Break caught: the cursor of the next page is not the last entry's time and key, so a page repeats or skips entries that share a time.
  it("continues from the last entry's time and key when the page is full", async () => {
    rpc.mockResolvedValue({ data: [entry], error: null });
    const page = await listRecordHistory("f1", "opportunities", "o1", { limit: 1 });
    expect(page.next).toEqual({ at: "2026-11-20T10:00:00+00:00", entryKey: "k1" });
    expect(rpc).toHaveBeenCalledWith("record_history_list", { p_firm_id: "f1", p_table: "opportunities", p_key: "o1", p_limit: 1, p_after_at: null, p_after_key: null });
  });
});

describe("the quote taken (D-473)", () => {
  // Break caught: a win's cause (quote_taken) is dropped on the way to the page, so the history of an opportunity says it was won but not on whose quote.
  it("carries a win's cause and the PEO whose quote was taken", async () => {
    rpc.mockResolvedValue({ data: [{ ...entry, from_value: "quoted", to_value: "won", cause: "quote_taken", cause_peo: "Justworks" }], error: null });
    const page = await listRecordHistory("f1", "opportunities", "o1");
    expect(page.entries[0]).toMatchObject({ field: "stage", from: "quoted", to: "won", cause: "quote_taken", causePeo: "Justworks" });
  });

  // Break caught: a cause the app does not know is shown as if it were one it does, or keeps its PEO with no cause to name it.
  it("reads a cause it does not know as none", async () => {
    rpc.mockResolvedValue({ data: [{ ...entry, cause: "something_new" }], error: null });
    const page = await listRecordHistory("f1", "opportunities", "o1");
    expect(page.entries[0]).toMatchObject({ cause: null, causePeo: null });
  });

  // Break caught: the cause is shown as a code ("quote_taken"), or without the PEO, or a missing PEO leaves a hole in the sentence.
  it("words each cause in the person's terms", () => {
    expect(historyCauseText("quote_taken", "Justworks")).toBe("the quote from Justworks was taken");
    expect(historyCauseText("quote_taken", null)).toBe("the quote was taken");
    expect(historyCauseText("quote_recorded", "TriNet")).toBe("the quote from TriNet was recorded");
    expect(historyCauseText("quote_send", "TriNet")).toBe("the send to TriNet");
    expect(historyCauseText(null, "TriNet")).toBeNull();
  });
});
