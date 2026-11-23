import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

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

  // Catches: a carrier offered where a PEO is chosen (the intake's PEO Match, a PEO search's send), which every screen written before lines would do if the
  // catalog simply grew; or a workers' comp search offered PEOs to send to.
  it("gives the markets of the line asked for: PEOs unless a line is named, and never one of another line", async () => {
    rpcResult = {
      data: [
        { id: 1, name: "ADP TotalSource", line: "peo", profile: null },
        { id: 9, name: "Granite Ridge Mutual", line: "workers_comp", profile: null },
        { id: 5, name: "TriNet", profile: null },
      ],
      error: null,
    };
    const peos = renderHook(() => usePeoCatalog());
    await waitFor(() => expect(peos.result.current.status).toBe("ready"));
    expect(peos.result.current.peos.map((p) => p.name)).toEqual(["ADP TotalSource", "TriNet"]);
    const carriers = renderHook(() => usePeoCatalog(true, "workers_comp"));
    await waitFor(() => expect(carriers.result.current.status).toBe("ready"));
    expect(carriers.result.current.peos.map((p) => p.name)).toEqual(["Granite Ridge Mutual"]);
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
    expect(result.current.peos.map((p) => [p.name, p.profile?.rules.minHeadcount ?? null, p.lastVerified])).toEqual([
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

  it("reads the PEOs again when asked to retry after they couldn't be read", async () => {
    rpcResult = { data: null, error: { message: "network down" } };
    const { result } = renderHook(() => usePeoCatalog());
    await waitFor(() => expect(result.current.status).toBe("failed"));
    rpcResult = { data: [{ id: 1, name: "TriNet", profile: null }], error: null };
    act(() => result.current.retry());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.peos.map((p) => p.name)).toEqual(["TriNet"]);
    expect(rpcCalls).toEqual([["peo_catalog"], ["peo_catalog"]]);
  });

  it("reads nothing until it is asked to, such as before the reader is signed in", async () => {
    rpcResult = { data: [{ id: 1, name: "TriNet", profile: null }], error: null };
    const { result, rerender } = renderHook(({ enabled }) => usePeoCatalog(enabled), { initialProps: { enabled: false } });
    expect(result.current).toMatchObject({ peos: [], status: "loading" });
    expect(rpcCalls).toEqual([]);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.peos.map((p) => p.name)).toEqual(["TriNet"]);
  });
});
