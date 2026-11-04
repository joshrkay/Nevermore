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
// What document-upload answers: the stored document's row, or a refusal.
let uploadResult: { data: unknown; error: unknown } = { data: null, error: null };
let readBackStatus = "extracted";

const row = (over: Record<string, unknown> = {}) => ({
  id: "d1", file_name: "census.csv", file_size: "1 KB", size_bytes: 1024, mime_type: "text/csv",
  category: "employee_census", status: "uploaded", created_at: "2026-10-20T00:00:00Z",
  storage_path: "u1/s1/x_census.csv", extraction: null, scan_verdict: "clean", ...over,
});
const stored = (over: Record<string, unknown> = {}) => ({ data: { document: row(over) }, error: null });
const refusedWith = (code: string, status: number) => ({
  data: null,
  error: new FunctionsHttpError(new Response(JSON.stringify({ code, request_id: "r" }), { status })),
});
// The form each document-upload call carried, as plain values.
const uploads = () =>
  calls.filter((c) => c.op === "invoke" && c.args[0] === "document-upload").map((c) => {
    const form = (c.args[1] as { body: FormData }).body;
    const file = form.get("file") as File;
    return { session_id: form.get("session_id"), category: form.get("category"), name: file.name, size: file.size };
  });
const reads = () => calls.filter((c) => c.op === "invoke" && c.args[0] === "document-extract").map((c) => (c.args[1] as { body: { document_id: string } }).body.document_id);

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
// What the hook reports to monitoring (ops_events), recorded instead of sent.
const reported: { kind: string; code?: string }[] = [];
vi.mock("@/lib/monitoring", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/monitoring")>()),
  reportOpsEvent: (kind: string, report: { code?: string } = {}) => { reported.push({ kind, code: report.code }); },
}));
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
      functions: {
        invoke: async (name: string, opts: unknown) => {
          log("invoke", name, opts);
          if (name !== "document-upload") return invokeResult;
          await uploadGate;
          return uploadResult;
        },
      },
    },
  };
});

const { useSessionDocuments } = await import("./useSessionDocuments");

describe("useSessionDocuments", () => {
  beforeEach(() => {
    calls.length = 0;
    reported.length = 0;
    listRows = [];
    insertResult = { data: null, error: null };
    deleteResult = { error: null };
    storageRemoveResult = { data: [{ name: "x" }], error: null };
    existsResult = false;
    uploadGate = null;
    invokeResult = { data: {}, error: null };
    uploadResult = { data: null, error: null };
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

    it("starts the intake, waits for its list, then uploads the file to it", async () => {
      uploadResult = stored({ id: "d9", storage_path: "u1/s9/x_census.csv" });
      const { result, ensure } = startable("s9");
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // Not inside act: the upload waits for a render (the new intake's list) that act would hold back.
      let outcome: unknown;
      void result.current.upload([new File(["First,Last\nAnn,Lee"], "census.csv", { type: "text/csv" })]).then((o) => { outcome = o; });
      await waitFor(() => expect(outcome).toBeDefined());
      expect(ensure).toHaveBeenCalledTimes(1);
      expect(outcome).toEqual({ saved: 1, failed: [], rejected: [] });
      const listed = calls.findIndex((c) => c.op === "select.eq" && c.args[0] === "session_id" && c.args[1] === "s9");
      const sent = calls.findIndex((c) => c.op === "invoke" && c.args[0] === "document-upload");
      expect(listed).toBeGreaterThan(-1);
      expect(sent).toBeGreaterThan(listed);
      expect(uploads()[0].session_id).toBe("s9");
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
      expect(uploads()).toEqual([]);
      expect(result.current.uploading).toBe(false);
    });
  });

  it("sends uploads to document-upload with the intake and category, never to storage itself, then reads them", async () => {
    uploadResult = stored({ id: "d9" });
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const file = new File(["First,Last\nAnn,Lee"], "Employee Census.csv", { type: "text/csv" });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([file]); });
    expect(outcome).toEqual({ saved: 1, failed: [], rejected: [] });

    expect(uploads()).toEqual([{ session_id: "s1", category: "employee_census", name: "Employee Census.csv", size: file.size }]);
    // The function checks the bytes, writes the row and stores the file; the browser does neither.
    expect(calls.some((c) => c.op === "storage.upload" || c.op === "insert")).toBe(false);
    await waitFor(() => expect(reads()).toEqual(["d9"]));
    await waitFor(() => expect(result.current.docs[0].status).toBe("extracted"));
  });

  it("reports a file document-upload couldn't store as one to try again", async () => {
    uploadResult = refusedWith("storage", 502);
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([new File(["x"], "a.csv")]); });
    expect(outcome).toEqual({ saved: 0, failed: ["a.csv"], rejected: [] });
    expect(result.current.docs).toEqual([]);
    expect(reads()).toEqual([]);
    // A failure on our side is reported to monitoring, by its code, never the file's name.
    expect(reported).toEqual([{ kind: "upload_failed", code: "document_upload:storage" }]);
  });

  it.each([
    ["the function never answering", { data: null, error: new Error("network down") }, "document_upload:unreachable"],
    ["a function crash with no code", { data: null, error: new FunctionsHttpError(new Response("boom", { status: 500 })) }, "document_upload:500"],
  ] as const)("reports %s to monitoring", async (_label, result, code) => {
    uploadResult = result;
    const { result: hook } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));
    await act(async () => { await hook.current.upload([new File(["x"], "a.csv")]); });
    expect(reported).toEqual([{ kind: "upload_failed", code }]);
  });

  it.each(["closed", "consent", "not_found", "unauthorized", "duplicate", "mismatch", "too_large", "limit"])(
    "doesn't report the intake's or the file's own %s refusal as a failure",
    async (code) => {
      uploadResult = refusedWith(code, 409);
      const { result } = renderHook(() => useSessionDocuments("s1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { await result.current.upload([new File(["x"], "a.csv")]); });
      expect(reported).toEqual([]);
    },
  );

  it.each([
    ["executable", 415, "mismatch"],
    ["mismatch", 415, "mismatch"],
    ["unsupported", 415, "mismatch"],
    ["empty", 422, "empty"],
    ["too_large", 413, "too_large"],
    ["limit", 409, "limit"],
  ] as const)("explains the server's %s refusal as %s", async (code, status, reason) => {
    uploadResult = refusedWith(code, status);
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([new File(["x,y"], "a.csv")]); });
    expect(outcome).toEqual({ saved: 0, failed: [], rejected: [{ name: "a.csv", reason }] });
    expect(result.current.docs).toEqual([]);
  });

  it("holds a file waiting for its malware scan, reads it once the scan passes, and never reads a blocked one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      uploadResult = stored({ id: "d9", scan_verdict: "pending" });
      const { result } = renderHook(() => useSessionDocuments("s1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { await result.current.upload([new File(["x,y"], "a.csv")]); });
      expect(result.current.docs[0].scan_verdict).toBe("pending");
      expect(reads()).toEqual([]);
      // Asking to read it does nothing while it is held.
      await act(async () => { await result.current.extract(result.current.docs[0]); });
      expect(reads()).toEqual([]);

      // document-scan clears it; the next look sees that and Lenore reads it.
      listRows = [row({ id: "d9", scan_verdict: "clean" })];
      await act(async () => { vi.advanceTimersByTime(16_000); });
      await waitFor(() => expect(reads()).toEqual(["d9"]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes a held file's record once storage says the file is out of reach: the database keeps it withheld", async () => {
    // Storage deletes nothing it withholds from the prospect, and reports it gone; removing the record then
    // records the file for document-scan to delete (withheld_document_files).
    listRows = [row({ scan_verdict: "infected" })];
    storageRemoveResult = { data: [], error: null };
    existsResult = false;
    const { result, ok } = await removeFirst();
    expect(ok).toBe(true);
    expect(ops()).toEqual(["storage.remove", "storage.exists", "delete"]);
    expect(result.current.docs).toEqual([]);
  });

  it("deletes the file of a document whose scan passed since this tab last looked", async () => {
    // The tab still shows it as being checked; storage deletes the file, which is now readable.
    listRows = [row({ scan_verdict: "pending" })];
    const { ok } = await removeFirst();
    expect(ok).toBe(true);
    expect(ops()).toEqual(["storage.remove", "delete"]);
  });

  it("refuses a file whose contents don't match its name, without storing anything", async () => {
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let outcome: unknown;
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "census.pdf");
    await act(async () => { outcome = await result.current.upload([png]); });
    expect(outcome).toEqual({ saved: 0, failed: [], rejected: [{ name: "census.pdf", reason: "mismatch" }] });
    expect(uploads()).toEqual([]);
    expect(result.current.docs).toEqual([]);
  });

  it("stores a file once per intake, whether it's already there or dropped twice", async () => {
    const hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"; // sha256("abc")
    listRows = [row({ file_sha256: hash })];
    uploadResult = stored({ id: "d9" });
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
    expect(uploads()).toHaveLength(1);
  });

  it("treats the database's refusal of a second copy as a duplicate", async () => {
    uploadResult = refusedWith("duplicate", 409);
    const { result } = renderHook(() => useSessionDocuments("s1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upload([new File(["abc"], "a.csv")]); });
    expect(outcome).toEqual({ saved: 0, failed: [], rejected: [{ name: "a.csv", reason: "duplicate" }] });
    expect(calls.some((c) => c.op === "storage.remove")).toBe(false);
  });

  it("stops at 25 documents an intake", async () => {
    listRows = Array.from({ length: 24 }, (_, i) => row({ id: `d${i}`, file_sha256: null }));
    uploadResult = stored({ id: "d99" });
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
    uploadResult = stored({ id: "d9" });
    const { result, rerender } = renderHook(({ sid }) => useSessionDocuments(sid), { initialProps: { sid: "s1" as string | null } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.upload([new File(["x"], "census.csv", { type: "text/csv" })]); });
    rerender({ sid: "s2" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { release(); await pending; });

    expect(uploads()[0].session_id).toBe("s1");
    expect(result.current.docs).toEqual([]);
  });
});
