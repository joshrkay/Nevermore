import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const rpcCalls: unknown[][] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      rpcCalls.push(args);
      return Promise.resolve(rpcResult);
    },
  },
}));

const { usePeoCatalog } = await import("./usePeoCatalog");

describe("usePeoCatalog", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("reads the PEOs from the database, alphabetically as it returns them, with each one's profile in use", async () => {
    rpcResult = {
      data: [
        { id: 1, name: "ADP TotalSource", profile: null },
        { id: 5, name: "TriNet", profile: { version: 1, min_headcount: 10, states_served: null, excluded_class_codes: null, sources: { min_headcount: { kind: "person", name: "Dana Reyes", role: "Broker desk", checked_on: "2026-11-02" } } } },
      ],
      error: null,
    };
    const { result } = renderHook(() => usePeoCatalog());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(rpcCalls).toEqual([["peo_catalog"]]);
    expect(result.current.peos.map((p) => [p.name, p.minHeadcount, p.lastVerified])).toEqual([
      ["ADP TotalSource", null, null],
      ["TriNet", 10, "2026-11-02"],
    ]);
  });

  it("says when the PEOs can't be read, and offers none", async () => {
    rpcResult = { data: null, error: { message: "network down" } };
    const { result } = renderHook(() => usePeoCatalog());
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.peos).toEqual([]);
  });

  it("reads nothing until it is asked to, such as before the reader is signed in", async () => {
    rpcResult = { data: [{ id: 1, name: "TriNet", profile: null }], error: null };
    const { result, rerender } = renderHook(({ enabled }) => usePeoCatalog(enabled), { initialProps: { enabled: false } });
    expect(result.current).toEqual({ peos: [], status: "loading" });
    expect(rpcCalls).toEqual([]);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.peos.map((p) => p.name)).toEqual(["TriNet"]);
  });
});
