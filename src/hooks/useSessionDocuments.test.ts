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
  category: "employee_census", status: "uploaded", created_at: "2026-10-20T00:00:00Z",
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
    expect(outcome).toEqual({ saved: 1, failed: [], rejected: [] });

    const path = calls.find((c) => c.op === "storage.upload")!.args[0] as string;
    expect(path).toMatch(/^u1\/s1\/[0-9a-f-]+_Employee_Census\.csv$/);
    expect(calls.find((c) => c.op === "insert")!.args[0]).toMatchObject({
      user_id: "u1", session_id: "s1", file_name: "Employee Census.csv", size_bytes: file.size,
      mime_type: "text/csv", category: "employee_census", storage_path: path,
      file_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
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
    expect(outcome).toEqual({ saved: 0, failed: ["a.csv"], rejected: [] });
    const path = calls.find((c) => c.op === "storage.upload")!.args[0];
    expect(calls).toContainEqual({ op: "storage.remove", args: [[path]] });
    expect(result.current.docs).toEqual([]);
    expect(calls.some((c) => c.op === "invoke")).toBe(false);
  });

  it("refuses a file whose contents don't match its name, without storing anything", async () => {
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let outcome: unknown;
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "census.pdf");
    await act(async () => { outcome = await result.current.upload([png]); });
    expect(outcome).toEqual({ saved: 0, failed: [], rejected: [{ name: "census.pdf", reason: "mismatch" }] });
    expect(calls.some((c) => c.op === "storage.upload")).toBe(false);
    expect(result.current.docs).toEqual([]);
  });

  it("stores a file once per intake, whether it's already there or dropped twice", async () => {
    const hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"; // sha256("abc")
    listRows = [row({ file_sha256: hash })];
    insertResult = { data: row({ id: "d9" }), error: null };
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.upload([new File(["abc"], "again.csv"), new File(["x,y"], "new.csv"), new File(["x,y"], "new copy.csv")]);
    });
    expect(outcome).toEqual({
      saved: 1,
      failed: [],
      rejected: [{ name: "again.csv", reason: "duplicate" }, { name: "new copy.csv", reason: "duplicate" }],
    });
    expect(calls.filter((c) => c.op === "storage.upload")).toHaveLength(1);
  });

  it("treats the database's refusal of a second copy as a duplicate, and cleans up the stored file", async () => {
    insertResult = { data: null, error: { message: "duplicate key", code: "23505" } as { message: string } };
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([new File(["abc"], "a.csv")]); });
    expect(outcome).toEqual({ saved: 0, failed: [], rejected: [{ name: "a.csv", reason: "duplicate" }] });
    const path = calls.find((c) => c.op === "storage.upload")!.args[0];
    expect(calls).toContainEqual({ op: "storage.remove", args: [[path]] });
  });

  it("stops at 25 documents an intake", async () => {
    listRows = Array.from({ length: 24 }, (_, i) => row({ id: `d${i}`, file_sha256: null }));
    insertResult = { data: row({ id: "d99" }), error: null };
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(24));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([new File(["a"], "one.csv"), new File(["b"], "two.csv")]); });
    expect(outcome).toEqual({ saved: 1, failed: [], rejected: [{ name: "two.csv", reason: "limit" }] });
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

  it("shows a read that stopped long ago as retryable, not as reading forever", async () => {
    const longAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    listRows = [row({ status: "processing", processing_started_at: longAgo }), row({ id: "d2", status: "processing" })];
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(2));
    expect(result.current.docs.map((d) => d.status)).toEqual(["failed", "failed"]);
  });

  it("leaves a read that just started alone, and picks up its result when it finishes", async () => {
    listRows = [row({ status: "processing", processing_started_at: new Date().toISOString() })];
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    expect(result.current.docs[0].status).toBe("processing");

    // Another tab's read completes; this tab notices without a reload.
    listRows = [row({ status: "extracted" })];
    await waitFor(() => expect(result.current.docs[0].status).toBe("extracted"), { timeout: 6000 });
  }, 10000);

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
