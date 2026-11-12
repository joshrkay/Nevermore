// A PEO template workbook (GLOSSARY.md; L-3.1; migration 20261115140000_peo_census_templates.sql): uploading one to a
// draft's census layout (census-template-upload scans it, as every upload is, docs/adr/0002), the ones uploaded for a
// PEO with what their scan found, and reading a clean one's file to fill. Only a clean one's file can be read.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** The sync:begin template_workbook_statuses list in 20261115140000; schemaSync.test.ts keeps them equal. */
export const TEMPLATE_WORKBOOK_STATUSES = ["pending", "clean", "blocked", "failed"] as const;
export type TemplateWorkbookStatus = (typeof TEMPLATE_WORKBOOK_STATUSES)[number];

/**
 * What each status is called beside a template workbook's name, and why one can't be used yet, in words for the PEOs
 * page (null for a clean one). One map, so the list and the warning never disagree.
 */
export const TEMPLATE_WORKBOOK_STATUS_WORDS: Record<TemplateWorkbookStatus, { tag: string | null; problem: string | null }> = {
  clean: { tag: null, problem: null },
  pending: { tag: "being checked", problem: "It is still being checked for viruses, so it can't be used yet." },
  blocked: { tag: "blocked", problem: "The virus check blocked it, so it can't be used. Upload a clean copy." },
  failed: { tag: "not checked", problem: "It couldn't be checked for viruses, so it can't be used. Upload it again." },
};

/** One template workbook uploaded for a PEO, as advisors read it. */
export interface TemplateWorkbookRecord {
  id: number;
  fileName: string;
  status: TemplateWorkbookStatus;
  uploadedAt: string;
}

/** Why a template workbook can't be used yet, in words for the PEOs page; null for a clean one. */
export const templateWorkbookProblem = (status: TemplateWorkbookStatus): string | null => TEMPLATE_WORKBOOK_STATUS_WORDS[status].problem;

const parseStatus = (v: unknown): TemplateWorkbookStatus => ((TEMPLATE_WORKBOOK_STATUSES as readonly unknown[]).includes(v) ? (v as TemplateWorkbookStatus) : "pending");

/** The template workbooks uploaded for PEO `peoId`, newest first. Advisors and admins only (row security). */
export async function listTemplateWorkbooks(peoId: number): Promise<TemplateWorkbookRecord[]> {
  const { data, error } = await supabase
    .from("peo_census_templates")
    .select("id, file_name, scan_status, uploaded_at")
    .eq("peo_id", peoId)
    .order("id", { ascending: false });
  if (error) throw new Error("The PEO's template workbooks couldn't be loaded.");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    fileName: String(r.file_name ?? ""),
    status: parseStatus(r.scan_status),
    uploadedAt: String(r.uploaded_at ?? ""),
  }));
}

// census-template-upload's refusals, in words for the admin.
const REFUSALS: Record<string, string> = {
  unsupported: "A PEO template workbook is an Excel workbook (.xlsx).",
  mismatch: "This file isn't the Excel workbook its name says.",
  executable: "This file isn't the Excel workbook its name says.",
  empty: "This file is empty.",
  too_large: "A template workbook can be up to 20 MB.",
  unpacks_too_large: "A template workbook can unpack to at most 100 MB. Ask the PEO for a plain copy.",
  forbidden: "Only an admin uploads a PEO template workbook.",
  scanner_missing: "Uploads are paused while virus checking is set up. Try again once it is.",
};

/** Uploads a template workbook for PEO `peoId`: the record of it, with what the virus check found, or why it was refused. */
export async function uploadTemplateWorkbook(peoId: number, file: File): Promise<TemplateWorkbookRecord> {
  const form = new FormData();
  form.append("peo_id", String(peoId));
  form.append("file", file, file.name);
  const { data, error } = await supabase.functions.invoke("census-template-upload", { body: form });
  if (error) {
    let code: string | null = null;
    let message: string | null = null;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await (error.context as Response).clone().json();
        code = typeof body?.code === "string" ? body.code : null;
        message = typeof body?.error === "string" ? body.error : null;
      } catch {
        code = null;
      }
    }
    // An upload whose virus check couldn't be recorded says so, in the function's own words.
    throw new Error((code && REFUSALS[code]) ?? (code === "internal" && message) ?? "The template workbook couldn't be uploaded. Try again.");
  }
  const t = (data as { template?: Record<string, unknown> })?.template ?? {};
  return { id: Number(t.id), fileName: String(t.file_name ?? file.name), status: parseStatus(t.scan_status), uploadedAt: new Date().toISOString() };
}

/**
 * A clean template workbook's file, to fill; null when it can't be read (not clean, not this PEO's, or not there).
 * Where it is stored comes from the database, which alone builds the path.
 */
export async function readTemplateWorkbook(peoId: number, templateId: number): Promise<Uint8Array | null> {
  const { data: path, error: pathError } = await supabase.rpc("clean_template_workbook_path", { p_peo_id: peoId, p_template_id: templateId });
  if (pathError || typeof path !== "string") return null;
  const { data, error } = await supabase.storage.from("peo-templates").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
