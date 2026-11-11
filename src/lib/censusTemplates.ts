// A PEO's own census template (L-3.1; migration 20261114090000_peo_census_templates.sql): uploading one to a draft's
// census layout (census-template-upload scans it, as every upload is, docs/adr/0002), the templates uploaded for a
// PEO with what their scan found, and reading a clean one's file to fill. Only a clean template's file can be read.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** The sync:begin census_template_statuses list in 20261114090000; schemaSync.test.ts keeps them equal. */
export const CENSUS_TEMPLATE_STATUSES = ["pending", "clean", "blocked", "failed"] as const;
export type CensusTemplateStatus = (typeof CENSUS_TEMPLATE_STATUSES)[number];

/** One template uploaded for a PEO, as advisors read it. */
export interface CensusTemplateRecord {
  id: number;
  fileName: string;
  status: CensusTemplateStatus;
  uploadedAt: string;
}

/** Why a template can't be used yet, in words for the PEOs page; null for a clean one. */
export function templateStatusProblem(status: CensusTemplateStatus): string | null {
  switch (status) {
    case "clean": return null;
    case "pending": return "It is still being checked for viruses, so it can't be used yet.";
    case "blocked": return "The virus check blocked it, so it can't be used. Upload a clean copy.";
    case "failed": return "It couldn't be checked for viruses, so it can't be used. Upload it again.";
  }
}

const parseStatus = (v: unknown): CensusTemplateStatus => ((CENSUS_TEMPLATE_STATUSES as readonly unknown[]).includes(v) ? (v as CensusTemplateStatus) : "pending");

/** The templates uploaded for PEO `peoId`, newest first. Advisors and admins only (row security). */
export async function listCensusTemplates(peoId: number): Promise<CensusTemplateRecord[]> {
  const { data, error } = await supabase
    .from("peo_census_templates")
    .select("id, file_name, scan_status, uploaded_at")
    .eq("peo_id", peoId)
    .order("id", { ascending: false });
  if (error) throw new Error("The PEO's template files couldn't be loaded.");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    fileName: String(r.file_name ?? ""),
    status: parseStatus(r.scan_status),
    uploadedAt: String(r.uploaded_at ?? ""),
  }));
}

// census-template-upload's refusals, in words for the admin.
const REFUSALS: Record<string, string> = {
  unsupported: "A PEO's template is an Excel workbook (.xlsx).",
  mismatch: "This file isn't the Excel workbook its name says.",
  executable: "This file isn't the Excel workbook its name says.",
  empty: "This file is empty.",
  too_large: "A template can be up to 20 MB.",
  forbidden: "Only an admin uploads a PEO's template.",
  scanner_missing: "Uploads are paused while virus checking is set up. Try again once it is.",
};

/** Uploads a template for PEO `peoId`: the record of it, with what the virus check found, or why it was refused. */
export async function uploadCensusTemplate(peoId: number, file: File): Promise<CensusTemplateRecord> {
  const form = new FormData();
  form.append("peo_id", String(peoId));
  form.append("file", file, file.name);
  const { data, error } = await supabase.functions.invoke("census-template-upload", { body: form });
  if (error) {
    let code: string | null = null;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await (error.context as Response).clone().json();
        code = typeof body?.code === "string" ? body.code : null;
      } catch {
        code = null;
      }
    }
    throw new Error((code && REFUSALS[code]) ?? "The template couldn't be uploaded. Try again.");
  }
  const t = (data as { template?: Record<string, unknown> })?.template ?? {};
  return { id: Number(t.id), fileName: String(t.file_name ?? file.name), status: parseStatus(t.scan_status), uploadedAt: new Date().toISOString() };
}

/** A clean template's file, to fill; null when it can't be read (not clean, or not there). */
export async function readCensusTemplate(peoId: number, templateId: number): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from("peo-templates").download(`${peoId}/${templateId}.xlsx`);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
