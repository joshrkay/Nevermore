// The import's calls (CRM-X4.1; 20261130090000_import.sql): a review that makes nothing, the import itself in requests of rows, the firm's imports, one's
// problems, and undoing one. The database decides who may import and what each row makes; a refusal it put into words is shown in those words.
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";
import { chunks, type ImportCounts, type ImportKind, type ImportProblem, type ImportRow } from "@/data/import";
import type { Json } from "@/integrations/supabase/types";

const IN_WORDS = new Set(["22023", "42501", "PT404", "PT423", "55000"]);
const refusal = (error: { code?: string; message?: string }, fallback: string) =>
  new AdvisorApiError(error.code && IN_WORDS.has(error.code) && error.message ? error.message : fallback, error.code);

export interface ImportReview { create: number; exists: number; failed: number; problems: ImportProblem[] }

/** What the rows would make, read a request at a time and added up. Nothing is made. `onProgress` is told how many rows have been read. */
export async function reviewImport(firmId: string, kind: ImportKind, rows: ImportRow[], onProgress?: (done: number) => void): Promise<ImportReview> {
  const total: ImportReview = { create: 0, exists: 0, failed: 0, problems: [] };
  let done = 0;
  for (const piece of chunks(rows)) {
    const { data, error } = await supabase.rpc("import_preview", { p_firm_id: firmId, p_kind: kind, p_rows: piece as unknown as Json });
    if (error) throw refusal(error, "We couldn't check the file. Try again.");
    const r = data as unknown as ImportReview;
    total.create += r.create;
    total.exists += r.exists;
    total.failed += r.failed;
    total.problems.push(...r.problems);
    done += piece.length;
    onProgress?.(done);
  }
  return total;
}

/**
 * Runs the import: starts it, then sends its rows a request at a time, telling `onProgress` how many rows are done. A request that fails is sent once more
 * (a row already recorded is not done again); if it fails again the import stops there and says how far it got, with what was made kept and listed.
 */
export async function runImport(firmId: string, kind: ImportKind, fileName: string, rows: ImportRow[], onProgress?: (done: number) => void): Promise<ImportCounts & { importId: string }> {
  const started = await supabase.rpc("start_import", { p_firm_id: firmId, p_kind: kind, p_file_name: fileName, p_total_rows: rows.length });
  if (started.error) throw refusal(started.error, "The import didn't start. Try again.");
  const importId = started.data as unknown as string;
  const total: ImportCounts = { created: 0, exists: 0, failed: 0 };
  let done = 0;
  for (const piece of chunks(rows)) {
    let sent = await supabase.rpc("import_rows", { p_firm_id: firmId, p_import_id: importId, p_rows: piece as unknown as Json });
    if (sent.error && !IN_WORDS.has(sent.error.code ?? "")) sent = await supabase.rpc("import_rows", { p_firm_id: firmId, p_import_id: importId, p_rows: piece as unknown as Json });
    if (sent.error) {
      throw refusal(sent.error, `The import stopped after ${done.toLocaleString("en-US")} of ${rows.length.toLocaleString("en-US")} rows. What it made is kept; it is listed below, where it can be undone.`);
    }
    const c = sent.data as unknown as ImportCounts;
    total.created += c.created;
    total.exists += c.exists;
    total.failed += c.failed;
    done += piece.length;
    onProgress?.(done);
  }
  return { ...total, importId };
}

export interface PastImport {
  id: string; kind: ImportKind; fileName: string | null; totalRows: number; createdBy: string | null; createdAt: string;
  created: number; exists: number; failed: number; undoneAt: string | null; canUndo: boolean;
}

interface PastRow {
  id: string; kind: ImportKind; file_name: string | null; total_rows: number; created_by: string | null; created_at: string;
  created: number; exists: number; failed: number; undone_at: string | null; can_undo: boolean;
}

/** The firm's imports, newest first: every one for an owner, their own for a lead. */
export async function loadImports(firmId: string): Promise<PastImport[]> {
  const { data, error } = await supabase.rpc("imports_list", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load the imports. Try again.");
  return ((data ?? []) as unknown as PastRow[]).map((i) => ({
    id: i.id, kind: i.kind, fileName: i.file_name, totalRows: i.total_rows, createdBy: i.created_by, createdAt: i.created_at,
    created: i.created, exists: i.exists, failed: i.failed, undoneAt: i.undone_at, canUndo: i.can_undo,
  }));
}

/** The rows of an import that made nothing, in the file's order, each with why. */
export async function loadImportProblems(firmId: string, importId: string): Promise<ImportProblem[]> {
  const { data, error } = await supabase.rpc("import_problems", { p_firm_id: firmId, p_import_id: importId });
  if (error) throw refusal(error, "Couldn't load that import's rows. Try again.");
  return (data ?? []) as unknown as ImportProblem[];
}

/** Undoes an import as a whole; answers how many records it removed and how many it kept because they have moved on. */
export async function undoImport(firmId: string, importId: string): Promise<{ removed: number; kept: number }> {
  const { data, error } = await supabase.rpc("undo_import", { p_firm_id: firmId, p_import_id: importId });
  if (error) throw refusal(error, "The import wasn't undone. Try again.");
  return data as unknown as { removed: number; kept: number };
}
