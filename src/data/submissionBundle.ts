// A PEO's bundle (GLOSSARY.md, Bundle; L-3.4): one .zip of what a PEO needs, built from one certified version. The packet
// (The Manuscript, prepared for this PEO), its census file, the workers' comp application data, its supplement when it
// asks questions of its own, and, for an advisor, the uploaded documents its profile lists that are on file; with a
// contents page naming every file, what is missing and why, the blanks, and the certified version. The prospect's bundle
// holds only what they can download one by one: never the documents, which they uploaded themselves.
//
// Pure: this plans the bundle and writes its contents page. src/lib/submissionBundle.ts makes the files and the zip.
// Never another PEO's extra answers, and nothing an advisor wrote: no notes, reviews or corrections.
import type { ReviewedDocument } from "./advisor";
import type { CensusEmployee } from "./census";
import { blankColumnsOf, censusLayoutFor, OUR_CENSUS_LAYOUT, type PeoCensusLayout } from "./censusExport";
import { categoryInfo } from "./documentCategories";
import { buildManuscript, type ChamberSubmission, type Manuscript } from "./manuscript";
import { findPeo, peoSlug, type PeoRecord } from "./peoCatalog";
import { counted, documentsOnFile, peoCompleteness, type CertifiedIntake, type NeededItem } from "./peoCompleteness";
import type { ProfileDocument, RequirementProfile } from "./peoProfiles";
import { supplementFor, type Supplement } from "./peoSupplement";
import { workersCompApplication, type WorkersCompApplication } from "./workersCompApplication";

/** What a bundle is built from: the last certified version, and the PEO it is for. */
export interface BundleSource {
  /** An advisor's bundle carries the documents; the prospect's never does. */
  audience: "advisor" | "prospect";
  /** The PEO, as listed (with its profile in use), or a name typed in that isn't on the list. */
  peo: PeoRecord | { name: string };
  /** The PEOs the database lists, for the census layout and the packet's checks. */
  catalog: readonly PeoRecord[];
  /** The last certified version's answers (lastCertifiedVersion), never answers given since. */
  intake: CertifiedIntake;
  /** The intake's documents set against what that version covered (reconcileDocuments); the prospect's: none. */
  documents: readonly ReviewedDocument[];
  /** The certification on record: the packet's signer, date and version. */
  submission: ChamberSubmission;
  fileId: string;
  version: number | null;
  /** The prospect has changed answers since: the bundle is still this version, and says so. */
  changedSince: boolean;
  /** The reader's today (YYYY-MM-DD), for the packet's checks. */
  today: string;
}

export interface BundlePlan {
  audience: BundleSource["audience"];
  peo: string;
  /** The PEO's id, for its census template workbook; undefined for one typed in. */
  peoId: number | undefined;
  fileId: string;
  version: number | null;
  companyName: string;
  filename: string;
  manuscript: Manuscript;
  /** The certified census in the PEO's layout; null when the certified version holds none. */
  census: { rows: readonly CensusEmployee[]; layout: PeoCensusLayout; blanks: string[]; what: string } | null;
  application: WorkersCompApplication;
  supplement: Supplement | null;
  /** The uploaded files it carries: the advisor's bundle only. */
  documents: ReviewedDocument[];
  /** What the PEO's profile needs to quote that the certified version doesn't hold, documents included. */
  missing: NeededItem[];
  /** The documents the profile lists, which the prospect's bundle leaves to them. */
  documentsAskedFor: ProfileDocument[];
  /** False for a PEO with no profile in use: nothing can be said about what it requires. */
  hasProfile: boolean;
}

/** "EAA-2026-0042-sample-peo-v3.zip". */
export const bundleFilename = (fileId: string, peo: string, version: number | null) =>
  `${fileId}-${peoSlug(peo) || "peo"}${version !== null ? `-v${version}` : ""}.zip`;

const censusWhat = (layout: PeoCensusLayout) =>
  layout === OUR_CENSUS_LAYOUT ? "census in our layout" : layout.template ? `${layout.peo}'s own census workbook, filled in` : `census in ${layout.peo}'s layout`;

/** One PEO's bundle, planned from the last certified version. */
export function planBundle(s: BundleSource): BundlePlan {
  const listed = "listed" in s.peo ? s.peo : findPeo(s.catalog, s.peo.name);
  const profile: RequirementProfile | null = listed?.listed ? listed.profile ?? null : null;
  const name = listed?.name ?? s.peo.name;
  const companyName = s.intake.data.company_name ?? "Company not provided";
  const layout = censusLayoutFor(name, listed ? [listed] : []);
  const advisor = s.audience === "advisor";
  // The packet is prepared for this PEO, its checks run against its profile.
  const manuscript = buildManuscript(s.intake.data, {
    fileId: s.fileId,
    submission: { ...s.submission, peo: name },
    peo: listed?.listed ? listed : undefined,
    catalog: s.catalog,
    provenance: s.intake.provenance,
    verified: s.intake.verified,
    today: s.today,
  });
  const completeness = profile ? peoCompleteness(s.intake, advisor ? s.documents : [], profile, listed?.id) : null;
  return {
    audience: s.audience,
    peo: name,
    peoId: listed?.id,
    fileId: s.fileId,
    version: s.version,
    companyName,
    filename: bundleFilename(s.fileId, name, s.version),
    manuscript,
    census: s.intake.data.census.length > 0 ? { rows: s.intake.data.census, layout, blanks: blankColumnsOf(layout), what: censusWhat(layout) } : null,
    application: workersCompApplication({ intake: s.intake, fileId: s.fileId, version: s.version, changedSince: s.changedSince }),
    supplement: listed?.listed ? supplementFor(listed, { certified: s.intake.extraAnswers, fileId: s.fileId, version: s.version, companyName }) : null,
    documents: advisor && profile ? documentsOnFile(s.documents, profile) : [],
    // The prospect's bundle holds no documents, so it lists them all apart rather than as missing.
    missing: completeness ? completeness.toQuote.filter((i) => advisor || i.kind !== "document") : [],
    documentsAskedFor: profile?.documents ?? [],
    hasProfile: profile !== null,
  };
}

const NO_CENSUS = "No census file: the certified version holds none.";

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const asDocument = (i: NeededItem): i is Extract<NeededItem, { kind: "document" }> => i.kind === "document";

/** "Includes: packet, census in Sample PEO's layout, ... Missing: Workers' comp loss runs, 1 answer.", said before the click. */
export function bundleSummary(p: BundlePlan): string {
  const includes = [
    "packet",
    ...(p.census ? [p.census.what] : []),
    "workers' comp application",
    ...(p.supplement && !p.supplement.cantTell ? [p.supplement.title] : []),
    ...(p.documents.length ? [count(p.documents.length, "document")] : []),
  ];
  const documents = p.missing.filter(asDocument).map((d) => d.label);
  const answers = counted(p.missing.filter((i) => !asDocument(i)));
  const missing = [...documents, ...(answers ? [answers] : [])];
  const lines = [`Includes: ${includes.join(", ")}.`];
  if (!p.census) lines.push(NO_CENSUS);
  // The prospect's documents are theirs to add: said apart, and never "nothing is missing" while the PEO asks for any.
  const leftToThem = p.audience === "prospect" && p.documentsAskedFor.length > 0;
  if (leftToThem) {
    lines.push(`Not included: the documents ${p.peo} asks for (${p.documentsAskedFor.map((d) => categoryInfo(d.category).label).join(", ")}). Add your own copies when you send it.`);
  }
  if (missing.length) lines.push(`Missing: ${missing.join(", ")}.`);
  else if (!leftToThem) lines.push("Nothing it requires is missing.");
  return lines.join(" ");
}

/** What the zip holds besides the contents page, and what it couldn't take, as the files were made. */
export interface BundleOutcome {
  /** In the zip's order, after CONTENTS.txt. */
  files: { name: string; what: string }[];
  notIncluded: { what: string; why: string }[];
}

export const CONTENTS_NAME = "CONTENTS.txt";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The contents page, CONTENTS.txt and the zip's comment alike: the PEO and the certified version, then what is missing
 * (documents it requires and why, files that couldn't be included, answers it needs to quote), every file, then what
 * the files leave blank. Lines end CRLF, so it reads the same in any editor.
 */
export function bundleContents(p: BundlePlan, outcome: BundleOutcome): string {
  const out: string[] = [];
  const version = p.version !== null ? `certified version ${p.version}` : "the certification on record";
  out.push(`Bundle for ${p.peo}`);
  out.push(`${p.companyName} · File ID ${p.fileId} · ${version}, certified on ${p.manuscript.date}`);
  out.push(p.application.changedNotice ?? `Everything in it is from ${version}. Nothing comes from answers given since.`);
  out.push("");

  out.push("MISSING");
  const documents = p.missing.filter(asDocument);
  const answers = p.missing.filter((i) => !asDocument(i));
  const before = out.length;
  if (!p.hasProfile) out.push(`${p.peo} has no profile yet, so we can't say what it requires.`);
  if (p.audience === "prospect" && p.documentsAskedFor.length) {
    out.push(`Documents ${p.peo} asks for, not in this bundle. Add the copies you have when you send it:`);
    for (const d of p.documentsAskedFor) out.push(`- ${categoryInfo(d.category).label} (${d.description})`);
  }
  if (documents.length) {
    out.push(`Documents ${p.peo} requires that aren't in this bundle:`);
    for (const d of documents) out.push(`- ${d.label} (${d.description}): ${lower(d.reason)}`);
  }
  if (outcome.notIncluded.length) {
    out.push("Files that could not be included:");
    for (const n of outcome.notIncluded) out.push(`- ${n.what}: ${n.why}`);
  }
  if (answers.length) {
    out.push(`Answers ${p.peo} needs to quote that the certified version doesn't hold:`);
    for (const a of answers) out.push(`- ${a.label}: ${lower(a.reason)}`);
  }
  if (out.length === before) out.push(`Nothing ${p.peo} requires is missing.`);
  out.push("");

  const files = [{ name: CONTENTS_NAME, what: "this page" }, ...outcome.files];
  out.push(`IN THIS BUNDLE (${count(files.length, "file")})`);
  for (const f of files) out.push(`- ${f.name}: ${f.what}`);
  if (!p.census) out.push(NO_CENSUS);
  out.push("");

  out.push("LEFT BLANK");
  if (p.census) {
    out.push(p.census.blanks.length ? `Census file, columns the intake doesn't collect: ${p.census.blanks.join(", ")}` : "Census file: nothing");
  }
  const blanks = p.application.blanks;
  if (blanks.length) {
    out.push(`Workers' comp application, ${blanks.length} items not in the certified answers:`);
    for (const b of blanks) out.push(`- ${b}`);
  } else {
    out.push("Workers' comp application: nothing");
  }
  if (p.supplement && !p.supplement.cantTell && p.supplement.notAnswered.length) {
    out.push(`${p.supplement.title}, not answered: ${p.supplement.notAnswered.join("; ")}`);
  }
  out.push("");
  return out.join("\r\n");
}
