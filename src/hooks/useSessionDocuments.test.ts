import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";

type Result = { data?: unknown; error: { message: string } | null };

const calls: { op: string; args: unknown[] }[] = [];
let listRows: Record<string, unknown>[] = [];
let insertResult: Result = { data: null, error: null };
let deleteResult: Result = { error: null };
// Storage lists what it deleted; an empty list means it deleted nothing.
let storageRemoveResult: Result = { data: [{ name: "x" }], error: null };
// What storage.exists says: true or false, or an error it throws (a network failure).
let existsResult: boolean | Error = false;
let uploadGate: Promise<void> | null = null;
let invokeResult: { data: unknown; error: unknown } = { data: {}, error: null };
let readBackStatus = "extracted";

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
              maybeSingle: async () => ({ data: row({ id: val, status: readBackStatus }), error: null }),
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
          exists: async (path: string) => {
            log("storage.exists", path);
            if (existsResult instanceof Error) throw existsResult;
            return existsResult ? { data: true, error: null } : { data: false, error: { message: "Object not found", status: 404 } };
          },
        }),
      },
      functions: { invoke: async (name: string, opts: unknown) => { log("invoke", name, opts); return invokeResult; } },
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
    storageRemoveResult = { data: [{ name: "x" }], error: null };
    existsResult = false;
    uploadGate = null;
    invokeResult = { data: {}, error: null };
    readBackStatus = "extracted";
  });

  describe("why a read didn't go through", () => {
    const read = async () => {
      listRows = [row({ id: "d1", status: "uploaded" })];
      const { result } = renderHook(() => useSessionDocuments("s1"));
      await waitFor(() => expect(result.current.docs).toHaveLength(1));
      await act(async () => { await result.current.extract(result.current.docs[0]); });
      return result.current.docs[0];
    };

    it("keeps the function's reason when the read was put off, such as the daily cap", async () => {
      invokeResult = { data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ code: "daily_cap", request_id: "r1" }), { status: 503 })) };
      readBackStatus = "uploaded";
      const doc = await read();
      expect(doc.status).toBe("uploaded");
      expect(doc.readIssue).toBe("daily_cap");
    });

    it("keeps the reason a read failed, from the function's answer", async () => {
      invokeResult = { data: { status: "failed", code: "timeout", request_id: "r2" }, error: null };
      readBackStatus = "failed";
      const doc = await read();
      expect(doc.status).toBe("failed");
      expect(doc.readIssue).toBe("timeout");
    });

    it("has no reason when the read went through", async () => {
      invokeResult = { data: { status: "extracted", request_id: "r3" }, error: null };
      const doc = await read();
      expect(doc.status).toBe("extracted");
      expect(doc.readIssue).toBeNull();
    });
  });

  it("lists only the open intake's documents", async () => {
    listRows = [row()];
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    expect(calls).toContainEqual({ op: "select.eq", args: ["session_id", "s1"] });
  });

  describe("an upload before the prospect has started an intake", () => {
    // The page's part: the intake id it renders with, which creating the intake sets.
    const startable = (created: string | null) => {
      let setSid: (sid: string) => void = () => {};
      const ensure = vi.fn(async () => {
        if (created) setSid(created);
        return created;
      });
      const hook = renderHook(() => {
        const [sid, set] = useState<string | null>(null);
        setSid = set;
        return useSessionDocuments(sid, ensure);
      });
      return { ...hook, ensure };
    };

    it("starts the intake, waits for its list, then stores the file under it", async () => {
      insertResult = { data: row({ id: "d9", storage_path: "u1/s9/x_census.csv" }), error: null };
      const { result, ensure } = startable("s9");
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // Not inside act: the upload waits for a render (the new intake's list) that act would hold back.
      let outcome: unknown;
      void result.current.upload([new File(["First,Last\nAnn,Lee"], "census.csv", { type: "text/csv" })]).then((o) => { outcome = o; });
      await waitFor(() => expect(outcome).toBeDefined());
      expect(ensure).toHaveBeenCalledTimes(1);
      expect(outcome).toEqual({ saved: 1, failed: [], rejected: [] });
      const listed = calls.findIndex((c) => c.op === "select.eq" && c.args[0] === "session_id" && c.args[1] === "s9");
      const stored = calls.findIndex((c) => c.op === "storage.upload");
      expect(listed).toBeGreaterThan(-1);
      expect(stored).toBeGreaterThan(listed);
      expect(calls[stored].args[0]).toMatch(/^u1\/s9\//);
      // The new intake's list loaded first, so it didn't wipe the file out.
      await waitFor(() => expect(result.current.docs.map((d) => d.id)).toContain("d9"));
    });

    it("stores nothing when the intake couldn't be started", async () => {
      const { result, ensure } = startable(null);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      let outcome: unknown;
      await act(async () => { outcome = await result.current.upload([new File(["x"], "a.csv", { type: "text/csv" })]); });
      expect(ensure).toHaveBeenCalledTimes(1);
      expect(outcome).toEqual({ saved: 0, failed: ["a.csv"], rejected: [] });
      expect(calls.some((c) => c.op === "storage.upload")).toBe(false);
      expect(result.current.uploading).toBe(false);
    });
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

  const removeFirst = async () => {
    const hook = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(hook.result.current.docs).toHaveLength(1));
    let ok: boolean | undefined;
    await act(async () => { ok = await hook.result.current.remove(hook.result.current.docs[0]); });
    return { ...hook, ok };
  };
  const ops = () => calls.map((c) => c.op).filter((op) => op === "storage.remove" || op === "storage.exists" || op === "delete" || op === "insert");

  it("deletes the stored file, then the record", async () => {
    listRows = [row()];
    const { result, ok } = await removeFirst();
    expect(ok).toBe(true);
    expect(calls).toContainEqual({ op: "storage.remove", args: [["u1/s1/x_census.csv"]] });
    expect(calls).toContainEqual({ op: "delete", args: ["d1"] });
    expect(ops()).toEqual(["storage.remove", "delete"]);
    expect(result.current.docs).toEqual([]);
  });

  it("keeps the record if the stored file can't be deleted", async () => {
    listRows = [row()];
    storageRemoveResult = { data: null, error: { message: "nope" } };
    const { result, ok } = await removeFirst();
    expect(ok).toBe(false);
    expect(ops()).toEqual(["storage.remove"]);
    expect(result.current.docs).toHaveLength(1);
  });

  it("keeps the record when storage deleted nothing and the file is still there", async () => {
    // Storage answers success with an empty list when its policies refuse a delete.
    listRows = [row()];
    storageRemoveResult = { data: [], error: null };
    existsResult = true;
    const { result, ok } = await removeFirst();
    expect(ok).toBe(false);
    expect(calls).toContainEqual({ op: "storage.exists", args: ["u1/s1/x_census.csv"] });
    expect(ops()).toEqual(["storage.remove", "storage.exists"]);
    expect(result.current.docs).toHaveLength(1);
  });

  it("keeps the record when it can't tell whether the file is gone", async () => {
    listRows = [row()];
    storageRemoveResult = { data: [], error: null };
    existsResult = new Error("network down");
    const { result, ok } = await removeFirst();
    expect(ok).toBe(false);
    expect(ops()).toEqual(["storage.remove", "storage.exists"]);
    expect(result.current.docs).toHaveLength(1);
  });

  it("deletes the record of a file that is already gone", async () => {
    listRows = [row()];
    storageRemoveResult = { data: [], error: null };
    existsResult = false;
    const { result, ok } = await removeFirst();
    expect(ok).toBe(true);
    expect(ops()).toEqual(["storage.remove", "storage.exists", "delete"]);
    expect(result.current.docs).toEqual([]);
  });

  it("keeps the record listed if it can't be deleted after its file, and a second try finishes", async () => {
    listRows = [row()];
    deleteResult = { error: { message: "network down" } };
    const { result, ok } = await removeFirst();
    expect(ok).toBe(false);
    expect(result.current.docs).toHaveLength(1);
    // Nothing is put back: the record was never deleted.
    expect(ops()).toEqual(["storage.remove", "delete"]);

    // The file is gone now, so storage deletes nothing on the second try.
    deleteResult = { error: null };
    storageRemoveResult = { data: [], error: null };
    existsResult = false;
    let again: boolean | undefined;
    await act(async () => { again = await result.current.remove(result.current.docs[0]); });
    expect(again).toBe(true);
    expect(result.current.docs).toEqual([]);
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
