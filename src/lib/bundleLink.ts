// The bundle link (M-2.1, slice 6.6b; ADR 0003; D-609): the advisor's bundle for one PEO as separate files behind a link the PEO opens at
// /b/<token>, never as attachments. The made files (the same builders as the zip, src/lib/submissionBundle.ts) and the certified answers as
// JSON are stored in the private bucket bundle-links at <quote request>/<folder>/<n>-<name>, n each file's place in the list; the documents
// on file are named, not copied (the edge function serves each from where the intake keeps it). The database then issues the link
// (issue_bundle_link), with the open items as they stand. No screen issues one yet: slice 6.6 does, from the send.
import { certifiedAnswersFilename, type CertifiedAnswersDocument } from "@/data/certifiedAnswersDocument";
import { categoryInfo } from "@/data/documentCategories";
import type { BundleOutcome, BundlePlan } from "@/data/submissionBundle";
import { madeBundleFiles, safeFileName, type BundleDeps } from "@/lib/submissionBundle";
import type { Json } from "@/integrations/supabase/types";

export interface IssueBundleLinkDeps extends Pick<BundleDeps, "readTemplate"> {
  /** Stores one file in the bundle-links bucket at that path. */
  upload: (path: string, blob: Blob) => Promise<void>;
  /** The database's issue_bundle_link. */
  issue: (args: { p_quote_request_id: number; p_version: number; p_folder: string; p_files: LinkFile[]; p_open_items: string[] }) => Promise<IssuedLink>;
  /** A new folder's uuid. */
  newFolder?: () => string;
  /** The app's own address, which the link starts with. */
  origin?: string;
}

/** A file the link lists: its name and what it is, and for a document on file its id. */
export interface LinkFile {
  name: string;
  what: string;
  document_id?: string;
}

interface IssuedLink {
  id: number;
  token: string;
  expires_at: string;
  version: number;
}

export interface BundleLinkIssued {
  url: string;
  expiresAt: string;
  version: number;
  /** What couldn't be made, said to the advisor before they send. */
  notIncluded: BundleOutcome["notIncluded"];
}

/** "the packet, ..." as the page lists it: "The packet, ...". */
const sentence = (what: string) => what.charAt(0).toUpperCase() + what.slice(1);

/** Makes, stores and issues one PEO's bundle link from the plan of its bundle and the certified answers. */
export async function issueBundleLink(
  input: { quoteRequestId: number; plan: BundlePlan; answers: CertifiedAnswersDocument },
  deps: IssueBundleLinkDeps,
): Promise<BundleLinkIssued> {
  const { plan } = input;
  if (plan.version === null) throw new Error("Only a certified version can be sent.");
  const folder = (deps.newFolder ?? (() => crypto.randomUUID()))();
  const made = await madeBundleFiles(plan, deps);
  const stored = [
    ...made.files.map((f) => ({ name: safeFileName(f.name), what: sentence(f.what), blob: f.blob })),
    {
      name: certifiedAnswersFilename(input.answers),
      what: "The certified answers as JSON",
      blob: new Blob([JSON.stringify(input.answers, null, 2)], { type: "application/json" }),
    },
  ];
  // Every file is stored before the link exists: a link never lists a file that is not there.
  try {
    for (const [i, f] of stored.entries()) await deps.upload(`${input.quoteRequestId}/${folder}/${i + 1}-${f.name}`, f.blob);
  } catch (err) {
    console.error("Failed to store a bundle link's file:", err);
    throw new Error("We couldn't store the bundle's files. Try again.");
  }
  const files: LinkFile[] = [
    ...stored.map(({ name, what }) => ({ name, what })),
    ...plan.documents.map((d) => ({
      name: safeFileName(d.certifiedFileName ?? d.file_name),
      what: categoryInfo(d.certifiedCategory ?? d.category).label,
      document_id: d.id,
    })),
  ];
  const issued = await deps.issue({
    p_quote_request_id: input.quoteRequestId,
    p_version: plan.version,
    p_folder: folder,
    p_files: files,
    p_open_items: plan.missing.map((m) => m.label),
  });
  const origin = deps.origin ?? window.location.origin;
  return { url: `${origin}/b/${issued.token}`, expiresAt: issued.expires_at, version: issued.version, notIncluded: made.notIncluded };
}

/** The app's own storage, database and PEO template workbooks, for issueBundleLink. Loaded only when a link is issued. */
export async function supabaseBundleLinkDeps(): Promise<IssueBundleLinkDeps> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { readTemplateWorkbook } = await import("@/lib/templateWorkbooks");
  return {
    readTemplate: readTemplateWorkbook,
    upload: async (path, blob) => {
      const { error } = await supabase.storage.from("bundle-links").upload(path, blob, { upsert: false, contentType: "application/octet-stream" });
      if (error) throw error;
    },
    issue: async (args) => {
      const { data, error } = await supabase.rpc("issue_bundle_link", { ...args, p_files: args.p_files as unknown as Json, p_open_items: args.p_open_items });
      if (error) throw error;
      return data as unknown as IssuedLink;
    },
  };
}
