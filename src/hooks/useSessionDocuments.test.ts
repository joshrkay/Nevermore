import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type Result = { data?: unknown; error: { message: string } | null };

const calls: { op: string; args: unknown[] }[] = [];
let listRows: Record<string, unknown>[] = [];
let insertResult: Result = { data: null, error: null };
let deleteResult: Result = { error: null };
let storageRemoveResult: Result = { error: null };
let uploadGate: Promise<void> | null = null;

const row = (over: Record<string, unknown> = {}) => ({
  id: "d1", file_name: "census.csv", file_size: "1 KB", size_bytes: 1024, mime_type: "text/csv",
  category: "census", status: "uploaded", created_at: "2026-10-20T00:00:00Z",
  storage_path: "u1/s1/x_census.csv", extraction: null, ...over,
});

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => {
  const log = (op: string, ...args: unknown[]) => calls.push({ op, args });
  return {
    supabase: {
      from: () => ({
        select: () => ({
          eq: (col: string, val: unknown) => {
            log("select.eq", col, val);
            return {
              order: async () => ({ data: listRows, error: null }),
              maybeSingle: async () => ({ data: row({ id: val, status: "extracted" }), error: null }),
            };
          },
        }),
        insert: (payload: unknown) => {
          log("insert", payload);
          return { select: () => ({ single: async () => insertResult }), then: (r: (v: Result) => void) => r({ error: null }) };
        },
        delete: () => ({ eq: async (_c: string, id: unknown) => { log("delete", id); return deleteResult; } }),
        update: (payload: unknown) => ({ eq: async () => { log("update", payload); return { error: null }; } }),
      }),
      storage: {
        from: () => ({
          upload: async (path: string) => { log("storage.upload", path); await uploadGate; return { error: null }; },
          remove: async (paths: string[]) => { log("storage.remove", paths); return storageRemoveResult; },
        }),
      },
      functions: { invoke: async (name: string, opts: unknown) => { log("invoke", name, opts); return { data: {}, error: null }; } },
    },
  };
});

const { useSessionDocuments } = await import("./useSessionDocuments");

describe("useSessionDocuments", () => {
  beforeEach(() => {
    calls.length = 0;
    listRows = [];
    insertResult = { data: null, error: null };
    deleteResult = { error: null };
    storageRemoveResult = { error: null };
    uploadGate = null;
  });

  it("lists only the open intake's documents", async () => {
    listRows = [row()];
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    expect(calls).toContainEqual({ op: "select.eq", args: ["session_id", "s1"] });
  });

  it("stores uploads under the intake, records metadata, then reads them", async () => {
    insertResult = { data: row({ id: "d9" }), error: null };
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const file = new File(["First,Last\nAnn,Lee"], "Employee Census.csv", { type: "text/csv" });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([file]); });
    expect(outcome).toEqual({ saved: 1, failed: [] });

    const path = calls.find((c) => c.op === "storage.upload")!.args[0] as string;
    expect(path).toMatch(/^u1\/s1\/[0-9a-f-]+_Employee_Census\.csv$/);
    expect(calls.find((c) => c.op === "insert")!.args[0]).toMatchObject({
      user_id: "u1", session_id: "s1", file_name: "Employee Census.csv", size_bytes: file.size,
      mime_type: "text/csv", category: "census", storage_path: path,
    });
    await waitFor(() => expect(calls).toContainEqual({ op: "invoke", args: ["document-extract", { body: { document_id: "d9" } }] }));
    await waitFor(() => expect(result.current.docs[0].status).toBe("extracted"));
  });

  it("removes the stored file when the record can't be saved", async () => {
    insertResult = { data: null, error: { message: "denied" } };
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([new File(["x"], "a.csv")]); });
    expect(outcome).toEqual({ saved: 0, failed: ["a.csv"] });
    const path = calls.find((c) => c.op === "storage.upload")!.args[0];
    expect(calls).toContainEqual({ op: "storage.remove", args: [[path]] });
    expect(result.current.docs).toEqual([]);
    expect(calls.some((c) => c.op === "invoke")).toBe(false);
  });

  it("deletes both the record and the stored file", async () => {
    listRows = [row()];
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.remove(result.current.docs[0]); });
    expect(ok).toBe(true);
    expect(calls).toContainEqual({ op: "delete", args: ["d1"] });
    expect(calls).toContainEqual({ op: "storage.remove", args: [["u1/s1/x_census.csv"]] });
    expect(result.current.docs).toEqual([]);
  });

  it("puts the record back if the stored file can't be removed", async () => {
    listRows = [row()];
    storageRemoveResult = { error: { message: "nope" } };
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.remove(result.current.docs[0]); });
    expect(ok).toBe(false);
    expect(calls.find((c) => c.op === "insert")!.args[0]).toMatchObject({ id: "d1", session_id: "s1", storage_path: "u1/s1/x_census.csv" });
    expect(result.current.docs).toHaveLength(1);
  });

  it("starts empty for a new intake", async () => {
    listRows = [row()];
    const { result, rerender } = renderHook(({ sid }) => useSessionDocuments(sid), { initialProps: { sid: "s1" as string | null } });
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    listRows = [];
    rerender({ sid: "s2" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs).toEqual([]);
  });

  it("shows a file that was still being read when the page closed as retryable, not as reading forever", async () => {
    listRows = [row({ status: "processing" })];
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    expect(result.current.docs[0].status).toBe("failed");
  });

  it("keeps an upload with the intake it started in, even if another intake is opened meanwhile", async () => {
    let release!: () => void;
    uploadGate = new Promise<void>((r) => { release = r; });
    insertResult = { data: row({ id: "d9" }), error: null };
    const { result, rerender } = renderHook(({ sid }) => useSessionDocuments(sid), { initialProps: { sid: "s1" as string | null } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.upload([new File(["x"], "census.csv", { type: "text/csv" })]); });
    rerender({ sid: "s2" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { release(); await pending; });

    const path = calls.find((c) => c.op === "storage.upload")!.args[0] as string;
    expect(path).toMatch(/^u1\/s1\//);
    expect(calls.find((c) => c.op === "insert")!.args[0]).toMatchObject({ session_id: "s1" });
    expect(result.current.docs).toEqual([]);
  });
});
