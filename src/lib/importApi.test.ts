import { beforeEach, describe, expect, it, vi } from "vitest";

// The import's calls at the browser's edge (CRM-X4.1): requests of at most 500 rows, counts added up, and what a failure leaves behind said plainly.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const { loadImports, reviewImport, runImport, undoImport } = await import("./importApi");

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, name: `N${i}` }));
const ok = (data: unknown) => Promise.resolve({ data, error: null });

beforeEach(() => { rpc.mockReset(); });

describe("reviewing a file", () => {
  // Break caught: a 1,200-row file reviewed as its first 500 rows.
  it("reads every request's answer and adds them up, telling how far it has got", async () => {
    rpc.mockImplementation((_n: string, a: { p_rows: unknown[] }) => ok({ create: a.p_rows.length - 1, exists: 0, failed: 1, problems: [{ row: (a.p_rows[0] as { _row: number })._row, outcome: "failed", reason: "No name" }] }));
    const progress = vi.fn();
    const review = await reviewImport("f1", "leads", rows(1200), progress);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[0][0]).toBe("import_preview");
    expect(rpc.mock.calls.map((c) => (c[1] as { p_rows: unknown[] }).p_rows.length)).toEqual([500, 500, 200]);
    expect(review).toMatchObject({ create: 1197, exists: 0, failed: 3 });
    expect(review.problems.map((p) => p.row)).toEqual([2, 502, 1002]);
    expect(progress.mock.calls.map((c) => c[0])).toEqual([500, 1000, 1200]);
  });

  it("says a refusal in the database's words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only an owner or a lead of the firm imports." } });
    await expect(reviewImport("f1", "leads", rows(1))).rejects.toThrow("Only an owner or a lead of the firm imports.");
  });
});

describe("running an import", () => {
  it("starts it with the file's name and row count, then sends every row to that import", async () => {
    rpc.mockImplementation((name: string, a: { p_rows?: unknown[] }) => (name === "start_import" ? ok("imp-1") : ok({ created: a.p_rows!.length, exists: 0, failed: 0 })));
    const done = await runImport("f1", "accounts", "book.csv", rows(600) as never);
    expect(rpc.mock.calls[0]).toEqual(["start_import", { p_firm_id: "f1", p_kind: "accounts", p_file_name: "book.csv", p_total_rows: 600 }]);
    expect(rpc.mock.calls.slice(1).map((c) => [c[0], (c[1] as { p_import_id: string }).p_import_id, (c[1] as { p_rows: unknown[] }).p_rows.length])).toEqual([["import_rows", "imp-1", 500], ["import_rows", "imp-1", 100]]);
    expect(done).toEqual({ created: 600, exists: 0, failed: 0, importId: "imp-1" });
  });

  // Break caught: a dropped connection half way ending the import, or the retried request counted twice.
  it("sends a request that failed once more, and carries on", async () => {
    let calls = 0;
    rpc.mockImplementation((name: string) => {
      if (name === "start_import") return ok("imp-1");
      calls += 1;
      return calls === 1 ? Promise.resolve({ data: null, error: { message: "Failed to fetch" } }) : ok({ created: 3, exists: 0, failed: 0 });
    });
    expect(await runImport("f1", "leads", "a.csv", rows(3))).toMatchObject({ created: 3 });
    expect(calls).toBe(2);
  });

  it("stops when a request fails twice, and says how far it got and that what was made is kept", async () => {
    rpc.mockImplementation((name: string, a: { p_rows?: { _row: number }[] }) => {
      if (name === "start_import") return ok("imp-1");
      return a.p_rows![0]._row === 2 ? ok({ created: 500, exists: 0, failed: 0 }) : Promise.resolve({ data: null, error: { message: "Failed to fetch" } });
    });
    await expect(runImport("f1", "leads", "a.csv", rows(700))).rejects.toThrow("The import stopped after 500 of 700 rows. What it made is kept; it is listed below, where it can be undone.");
  });

  it("does not send again a request the database refused in words", async () => {
    rpc.mockImplementation((name: string) => (name === "start_import" ? ok("imp-1") : Promise.resolve({ data: null, error: { code: "PT423", message: "This firm is closing and can't be changed" } })));
    await expect(runImport("f1", "leads", "a.csv", rows(2))).rejects.toThrow("This firm is closing and can't be changed");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("the firm's imports", () => {
  it("reads each with what it made and whether it can still be undone, and undoes one", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "i1", kind: "leads", file_name: "a.csv", total_rows: 3, created_by: "Ada", created_at: "2026-11-24T10:00:00Z", created: 2, exists: 1, failed: 0, undone_at: null, can_undo: true }], error: null });
    expect(await loadImports("f1")).toEqual([{ id: "i1", kind: "leads", fileName: "a.csv", totalRows: 3, createdBy: "Ada", createdAt: "2026-11-24T10:00:00Z", created: 2, exists: 1, failed: 0, undoneAt: null, canUndo: true }]);
    rpc.mockResolvedValueOnce({ data: { removed: 2, kept: 0 }, error: null });
    expect(await undoImport("f1", "i1")).toEqual({ removed: 2, kept: 0 });
    expect(rpc).toHaveBeenLastCalledWith("undo_import", { p_firm_id: "f1", p_import_id: "i1" });
  });
});
