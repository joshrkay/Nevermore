// Makes a PEO's bundle (src/data/submissionBundle.ts plans it): each file, the contents page, and one zip. Loaded only
// when a bundle is downloaded: it brings the PDF and spreadsheet builders with it.
import type { ReviewedDocument } from "@/data/advisor";
import { categoryInfo } from "@/data/documentCategories";
import { bundleContents, CONTENTS_NAME, type BundleOutcome, type BundlePlan } from "@/data/submissionBundle";
import { censusFile } from "@/lib/censusWorkbook";
import { buildManuscriptPdf } from "@/lib/manuscriptPdf";
import { storedZip, type ZipEntry } from "@/lib/storedZip";
import { buildSupplementPdf } from "@/lib/supplementPdf";
import { readBytes } from "@/lib/uploadCheck";
import { buildWorkersCompPdf } from "@/lib/workersCompPdf";

/** The most a bundle holds, documents included: past it a document is left out and listed, to be sent on its own. */
export const BUNDLE_MAX_BYTES = 100 * 1024 * 1024;

export interface BundleDeps {
  /** Reads a clean PEO template workbook (src/lib/templateWorkbooks.ts); null when it can't be read. */
  readTemplate: (peoId: number, templateId: number) => Promise<Uint8Array | null>;
  /** Fetches one uploaded document's file the way the page already opens it (a signed link). */
  fetchDocument: (doc: ReviewedDocument) => Promise<Blob>;
  /** Called before each document is fetched and once all are: done of total. */
  onProgress?: (p: { done: number; total: number }) => void;
  maxBytes?: number;
}

export interface BuiltBundle {
  blob: Blob;
  filename: string;
  contents: string;
  /** What couldn't go in, said in the contents page and to the advisor before saving. */
  notIncluded: BundleOutcome["notIncluded"];
}

const SEND_IT_YOURSELF = "Download it from the submission page and send it with this bundle.";

/** The longest name a bundle gives a file, extension included: room left for " (2)" and the folder it is unzipped into. */
const NAME_MAX = 100;
/** Names Windows keeps for devices: a file called "CON.txt" can't be made there. */
const DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

/**
 * A name every unzip tool and operating system takes as one file, as the zip names it and the contents page lists it:
 * control characters, Windows' forbidden characters and either slash become "_"; no trailing dots or spaces; a name left
 * empty (or ".", "..") is "document", keeping an extension it had; at most 100 characters, never cutting one in two.
 * Any language is kept.
 */
export function safeFileName(name: string): string {
  const trim = (s: string) => s.replace(/[. ]+$/, "");
  const clean = trim(name.normalize("NFC").replace(/[\p{Cc}<>:"|?*/\\]/gu, "_"));
  const dot = clean.lastIndexOf(".");
  const ext = dot >= 0 && /^\.[\p{L}\p{N}]{1,15}$/u.test(clean.slice(dot)) ? clean.slice(dot) : "";
  const stem = trim(Array.from(ext ? clean.slice(0, dot) : clean).slice(0, NAME_MAX - Array.from(ext).length).join(""));
  const whole = `${stem || "document"}${ext}`;
  return DEVICE.test(whole) ? `_${whole}` : whole;
}

/** "register.xlsx", then "Register (2).xlsx": a second file of that name in any case, as Windows and macOS see it. */
function uniqueName(name: string, taken: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const slash = name.lastIndexOf("/");
  const [stem, ext] = dot > slash + 1 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** A name as the contents page mentions a file left out: never a control character that would break its lines. */
const printable = (name: string) => name.replace(/\p{Cc}/gu, "_");

/** The bundle as one zip: CONTENTS.txt first, then each file, the documents under documents/. */
export async function buildBundle(plan: BundlePlan, deps: BundleDeps): Promise<BuiltBundle> {
  const maxBytes = deps.maxBytes ?? BUNDLE_MAX_BYTES;
  const entries: (ZipEntry & { what: string })[] = [];
  const notIncluded: BundleOutcome["notIncluded"] = [];
  // Every entry, made or uploaded, under a safe name no other entry has.
  const taken = new Set<string>();
  const entryName = (folder: string, name: string) => uniqueName(`${folder}${safeFileName(name)}`, taken);
  const add = async (name: string, blob: Blob, what: string) => entries.push({ name: entryName("", name), data: await readBytes(blob), what });

  const packet = buildManuscriptPdf(plan.manuscript, { revealSensitive: false });
  await add(packet.filename, packet.blob, "the packet, as certified, dates of birth masked");

  if (plan.census) {
    const { layout } = plan.census;
    const template = layout.template && plan.peoId !== undefined ? await deps.readTemplate(plan.peoId, layout.template.id).catch(() => null) : null;
    if (layout.template && !template) {
      notIncluded.push({ what: "Census file", why: `We couldn't get ${plan.peo}'s template workbook. Download the census on its own and send it with this bundle.` });
    } else {
      const file = await censusFile(plan.census.rows, layout, { fileId: plan.fileId, version: plan.version, template });
      if (file.ok === false) notIncluded.push({ what: "Census file", why: file.message });
      else await add(file.filename, file.blob, `the ${plan.census.what}`);
    }
  }

  const application = buildWorkersCompPdf(plan.application);
  await add(application.filename, application.blob, "workers' comp application data, our own summary in the standard application's order");

  if (plan.supplement?.cantTell) {
    notIncluded.push({ what: plan.supplement.title, why: `${plan.version !== null ? `Version ${plan.version}` : "The certification on record"} was certified before we kept the answers to ${plan.peo}'s own questions. Certifying again adds them.` });
  } else if (plan.supplement) {
    const supplement = buildSupplementPdf(plan.supplement);
    await add(supplement.filename, supplement.blob, `${plan.supplement.title}, for ${plan.peo} only`);
  }

  let size = entries.reduce((n, e) => n + e.data.length, 0);
  for (const [i, d] of plan.documents.entries()) {
    deps.onProgress?.({ done: i, total: plan.documents.length });
    const name = printable(d.certifiedFileName ?? d.file_name);
    const kind = categoryInfo(d.certifiedCategory ?? d.category).label;
    let data: Uint8Array;
    try {
      data = await readBytes(await deps.fetchDocument(d));
    } catch {
      notIncluded.push({ what: `${name} (${kind})`, why: `It couldn't be downloaded. ${SEND_IT_YOURSELF}` });
      continue;
    }
    if (size + data.length > maxBytes) {
      notIncluded.push({ what: `${name} (${kind})`, why: `It would take the bundle over ${Math.round(BUNDLE_MAX_BYTES / 1024 / 1024)} MB. ${SEND_IT_YOURSELF}` });
      continue;
    }
    size += data.length;
    entries.push({ name: entryName("documents/", d.certifiedFileName ?? d.file_name), data, what: kind });
  }
  if (plan.documents.length) deps.onProgress?.({ done: plan.documents.length, total: plan.documents.length });

  const contents = bundleContents(plan, { files: entries.map(({ name, what }) => ({ name, what })), notIncluded });
  // A byte order mark, so an editor that guesses the encoding reads "·" and accented names right.
  const page = { name: CONTENTS_NAME, data: new TextEncoder().encode(`\uFEFF${contents}`) };
  const zip = storedZip([page, ...entries], contents);
  return { blob: new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), filename: plan.filename, contents, notIncluded };
}
